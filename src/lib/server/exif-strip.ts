/**
 * Strip embedded metadata (EXIF / XMP / ICC / comments) from JPEG, PNG, and
 * WebP uploads. Mobile cameras embed GPS lat/lng, device serial numbers, and
 * timestamps in these segments — stripping them prevents sub-metre location
 * disclosure even when the DB row only stores rounded coords.
 *
 * All three functions follow the same contract: return the input unchanged when
 * the format signature is absent or the stream is malformed, so a corrupt upload
 * is rejected at the content-type validation step rather than silently mangled.
 */

/**
 * Strip EXIF/XMP/ICC from a JPEG.
 *
 * JPEG layout: SOI → segments (FF XX len payload) → SOS → scan data → EOI.
 * We keep APP0 (JFIF), DQT/DHT/SOF, and SOS + scan data.
 * We drop APP1–APP15 (FF E1–EF) and COM (FF FE).
 */
export function stripJpegMetadata(input: Uint8Array): Uint8Array {
	// SOI check: JPEG must start with FF D8.
	if (input.length < 2 || input[0] !== 0xff || input[1] !== 0xd8) {
		return input;
	}

	// Output can only shrink — never grow — since we only drop segments.
	const out = new Uint8Array(input.length);
	let w = 0;
	out[w++] = 0xff;
	out[w++] = 0xd8;
	let i = 2;

	while (i < input.length) {
		if (input[i] !== 0xff) return input; // malformed stream
		while (i < input.length && input[i] === 0xff) i++; // skip 0xFF fill bytes
		if (i >= input.length) break;

		const marker = input[i++];

		// EOI — finish.
		if (marker === 0xd9) {
			out[w++] = 0xff;
			out[w++] = 0xd9;
			return out.slice(0, w);
		}
		// Standalone markers (no length field): SOI, RSTn, TEM.
		if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
			out[w++] = 0xff;
			out[w++] = marker;
			continue;
		}

		if (i + 2 > input.length) return input; // truncated length field
		const segLen = (input[i] << 8) | input[i + 1];
		if (segLen < 2 || i + segLen > input.length) return input; // malformed

		// SOS: copy segment, then copy the rest of the file (compressed scan +
		// any embedded RSTn markers + EOI). We do not parse scan data because
		// byte-stuffing (FF 00) and restart markers make it expensive and
		// fragile; trailing non-standard trailers are rare and not worth risk.
		if (marker === 0xda) {
			out[w++] = 0xff;
			out[w++] = marker;
			out.set(input.subarray(i, i + segLen), w);
			w += segLen;
			i += segLen;
			const rest = input.subarray(i);
			// Require EOI (FF D9) at the tail — a JPEG truncated after SOS
			// (e.g. an interrupted upload) has no EOI. Return the original rather
			// than a partially-stripped copy, consistent with the malformed-input
			// contract above.
			if (rest.length < 2 || rest[rest.length - 2] !== 0xff || rest[rest.length - 1] !== 0xd9) {
				return input;
			}
			out.set(rest, w);
			w += rest.length;
			return out.slice(0, w);
		}

		const isMetadataSegment = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;

		if (!isMetadataSegment) {
			out[w++] = 0xff;
			out[w++] = marker;
			out.set(input.subarray(i, i + segLen), w);
			w += segLen;
		}
		i += segLen;
	}

	// Loop exited without hitting SOS or EOI → JPEG is truncated/malformed.
	// Per the function contract, return the original bytes unchanged rather
	// than a structurally incomplete stripped copy.
	return input;
}

/**
 * Strip the `eXIf` chunk from a PNG.
 *
 * PNG layout: 8-byte signature → chunks (4-byte length, 4-byte type,
 * data, 4-byte CRC). We drop only the `eXIf` chunk (the official EXIF
 * container for PNG defined in PNG spec 1.6). All other chunks — including
 * image data (IDAT), colour info (gAMA/cHRM/sRGB), and transparency (tRNS)
 * — are kept intact.
 */
