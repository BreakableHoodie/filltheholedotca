import { expect, test } from '@playwright/test';
import { stripJpegMetadata } from '../../src/lib/server/exif-strip';

// Build a segment: FF <marker> <len_hi> <len_lo> <payload>
// Length field is big-endian and includes its own 2 bytes.
function seg(marker: number, payload: number[] = []): number[] {
	const len = payload.length + 2;
	return [0xff, marker, len >> 8, len & 0xff, ...payload];
}

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];

function u8(...parts: number[][]): Uint8Array {
	return new Uint8Array(parts.flat());
}

test.describe('stripJpegMetadata', () => {
	test('returns non-JPEG input unchanged (PNG magic bytes)', () => {
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
		expect(stripJpegMetadata(png)).toBe(png);
	});

	test('returns empty array unchanged', () => {
		const empty = new Uint8Array(0);
		expect(stripJpegMetadata(empty)).toBe(empty);
	});

	test('minimal JPEG — SOI + EOI only — passes through', () => {
		const input = u8(SOI, EOI);
		expect(stripJpegMetadata(input)).toEqual(u8(SOI, EOI));
	});

	test('strips APP1 (EXIF) segment', () => {
		const app1 = seg(0xe1, [0x45, 0x78, 0x69, 0x66]); // "Exif"
		const input = u8(SOI, app1, EOI);
		expect(stripJpegMetadata(input)).toEqual(u8(SOI, EOI));
	});

	test('preserves APP0 (JFIF) segment', () => {
		const app0 = seg(0xe0, [0x4a, 0x46, 0x49, 0x46]); // "JFIF"
		const app1 = seg(0xe1, [0x45, 0x78, 0x69, 0x66]); // "Exif"
		const input = u8(SOI, app0, app1, EOI);
		expect(stripJpegMetadata(input)).toEqual(u8(SOI, app0, EOI));
	});

	test('strips COM (comment) segment', () => {
		const com = seg(0xfe, [0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"
		const input = u8(SOI, com, EOI);
		expect(stripJpegMetadata(input)).toEqual(u8(SOI, EOI));
	});

	test('strips APP2–APP15 range', () => {
		const app2 = seg(0xe2, [0x01, 0x02]);
		const app15 = seg(0xef, [0x03, 0x04]);
		const input = u8(SOI, app2, app15, EOI);
		expect(stripJpegMetadata(input)).toEqual(u8(SOI, EOI));
	});

	test('preserves SOS segment and all trailing scan data', () => {
		const sosSeg = seg(0xda, [0x01]); // minimal SOS header
		const scanData = [0xaa, 0xbb, 0xcc]; // compressed image data
		const input = u8(SOI, sosSeg, scanData, EOI);
		expect(stripJpegMetadata(input)).toEqual(u8(SOI, sosSeg, scanData, EOI));
	});

	test('strips EXIF before SOS, preserves scan data and EOI', () => {
		const app1 = seg(0xe1, [0x45, 0x78, 0x69, 0x66]);
		const sosSeg = seg(0xda, [0x01]);
		const scanData = [0xaa, 0xbb];
		const input = u8(SOI, app1, sosSeg, scanData, EOI);
		expect(stripJpegMetadata(input)).toEqual(u8(SOI, sosSeg, scanData, EOI));
	});

	test('returns input unchanged when length field is truncated', () => {
		// SOI + FF E1 + only 1 byte of the 2-byte length field
		const input = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]);
		expect(stripJpegMetadata(input)).toBe(input);
	});

	test('returns input unchanged when segment length extends past end of file', () => {
		// APP1 claiming length=100, but only 2 payload bytes exist
		const input = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x64, 0x00, 0x00]);
		expect(stripJpegMetadata(input)).toBe(input);
	});

	test('returns input unchanged when file ends without SOS or EOI', () => {
		// SOI + valid APP1, no SOS/EOI — truncated JPEG
		const app1 = seg(0xe1, [0x45, 0x78, 0x69, 0x66]);
		const input = u8(SOI, app1);
		expect(stripJpegMetadata(input)).toBe(input);
	});

	test('returns input unchanged when SOS is present but EOI is missing (truncated scan)', () => {
		// Simulates an interrupted upload: SOS segment exists but scan data ends
		// abruptly without FF D9. The function must not return a partially-stripped
		// copy — the contract is to pass through malformed JPEGs unchanged.
		const sosSeg = seg(0xda, [0x01]);
		const scanData = [0xaa, 0xbb, 0xcc]; // no FF D9
		const input = u8(SOI, sosSeg, scanData);
		expect(stripJpegMetadata(input)).toBe(input);
	});
});
