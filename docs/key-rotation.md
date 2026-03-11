# Key Rotation Runbook

This document describes how to rotate each secret used by fillthehole.ca without downtime.

---

## Secrets Overview

| Variable                    | Purpose                             | Algorithm      | Rotation impact                                                                                                           |
| --------------------------- | ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `IP_HASH_SECRET`            | HMAC-SHA-256 for IP hashing         | HMAC-SHA-256   | Breaks IP dedup; all hashed IPs change meaning                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role DB access              | JWT (Supabase) | Invalidates server-side DB calls until new key is live                                                                    |
| `TOTP_ENCRYPTION_KEY`       | AES-GCM encryption of TOTP secrets  | AES-256-GCM    | All existing TOTP secrets become unreadable; MFA breaks                                                                   |
| `ADMIN_SESSION_SECRET`      | HMAC-SHA-256 for CSRF token signing | HMAC-SHA-256   | Invalidates all CSRF tokens; active admins get CSRF failures on next state-changing request (recoverable by page refresh) |

---

## IP_HASH_SECRET

**What it protects**: All IP-based deduplication (reports, confirmations, fills, rate limits). The raw IP is never stored; only the HMAC-SHA-256 hash.

**Impact of rotation**: All existing `ip_hash` values in `pothole_confirmations`, `pothole_actions`, `api_rate_limit_events`, `admin_auth_attempts`, `admin_sessions`, and `admin_audit_log` become stale — they no longer correspond to any future request. Rate-limit counters reset, and IP-based dedup stops blocking previously-seen IPs.

**Procedure**:

1. Generate a new 32-byte hex secret:

   ```bash
   openssl rand -hex 32
   ```

2. Set the new value in your Netlify environment variables (`IP_HASH_SECRET`).
3. Trigger a new deploy. The new secret takes effect immediately on the next request.
4. No DB cleanup required — stale hashes are inert (they simply never match again).
5. Document the rotation date in your internal security log.

**When to rotate**: If the secret is suspected compromised, or as part of a scheduled annual rotation. Not required after a DB breach (hashes alone reveal nothing without the secret).

---

## SUPABASE_SERVICE_ROLE_KEY

**What it protects**: Server-side writes that bypass RLS (photo inserts, admin operations, RPCs).

**Impact of rotation**: In-flight requests using the old key will fail immediately after Supabase invalidates it.

**Procedure**:

1. In the Supabase dashboard → **Settings → API**, generate a new service role key.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Netlify environment variables.
3. Trigger a new deploy.
4. Invalidate the old key in Supabase immediately after confirming the new deploy is healthy.
5. Verify with a test admin login and a photo upload to confirm service-role operations work.

**Note**: The public anon key (`PUBLIC_SUPABASE_ANON_KEY`) can be rotated independently the same way — it is less sensitive (RLS-constrained) but should still be rotated if exposed.

---

## TOTP_ENCRYPTION_KEY

**What it protects**: TOTP secrets stored in `admin_users.totp_secret` (AES-256-GCM encrypted).

**Impact of rotation**: **All existing TOTP secrets become unreadable.** Every admin with TOTP enabled will be unable to log in until their TOTP secret is re-enrolled.

**Procedure** (requires maintenance window or coordinated admin availability):

1. Generate a new 32-byte hex key:

   ```bash
   openssl rand -hex 32
   ```

2. Before deploying, write a one-off Node.js/TypeScript migration script that re-encrypts all existing TOTP secrets.

   **Important**: Do **not** call `decryptTotpSecret`/`encryptTotpSecret` directly — both functions load from `env.TOTP_ENCRYPTION_KEY` and cache a single `CryptoKey` for the process lifetime. They cannot hold two keys simultaneously, so you cannot use them to decrypt with the old key and re-encrypt with the new key in the same process.

   Instead, implement the migration using the Web Crypto API directly with two explicit keys:
   - Import the old hex key as an AES-GCM `CryptoKey` with `['decrypt']` usage.
   - Import the new hex key as an AES-GCM `CryptoKey` with `['encrypt']` usage.
   - For each `admin_users` row where `totp_secret IS NOT NULL`:
     - Parse the stored format (`iv_hex:ciphertext_hex`) — see `src/lib/server/admin-crypto.ts` for the format.
     - Decrypt the ciphertext with the old key and the stored IV.
     - Re-encrypt the plaintext with the new key and a fresh random IV.
     - `UPDATE admin_users SET totp_secret = new_ciphertext WHERE id = ...`
   - Verify the row count matches before proceeding.

   Run the migration against the live DB **before** updating the env var and deploying.

