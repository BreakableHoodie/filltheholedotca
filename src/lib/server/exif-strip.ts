/**
 * Strip EXIF / XMP / ICC / comment segments from a JPEG, preserving pixels.
 *
 * Mobile cameras embed GPS lat/lng (sub-metre precision), device make/model,
 * serial numbers, and timestamps in the APP1 (EXIF) and APP2 (ICC/MPF) segments.
 * Rounding the DB-stored coords is useless if the bytes we store next to the
 * row still reveal where the reporter was standing.
 *
 * JPEG layout:
 *   SOI (FF D8) → segments (FF XX [len_hi] [len_lo] payload…) → SOS (FF DA)
 *   followed by compressed scan data → EOI (FF D9).
 *   Segment length is big-endian and includes the two length bytes themselves.
 *
 * We keep APP0 (FF E0 / JFIF header — some decoders require it), DQT/DHT/SOF,
 * and the SOS segment + scan data. We drop APP1–APP15 (FF E1–EF) and COM
 * (FF FE), which carry EXIF/XMP/ICC/FPXR/comments.
 *
 * Returns the input unchanged for anything that isn't a well-formed JPEG so
 * PNG/WebP pass through for their own handlers.
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

	return out.slice(0, w);
}
