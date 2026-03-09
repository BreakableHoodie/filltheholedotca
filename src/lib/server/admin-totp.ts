import { verify, generate } from '@otplib/totp';
import { generateSecret, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';

// Shared plugin instances (created once, reused)
const plugins = {
	crypto: new NobleCryptoPlugin(),
	base32: new ScureBase32Plugin()
};

/** Generate a new base32-encoded TOTP secret. */
export async function generateTotpSecret(): Promise<string> {
	return generateSecret(plugins) as unknown as Promise<string>;
}

/** Generate the current TOTP token for a secret (for testing). */
export async function generateTotpToken(secret: string): Promise<string> {
	const token = await generate({ secret, ...plugins });
	return String(token);
}

/** Verify a TOTP code or backup code against a secret. */
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
	const result = await verify({ secret, token: code, ...plugins });
	return result.valid;
}

/** Generate an otpauth:// URI for QR code display. */
export function generateTotpUri(secret: string, email: string): string {
	const label = encodeURIComponent(`fillthehole.ca:${email}`);
	const params = new URLSearchParams({ secret, issuer: 'fillthehole.ca', algorithm: 'SHA1', digits: '6', period: '30' });
	return `otpauth://totp/${label}?${params}`;
}