3. After all rows are re-encrypted, update `TOTP_ENCRYPTION_KEY` in Netlify and deploy.
4. Verify at least one admin MFA login succeeds before logging off.

**If rotation is required urgently** (e.g. key compromise):

1. Disable TOTP for all admins (`UPDATE admin_users SET totp_enabled = false, totp_secret = null`).
2. Deploy the new key immediately.
3. Require all admins to re-enroll TOTP via the admin settings page.

---

## ADMIN_SESSION_SECRET

**What it protects**: HMAC-SHA-256 key used to sign CSRF tokens (double-submit cookie pattern). The CSRF token for a session is `HMAC-SHA-256(sessionId, ADMIN_SESSION_SECRET)` — binding the token to the session ID prevents CSRF bypass even if cookies are stolen. See `src/lib/server/admin-csrf.ts`.

**Impact of rotation**: All existing CSRF tokens become invalid. Active admins will receive CSRF validation failures on their next POST/PATCH/DELETE request. This is recoverable — a page refresh triggers a new session validation, which issues a fresh CSRF token signed with the new key. Sessions themselves are not invalidated; no one is logged out.

**Procedure**:

1. Generate a new secret (minimum 32 bytes of entropy):

   ```bash
   openssl rand -hex 32
   ```

2. Update `ADMIN_SESSION_SECRET` in Netlify environment variables.
3. Trigger a new deploy.
4. Notify active admins they may see one CSRF error on their next action — a page refresh resolves it.

---

## Admin Session Invalidation (no secret rotation required)

Sessions are stored as opaque UUIDs in `admin_sessions` and validated by DB lookup. There is no HMAC signing of session IDs — the session ID is the credential. Invalidating sessions is a DB operation only.

**To force all admins to re-authenticate**:

```sql
DELETE FROM admin_sessions;
```

**To invalidate sessions for one user**:

```sql
DELETE FROM admin_sessions WHERE user_id = '<uuid>';
```

---

## Backup Code Hashes

Backup codes are PBKDF2-hashed with a random per-code salt stored alongside the hash (`admin_users.backup_codes`). They are self-contained — no shared secret is involved. No rotation action needed unless the DB itself is compromised, in which case force admins to regenerate backup codes via the admin settings page.

---

## Trusted Device Tokens (`admin_trusted_devices`)

Token SHA-256 hashes stored in DB; raw values in client cookies. Rotation:

```sql
-- Invalidate all trusted devices (forces MFA on next login for all admins):
DELETE FROM admin_trusted_devices;

-- Invalidate for one user:
DELETE FROM admin_trusted_devices WHERE user_id = '<uuid>';
```

No secret rotation — these are high-entropy random tokens, not HMAC-derived.

---

## Rotation Schedule

| Secret                      | Recommended interval            | Trigger immediately if...                   |
| --------------------------- | ------------------------------- | ------------------------------------------- |
| `IP_HASH_SECRET`            | Annual                          | DB or server env suspected compromised      |
| `SUPABASE_SERVICE_ROLE_KEY` | 6 months or on personnel change | Key exposed in logs, PRs, or error messages |
| `TOTP_ENCRYPTION_KEY`       | On key compromise only          | DB dump obtained by attacker                |
| `ADMIN_SESSION_SECRET`      | Annual or on personnel change   | Key exposed in logs or error messages       |
| Admin sessions (DB)         | As needed                       | Admin account compromised                   |
