# Incident Response Playbook — fillthehole.ca

This document covers security incidents and privacy breaches for fillthehole.ca.
It is the authoritative reference for PIPEDA breach notification obligations and
step-by-step containment procedures.

---

## Quick Reference — First 5 Minutes

```
1. Rotate or revoke the affected secret/credential immediately (see §4)
2. Determine if personal information was exposed (see §2)
3. If yes, assess Real Risk of Significant Harm (see §3)
4. If RROSH: report to OPC within 72 hours of determination (see §5)
5. Open an incident record in a private doc/note (see §7)
```

---

## 1. What Counts as a Security Incident

Any of the following triggers this playbook:

- A secret key (`.env` var) is committed to git, logged, or otherwise exposed
- Unauthorized access to the Supabase project, storage bucket, or admin panel
- An admin account credential is compromised (password leak, session theft)
- A dependency vulnerability allows data extraction or RCE
- Evidence of unexpected data access in Supabase logs or Netlify access logs
- A pothole photo is served publicly before admin moderation approval
- Any situation where personal information may have been accessed by an
  unauthorized party

---

## 2. Personal Information Inventory

Understanding what was potentially exposed is required to assess harm.

| Data | Where stored | Sensitivity | Notes |
|------|-------------|-------------|-------|
| IP address hashes | `pothole_confirmations`, `pothole_photos`, `api_rate_limit_events`, `admin_auth_attempts`, `admin_audit_log`, `admin_sessions`, `admin_trusted_devices` | Medium | HMAC-SHA-256; reversible only if `IP_HASH_SECRET` is also exposed |
| Push subscription endpoints + keys | `push_subscriptions` | Medium | Device-specific; attacker with VAPID private key can push arbitrary notifications |
| Pothole photos | Supabase Storage (`pothole-photos` bucket) | Medium–High | EXIF stripped server-side, but photo content may be identifiable (faces, vehicles, property) |
| Admin email addresses | `admin_users` | Low–Medium | Small set; not public user data |
| Admin password hashes | `admin_users` | Medium | PBKDF2; not plaintext, but exposed hashes are brute-forceable offline |
| Admin TOTP secrets | `admin_users.totp_secret` | High | AES-GCM encrypted; reversible if `TOTP_ENCRYPTION_KEY` is also exposed |
| User-agent strings | `admin_sessions`, `admin_trusted_devices`, `admin_auth_attempts` | Low | Device fingerprinting risk only |
| Pothole location + description | `potholes` | Low | Public data by design; coords rounded to ~11 m |

**Public users submit no account data.** There is no email, name, or profile linked
to a report. The only personal information from public users is the hashed IP address
and any submitted photo.

---

## 3. PIPEDA — Real Risk of Significant Harm (RROSH) Assessment

Under PIPEDA's Breach of Security Safeguards Regulations, you must report to the
OPC (and notify affected individuals) if the breach creates a **real risk of
significant harm**. RROSH is assessed by the sensitivity of the information and
the probability a malicious actor could use it to cause harm.

### RROSH = YES — report to OPC

| Trigger | Why |
|---------|-----|
| `IP_HASH_SECRET` exposed | Attacker can reverse all stored ip_hash values to real IP addresses. IP addresses are personal information under PIPEDA. All users who reported, confirmed, or uploaded a photo are affected. |
| `SUPABASE_SERVICE_ROLE_KEY` exposed (with evidence of access) | Full read access to all tables and storage. Scope includes push subscriptions, photos, and all ip_hash rows. |
| `TOTP_ENCRYPTION_KEY` exposed alongside admin TOTP secrets | Admin TOTP secrets are decryptable → account takeover risk. Limited to admin accounts, but severity is high. |
| Push subscriptions accessed + `VAPID_PRIVATE_KEY` exposed | Attacker can send arbitrary push notifications to all subscribed devices; endpoints also enable device fingerprinting. |
| Unmoderated photo served publicly containing identifiable content | Photo content (faces, licence plates) disclosed without consent. |

