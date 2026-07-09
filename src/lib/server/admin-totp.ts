import { generateSecret, generateURI, verify } from "otplib";

/** Generate a new base32-encoded TOTP secret. */
export async function generateTotpSecret(): Promise<string> {
  return generateSecret();
}

/** Verify a TOTP code or backup code against a secret. */
export async function verifyTotpCode(
  secret: string,
  code: string,
): Promise<boolean> {
  const result = await verify({ secret, token: code });
  return result.valid;
}

/** Generate an otpauth:// URI for QR code display. */
export function generateTotpUri(secret: string, email: string): string {
  return generateURI({
    secret,
    issuer: "fillthehole.ca",
    label: `fillthehole.ca:${email}`,
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });
}