export function stripPngMetadata(input: Uint8Array): Uint8Array {
	const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	if (input.length < 8) return input;
	for (let j = 0; j < 8; j++) if (input[j] !== PNG_SIG[j]) return input;

	const out = new Uint8Array(input.length);
	out.set(input.subarray(0, 8), 0);
	let w = 8;
	let i = 8;

	while (i + 12 <= input.length) {
		const chunkLen = ((input[i] << 24) | (input[i + 1] << 16) | (input[i + 2] << 8) | input[i + 3]) >>> 0;
		if (i + 12 + chunkLen > input.length) return input;
		const type = String.fromCharCode(input[i + 4], input[i + 5], input[i + 6], input[i + 7]);
		const total = 12 + chunkLen; // 4 (len) + 4 (type) + chunkLen (data) + 4 (CRC)

		if (type !== 'eXIf') {
			out.set(input.subarray(i, i + total), w);
			w += total;
		}

		i += total;
		if (type === 'IEND') break;
	}

	return out.slice(0, w);
}

/**
 * Strip EXIF and XMP chunks from an extended (VP8X) WebP.
 *
 * WebP layout: RIFF header (12 bytes) → chunks (4-byte FourCC, 4-byte
 * little-endian size, data, optional pad byte). Only VP8X (extended) files
 * can carry standalone EXIF/XMP chunks; simple VP8 and lossless VP8L files
 * cannot and are returned unchanged. When chunks are removed we also clear
 * the corresponding flag bits in the VP8X flags byte and update the RIFF
 * file-size field so the result parses correctly.
 */
export function stripWebpMetadata(input: Uint8Array): Uint8Array {
	// RIFF + WEBP signature
	if (
		input.length < 30 ||
		input[0] !== 0x52 || input[1] !== 0x49 || input[2] !== 0x46 || input[3] !== 0x46 ||
		input[8] !== 0x57 || input[9] !== 0x45 || input[10] !== 0x42 || input[11] !== 0x50
	) return input;

	// Only VP8X (0x56 0x50 0x38 0x58 = "VP8X") carries metadata chunks.
	if (input[12] !== 0x56 || input[13] !== 0x50 || input[14] !== 0x38 || input[15] !== 0x58) return input;

	const vp8xDataSize = (input[16] | (input[17] << 8) | (input[18] << 16) | (input[19] << 24)) >>> 0;
	if (vp8xDataSize < 1 || 20 + vp8xDataSize > input.length) return input;

	const out = new Uint8Array(input.length);
	// Copy RIFF/WEBP header (12) + VP8X chunk header + data
	out.set(input.subarray(0, 20 + vp8xDataSize), 0);
	// Clear Exif (bit 3 = 0x08) and XMP (bit 4 = 0x10) flag bits in VP8X flags byte
	out[20] = input[20] & ~0x18;
	let w = 20 + vp8xDataSize;
	if (vp8xDataSize & 1) out[w++] = 0; // pad to even boundary

	let i = 20 + vp8xDataSize + (vp8xDataSize & 1);
	while (i + 8 <= input.length) {
		const type = String.fromCharCode(input[i], input[i + 1], input[i + 2], input[i + 3]);
		const chunkSize = (input[i + 4] | (input[i + 5] << 8) | (input[i + 6] << 16) | (input[i + 7] << 24)) >>> 0;
		const paddedSize = chunkSize + (chunkSize & 1);
		if (i + 8 + paddedSize > input.length) return input;

		if (type !== 'EXIF' && type !== 'XMP ') {
			out.set(input.subarray(i, i + 8 + paddedSize), w);
			w += 8 + paddedSize;
		}
		i += 8 + paddedSize;
	}

	const result = out.slice(0, w);
	// Fix RIFF file size (bytes 4–7, little-endian) = total size − 8
	const fileSize = w - 8;
	result[4] = fileSize & 0xff;
	result[5] = (fileSize >> 8) & 0xff;
	result[6] = (fileSize >> 16) & 0xff;
	result[7] = (fileSize >> 24) & 0xff;
	return result;
}
