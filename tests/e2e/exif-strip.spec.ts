import { expect, test } from '@playwright/test';
import { stripJpegMetadata } from '../../src/lib/server/exif-strip';

const MARKER_APP0 = 0xe0;
const MARKER_APP1 = 0xe1;
const MARKER_COM = 0xfe;
const MARKER_DQT = 0xdb;

function makeSegment(marker: number, payload: number[]): number[] {
	const length = payload.length + 2;
	return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

test.describe('stripJpegMetadata', () => {
	test('removes EXIF/comment metadata while preserving image scan data', async () => {
		const app0 = makeSegment(MARKER_APP0, [0x4a, 0x46, 0x49, 0x46, 0x00]);
		const app1Exif = makeSegment(MARKER_APP1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x47, 0x50, 0x53]);
		const com = makeSegment(MARKER_COM, [0x53, 0x65, 0x6e, 0x73, 0x69, 0x74, 0x69, 0x76, 0x65]);
		const dqt = makeSegment(MARKER_DQT, [0x00, 0x01, 0x02, 0x03]);
		const sos = makeSegment(0xda, [0x00, 0x3f, 0x00]);
		const scanAndEoi = [0x11, 0x22, 0xff, 0x00, 0x33, 0x44, 0xff, 0xd9];

		const input = Uint8Array.from([0xff, 0xd8, ...app0, ...app1Exif, ...com, ...dqt, ...sos, ...scanAndEoi]);
		const clean = stripJpegMetadata(input);
		const cleanBytes = Array.from(clean);

		expect(clean).not.toBe(input);
		expect(Array.from(clean.subarray(0, 2))).toEqual([0xff, 0xd8]);
		expect(Array.from(clean.subarray(-2))).toEqual([0xff, 0xd9]);
		expect(cleanBytes).not.toContain(MARKER_APP1);
		expect(cleanBytes).not.toContain(MARKER_COM);
		expect(cleanBytes).toContain(MARKER_APP0);
		expect(cleanBytes).toContain(MARKER_DQT);
		expect(Array.from(clean.subarray(-scanAndEoi.length))).toEqual(scanAndEoi);

		const removedBytes = app1Exif.length + com.length;
		expect(clean.length).toBe(input.length - removedBytes);
	});

	test('returns original input for non-jpeg bytes', async () => {
		const input = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
		const clean = stripJpegMetadata(input);
		expect(clean).toBe(input);
	});

	test('returns original input when a JPEG segment is truncated', async () => {
		const truncated = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x41, 0x42]);
		const clean = stripJpegMetadata(truncated);
		expect(clean).toBe(truncated);
	});

	test('returns original input when stream ends without SOS/EOI', async () => {
		const app1Exif = makeSegment(0xe1, [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
		const truncated = Uint8Array.from([0xff, 0xd8, ...app1Exif]);
		const clean = stripJpegMetadata(truncated);
		expect(clean).toBe(truncated);
	});
});