### RROSH = PROBABLY NOT — record, no OPC report required

| Trigger | Why |
|---------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` exposed, no evidence of access | Immediate rotation; assess access logs before closing. Record the breach for 24 months. |
| `ADMIN_SESSION_SECRET` or `ADMIN_BOOTSTRAP_SECRET` exposed | CSRF forgery risk but no personal data directly exposed. Invalidate all admin sessions. |
| `SIGHTENGINE_*` keys exposed | Third-party moderation API; no personal data stored server-side by this integration. |
| `PUSHOVER_*` keys exposed | Notification sending only; no personal data exposed. |
| Admin password hash for a single account exposed | Offline brute-force risk only. Rotate credential, record breach. |

**When in doubt, report.** The OPC is not punitive about over-reporting. The cost
of failing to report when RROSH exists is much higher.

---

## 4. Secret Inventory and Rotation Procedures

Rotate in this order (most critical first):

### `IP_HASH_SECRET`
- **Impact if exposed**: All stored ip_hash values become reversible to real IPs.
- **Rotate**: Generate a new 32-byte hex secret → update Netlify env var → redeploy.
- **Note**: After rotation, all existing ip_hash values are no longer valid for dedup.
  New hashes will not match old hashes for the same IP. This is acceptable; the
  old hashed data should be considered personal information and noted in the incident record.

### `SUPABASE_SERVICE_ROLE_KEY`
- **Impact if exposed**: Full DB and storage read/write.
- **Rotate**: Supabase dashboard → Settings → API → Regenerate service role key →
  update Netlify env var → redeploy.
- **After rotation**: Audit Supabase logs for unexpected queries in the exposure window.

### `TOTP_ENCRYPTION_KEY`
- **Impact if exposed**: Admin TOTP secrets decryptable → bypass MFA.
- **Rotate**: Generate new 32-byte hex key → update Netlify env var → redeploy.
  All admins must re-enroll TOTP (existing encrypted secrets are useless with the new key).
- **Action**: Force-invalidate all admin sessions and MFA challenges after rotation.

### `ADMIN_SESSION_SECRET`
- **Impact if exposed**: Attacker can forge valid CSRF tokens for any session.
- **Rotate**: Generate new 32-byte hex secret → update Netlify env var → redeploy.
  All existing CSRF tokens are immediately invalidated → admins re-login.

### `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` / `PUBLIC_VAPID_PUBLIC_KEY`
- **Impact if exposed**: Attacker can push arbitrary notifications to all subscribers.
- **Rotate**: Generate new VAPID key pair → update all three env vars → redeploy.
  Existing push subscriptions are no longer valid (tied to the old public key); users
  must re-subscribe. This means push notification delivery will silently fail until
  users revisit the site.

### `BLUESKY_APP_PASSWORD`
- **Impact if exposed**: Attacker can post as the bot account.
- **Rotate**: Bluesky settings → App Passwords → revoke + generate new.

### `SIGHTENGINE_API_SECRET`
- **Impact if exposed**: Attacker can use the moderation quota.
- **Rotate**: SightEngine dashboard → regenerate → update Netlify env var.

---

## 5. PIPEDA Notification Obligations

### Reporting to the OPC

**When**: As soon as feasible after determining RROSH — target **72 hours** from
the point you conclude personal information was exposed with RROSH.

**How**: Online report form at the OPC:
`https://www.priv.gc.ca/en/report-a-concern/file-a-formal-privacy-complaint/file-a-privacy-breach-report/`

**What to include**:
- Date the breach was discovered and (if known) when it occurred
- Description of the personal information involved
- Number of individuals affected (or best estimate)
- Steps taken to contain the breach
- Whether individuals have been notified or why not yet

### Notifying Affected Individuals

**When**: As soon as feasible after OPC notification (may be concurrent).

**Who**: Every individual whose personal information was involved in the breach
where RROSH applies.

