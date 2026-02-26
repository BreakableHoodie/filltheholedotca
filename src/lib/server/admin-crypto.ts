import { TOTP_ENCRYPTION_KEY } from '$env/static/private';

// ---------------------------------------------------------------------------
// PBKDF2-SHA-256 password hashing
// Stored format: "iterations:salt_hex:hash_hex"
// 310 000 iterations — meets NIST SP 800-132 guidance for PBKDF2-SHA-256
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 32;
const HASH_BYTES = 32;

export async function hashPassword(password: string): Promise<string> {
	const saltBuf = new ArrayBuffer(SALT_BYTES);
	const salt = new Uint8Array(saltBuf);
	crypto.getRandomValues(salt);
	const key = await deriveKey(password, salt);
	const hash = await crypto.subtle.exportKey('raw', key);
	return `${PBKDF2_ITERATIONS}:${hex(salt)}:${hex(new Uint8Array(hash))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split(':');
	if (parts.length !== 3) return false;
	const [iterStr, saltHex, hashHex] = parts;
	const iterations = parseInt(iterStr, 10);
	if (!Number.isFinite(iterations) || iterations < 1) return false;
	const salt = unhex(saltHex);
	const expected = unhex(hashHex);
	const key = await deriveKey(password, salt, iterations);
	const actual = new Uint8Array(await crypto.subtle.exportKey('raw', key));
	// Constant-time comparison
	if (actual.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
	return diff === 0;
}

async function deriveKey(
	password: string,
	salt: Uint8Array<ArrayBuffer>,
	iterations = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
		'deriveKey'
	]);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		baseKey,
		{ name: 'AES-GCM', length: HASH_BYTES * 8 },
		true,
		['encrypt', 'decrypt']
	);
}

// ---------------------------------------------------------------------------
// AES-GCM TOTP secret encryption
// Stored format: "iv_hex:ciphertext_hex"
// ---------------------------------------------------------------------------

let totpKeyCache: CryptoKey | null = null;

async function getTotpKey(): Promise<CryptoKey> {
	if (totpKeyCache) return totpKeyCache;
	const raw = unhex(TOTP_ENCRYPTION_KEY);
	if (raw.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
	totpKeyCache = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
		'encrypt',
		'decrypt'
	]);
	return totpKeyCache;
}

export async function encryptTotpSecret(secret: string): Promise<string> {
	const key = await getTotpKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const enc = new TextEncoder();
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(secret));
	return `${hex(iv)}:${hex(new Uint8Array(ciphertext))}`;
}

export async function decryptTotpSecret(stored: string): Promise<string> {
	const parts = stored.split(':');
	if (parts.length !== 2) throw new Error('Invalid encrypted TOTP secret format');
	const [ivHex, ciphertextHex] = parts;
	const key = await getTotpKey();
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: unhex(ivHex) },
		key,
		unhex(ciphertextHex)
	);
	return new TextDecoder().decode(plaintext);
}

// ---------------------------------------------------------------------------
// PBKDF2-hashed backup codes
// Codes are random 8-char alphanumeric strings; stored as PBKDF2 hashes.
// Fewer iterations than passwords — codes are high-entropy by design.
// ---------------------------------------------------------------------------

const BACKUP_CODE_ITERATIONS = 10_000;
const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous chars

export function generateBackupCodes(): string[] {
	return Array.from({ length: BACKUP_CODE_COUNT }, () => {
		const bytes = crypto.getRandomValues(new Uint8Array(BACKUP_CODE_LENGTH));
		return Array.from(bytes)
			.map((b) => BACKUP_CODE_CHARS[b % BACKUP_CODE_CHARS.length])
			.join('');
	});
}

export async function hashBackupCode(code: string): Promise<string> {
	const normalised = code.toUpperCase().replace(/\s/g, '');
	const saltBuf = new ArrayBuffer(16);
	const salt = new Uint8Array(saltBuf);
	crypto.getRandomValues(salt);
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey('raw', enc.encode(normalised), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: BACKUP_CODE_ITERATIONS },
		baseKey,
		256
	);
	return `${BACKUP_CODE_ITERATIONS}:${hex(salt)}:${hex(new Uint8Array(bits))}`;
}

export async function verifyBackupCode(
	candidate: string,
	hashes: string[]
): Promise<{ valid: boolean; remaining: string[] }> {
	const normalised = candidate.toUpperCase().replace(/\s/g, '');
	const enc = new TextEncoder();

	let matchIndex = -1;
	for (let i = 0; i < hashes.length; i++) {
		const parts = hashes[i].split(':');
		if (parts.length !== 3) continue;
		const [iterStr, saltHex, hashHex] = parts;
		const iterations = parseInt(iterStr, 10);
		const salt = unhex(saltHex);
		const expected = unhex(hashHex);

		const baseKey = await crypto.subtle.importKey('raw', enc.encode(normalised), 'PBKDF2', false, [
			'deriveBits'
		]);
		const bits = await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
			baseKey,
			256
		);
		const actual = new Uint8Array(bits);
		if (actual.length !== expected.length) continue;
		let diff = 0;
		for (let j = 0; j < actual.length; j++) diff |= actual[j] ^ expected[j];
		if (diff === 0) {
			matchIndex = i;
			break;
		}
	}

	if (matchIndex === -1) return { valid: false, remaining: hashes };
	return {
		valid: true,
		remaining: hashes.filter((_, i) => i !== matchIndex)
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function unhex(str: string): Uint8Array<ArrayBuffer> {
	if (str.length % 2 !== 0) throw new Error('Invalid hex string');
	const buf = new ArrayBuffer(str.length / 2);
	const bytes = new Uint8Array(buf);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(str.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}
