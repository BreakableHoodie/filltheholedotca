// tests/unit/exif-strip-png-webp.spec.ts
import { test, expect } from '@playwright/test';
import { stripPngMetadata, stripWebpMetadata } from '../../src/lib/server/exif-strip';

// ── PNG helpers ──────────────────────────────────────────────────────────
// Build a chunk: 4-byte big-endian length, 4-byte ASCII type, data, 4-byte CRC.
// stripPngMetadata never validates the CRC, so a zero-filled placeholder is fine.
function pngChunk(type: string, data: number[] = []): number[] {
	const len = data.length;
	const lenBytes = [(len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
	const typeBytes = Array.from(type).map((c) => c.charCodeAt(0));
	const crc = [0, 0, 0, 0];
	return [...lenBytes, ...typeBytes, ...data, ...crc];
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function u8(...parts: number[][]): Uint8Array {
	return new Uint8Array(parts.flat());
}

// ── WebP helpers ─────────────────────────────────────────────────────────
// Build a chunk: 4-byte ASCII FourCC, 4-byte little-endian size, data, and a
// trailing pad byte if the size is odd (per the RIFF/WebP spec).
function webpChunk(fourcc: string, data: number[]): number[] {
	const size = data.length;
	const sizeBytes = [size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff];
	const fourccBytes = Array.from(fourcc).map((c) => c.charCodeAt(0));
	const bytes = [...fourccBytes, ...sizeBytes, ...data];
	if (size & 1) bytes.push(0);
	return bytes;
}

// Wraps a chunk-bytes body in the 12-byte RIFF/WEBP container header, computing
// the RIFF file-size field (total length minus 8) the way a real WebP would.
function riffHeader(bodyBytes: number[]): number[] {
	const totalLen = 4 + bodyBytes.length; // 'WEBP' + body
	const size = totalLen;
	return [
		0x52,
		0x49,
		0x46,
		0x46, // 'RIFF'
		size & 0xff,
		(size >> 8) & 0xff,
		(size >> 16) & 0xff,
		(size >> 24) & 0xff,
		0x57,
		0x45,
		0x42,
		0x50, // 'WEBP'
		...bodyBytes,
	];
}

test.describe('stripPngMetadata', () => {
	test('removes the eXIf chunk, keeping IHDR/IDAT/IEND intact', () => {
		const ihdr = pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
		const exif = pngChunk('eXIf', [0x4d, 0x4d, 0x00, 0x2a]); // fake big-endian TIFF header
		const idat = pngChunk('IDAT', [0x01, 0x02, 0x03]);
		const iend = pngChunk('IEND');
		const input = u8(PNG_SIG, ihdr, exif, idat, iend);

		expect(stripPngMetadata(input)).toEqual(u8(PNG_SIG, ihdr, idat, iend));
	});

	test('returns a PNG without an eXIf chunk byte-for-byte unchanged', () => {
		const ihdr = pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
		const idat = pngChunk('IDAT', [1, 2, 3]);
		const iend = pngChunk('IEND');
		const input = u8(PNG_SIG, ihdr, idat, iend);

		expect(stripPngMetadata(input)).toEqual(input);
	});

	test('returns non-PNG input unchanged (bad signature)', () => {
		const input = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
		expect(stripPngMetadata(input)).toBe(input);
	});

	test('returns input shorter than the 8-byte signature unchanged', () => {
		const input = new Uint8Array([0x89, 0x50, 0x4e]);
		expect(stripPngMetadata(input)).toBe(input);
	});

	test('returns input unchanged when a chunk length extends past end of file', () => {
		// Claims length=100 for an IHDR chunk but the buffer holds none of that data.
		const badChunk = [
			0,
			0,
			0,
			100,
			...'IHDR'.split('').map((c) => c.charCodeAt(0)),
			0,
			0,
			0,
			0,
		];
		const input = u8(PNG_SIG, badChunk);
		expect(stripPngMetadata(input)).toBe(input);
	});
});

test.describe('stripWebpMetadata', () => {
	test('removes EXIF and XMP chunks from a VP8X WebP, clearing their flag bits, keeping the image chunk', () => {
		// VP8X data: flags byte with EXIF (0x08) and XMP (0x10) bits set, then 9
		// bytes of reserved/canvas-dimension fields (unused by the stripper).
		const vp8xData = [0x18, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		const vp8xChunk = webpChunk('VP8X', vp8xData);
		const vp8Chunk = webpChunk('VP8 ', [0xaa, 0xbb, 0xcc, 0xdd]);
		const exifChunk = webpChunk('EXIF', [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]);
		// 9-byte (odd) XMP payload — exercises the odd-chunk pad-byte handling.
		const xmpChunk = webpChunk('XMP ', [0x3c, 0x3f, 0x78, 0x70, 0x61, 0x63, 0x6b, 0x65, 0x74]);
		const input = new Uint8Array(
			riffHeader([...vp8xChunk, ...vp8Chunk, ...exifChunk, ...xmpChunk]),
		);

		// Expected: EXIF/XMP bits cleared in the VP8X flags byte, EXIF and XMP
		// chunks gone, VP8 image chunk intact, RIFF size field recomputed.
		const expectedVp8xChunk = webpChunk('VP8X', [0x18 & ~0x18, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		const expected = new Uint8Array(riffHeader([...expectedVp8xChunk, ...vp8Chunk]));

		expect(stripWebpMetadata(input)).toEqual(expected);
	});

	test('returns a simple (non-extended) VP8 WebP unchanged — lossy WebP cannot carry standalone metadata', () => {
		const vp8Chunk = webpChunk('VP8 ', [0xaa, 0xbb, 0xcc, 0xdd]);
		const input = new Uint8Array(riffHeader(vp8Chunk));
		expect(stripWebpMetadata(input)).toBe(input);
	});

	test('returns a simple VP8L (lossless) WebP unchanged — lossless WebP cannot carry standalone metadata', () => {
		const vp8lChunk = webpChunk('VP8L', [0x2f, 0x00, 0x00, 0x00, 0x00]);
		const input = new Uint8Array(riffHeader(vp8lChunk));
		expect(stripWebpMetadata(input)).toBe(input);
	});

	test('returns non-WebP input unchanged (bad RIFF/WEBP signature)', () => {
		const input = new Uint8Array(30); // all zero — fails both the RIFF and WEBP checks
		expect(stripWebpMetadata(input)).toBe(input);
	});

	test('returns input unchanged when the VP8X chunk size extends past end of file', () => {
		const vp8xChunk = webpChunk('VP8X', [0x18, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		const bytes = riffHeader(vp8xChunk);
		// Corrupt the declared VP8X chunk data size (offset 16-19) to claim far
		// more bytes than the buffer actually holds.
		bytes[16] = 0xff;
		bytes[17] = 0xff;
		const input = new Uint8Array(bytes);
		expect(stripWebpMetadata(input)).toBe(input);
	});
});