**Challenge for this app**: Public users are anonymous — there is no email address
to reach them. Practicable notification options:
1. **Site banner** on fillthehole.ca for 30+ days describing the breach and steps taken
2. **Push notification** to subscribed devices (if push infrastructure is intact)
3. **OPC guidance** — contact the OPC if anonymous user notification is not practicable;
   they may accept public posting as sufficient

The notification must be in plain language and include: a description of what happened,
what personal information was involved, steps taken to reduce harm, and a contact point
for questions.

### Record Keeping

**All breaches** — regardless of RROSH — must be recorded and retained for **at least 24 months**
from the date the organization determines that a breach has occurred.

Maintain a private breach log (not in the public repo) with:
- Date of breach / Date of discovery
- Description of what happened
- Personal information involved
- Number of individuals affected
- RROSH determination and reasoning
- Steps taken (rotation, notification, OPC report)
- OPC reference number (if reported)

---

## 6. Response Timeline

### 0–1 Hour: Contain

- [ ] Rotate / revoke the affected secret(s) (see §4)
- [ ] Redeploy to ensure rotated secrets are live
- [ ] Invalidate admin sessions if admin infrastructure was involved:
  ```sql
  -- Run in Supabase SQL editor (service role)
  delete from admin_sessions;
  delete from admin_mfa_challenges;
  delete from admin_trusted_devices;
  ```
- [ ] Check Supabase logs for unexpected access during the exposure window
- [ ] Check Netlify access logs for unexpected traffic patterns
- [ ] Open a private incident record (date, what happened, what was rotated)

### 1–24 Hours: Assess

- [ ] Determine the exposure window (when did the leak start? when was it closed?)
- [ ] Identify what personal information was within reach
- [ ] Assess RROSH (see §3)
- [ ] If RROSH: begin drafting OPC report
- [ ] If photos may have been accessed without moderation: identify which potholes
  and document photo content

### 24–72 Hours: Notify

- [ ] Submit OPC report if RROSH (target: within 72 hours of RROSH determination)
- [ ] Post site banner if public user notification is required
- [ ] Send push notification to subscribed devices if applicable
- [ ] Document OPC reference number in breach log

### Ongoing: Review

- [ ] Post-incident review within 7 days (see §8)
- [ ] Update this playbook if gaps were found
- [ ] Maintain breach record for 24 months

---

## 7. Notification Templates

### OPC Report (adapt to facts)

> **Breach description**: On [date], [the secret X / a misconfiguration] caused [personal
> information type] belonging to approximately [N] individuals to be exposed to
> [unauthorized party / unknown parties]. The exposure window was [start] to [end].
>
> **Personal information involved**: [IP address hashes reversible to real IP addresses /
> push subscription endpoints and keys / pothole photo content / other].
>
> **Steps taken**: The affected secret was rotated at [time]. [Additional mitigations].
> Affected individuals have been / will be notified via [method].
>
> **Contact**: [your name and contact email]

### Site Banner (public user notification)

> **Security notice — [Month Year]**: We recently discovered that [brief plain-language
> description]. We have taken the following steps: [rotation, mitigation]. If you
> reported a pothole, confirmed a report, or uploaded a photo to fillthehole.ca
> [during / before] [date], your [IP address / device subscription / other] may have
> been involved. We have [rotated keys / notified the OPC / other]. For questions,
> contact [contact address]. We are sorry for this incident.

---

## 8. Post-Incident Review

Within 7 days of closing the incident, document:

1. **Root cause**: How did this happen? (committed secret, misconfigured access, etc.)
2. **Detection**: How was it found? How long did it take?
3. **Response gaps**: What was slow or unclear in this playbook?
4. **Preventive action**: What change prevents recurrence?

Update CLAUDE.md, this playbook, or the codebase as appropriate.

---

## 9. Contacts

- **OPC Privacy Breach Report**: https://www.priv.gc.ca/en/report-a-concern/file-a-formal-privacy-complaint/file-a-privacy-breach-report/
- **OPC General**: 1-800-282-1376 / info@priv.gc.ca
- **Supabase support**: https://supabase.com/support
- **Netlify support**: https://www.netlify.com/support/
