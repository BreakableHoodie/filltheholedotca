# Database Backup Strategy

This document describes how fillthehole.ca's data is backed up, how to verify backups are working, and how to restore from them.

---

## What needs backing up

| Data | Location | Criticality |
| ---- | -------- | ----------- |
| Pothole reports, confirmations, photos metadata | Supabase Postgres | High |
| Photo files | Supabase Storage bucket `pothole-photos` | Medium |
| Admin users, sessions, TOTP secrets | Supabase Postgres | High |
| Site settings | Supabase Postgres | Low |

Code and schema are version-controlled in git. Only the Supabase Postgres database and Storage bucket need backup procedures.

---

## Automated backups — Supabase

### Free / Pro tier

Supabase takes **daily automated backups** on all projects. These are retained for:

- **Free tier**: 1 day
- **Pro tier**: 7 days
- **Pro + PITR add-on**: Point-in-time recovery up to 30 days

To verify automated backups are running:

1. Go to [app.supabase.com](https://app.supabase.com) → select your project.
2. Navigate to **Project Settings → Backups**.
3. Confirm the latest backup timestamp is within the last 24 hours.
4. Review the retention policy matches your plan.

**Recommendation**: Upgrade to the Pro tier (or enable PITR) if the free tier's 1-day retention is insufficient. At the current scale of fillthehole.ca, the Pro 7-day window is adequate.

---

## Manual backups — pg_dump

Run a manual backup before any schema migration or risky operation.

### Prerequisites

```bash
# Install psql client tools if not present
brew install postgresql   # macOS
apt install postgresql-client  # Debian/Ubuntu
```

Get your connection string from **Supabase → Project Settings → Database → Connection string → URI**.

### Full database dump

```bash
pg_dump \
  "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="fillthehole_$(date +%Y%m%d_%H%M%S).dump"
```

The `--format=custom` flag produces a compressed binary dump that `pg_restore` can apply selectively.

### Schema-only dump (for migrations)

```bash
pg_dump \
  "postgresql://..." \
  --schema-only \
  --no-owner \
  --no-acl \
  --file="fillthehole_schema_$(date +%Y%m%d).sql"
```

### Store backups safely

- Do **not** commit dumps to the git repository — they may contain PII (hashed IPs, addresses, descriptions).
- Store in an encrypted location (e.g., a private Supabase bucket, an encrypted S3 bucket, or 1Password file vault).
- Retain at least 3 copies: local, offsite, and Supabase's own automated backup.

---

## Restoring from backup

### From Supabase dashboard (automated backup)

1. Go to **Project Settings → Backups**.
2. Select the restore point.
3. Click **Restore** — this replaces the entire database.
4. Re-run any migrations that postdate the restore point (check `schema_migrations` table).

### From a pg_dump file

```bash
# Restore to an existing (empty) database
pg_restore \
  --no-owner \
  --no-acl \
  --dbname="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres" \
  fillthehole_20260101_000000.dump
```

If restoring to a database that still has data, add `--clean` to drop existing objects first:

```bash
pg_restore --clean --no-owner --no-acl --dbname="..." fillthehole_20260101_000000.dump
```

### Post-restore checklist

- [ ] Verify row counts in `potholes`, `pothole_confirmations`, `pothole_photos`
- [ ] Confirm `site_settings` contains the expected `confirmation_threshold`
- [ ] Re-run any schema migrations applied after the backup date
- [ ] Smoke-test report submission and admin login
- [ ] Verify pg_cron jobs are still scheduled: `SELECT * FROM cron.job;`

---

## Storage bucket backups (photos)

Supabase Storage does **not** offer point-in-time restore at the file level. To back up photo files:

```bash
# Install supabase CLI
npm install -g supabase

# Download all objects from the bucket (requires service role key)
supabase storage cp \
  --project-ref "[your-project-ref]" \
  ss:///pothole-photos \
  ./backup/pothole-photos/
```

Or use the Supabase Management API to list and download objects programmatically.

**Frequency**: Photos are immutable once uploaded — a weekly backup is sufficient.

---

## Recovery Time Objectives

| Scenario | Target |
| -------- | ------ |
| Full DB restore from Supabase backup | < 30 minutes |
| Full DB restore from pg_dump | < 1 hour |
| Partial restore (single table) | < 2 hours |
| Photo files restore | < 4 hours |

---

## Verification schedule

Run these checks monthly:

1. **Confirm latest automated backup** — check the Supabase dashboard timestamp.
2. **Restore test** — spin up a Supabase branch project, restore the latest dump, run the post-restore checklist above.
3. **Row count sanity** — compare `SELECT COUNT(*) FROM potholes` against last month's count to confirm no silent data loss.

```sql
-- Quick counts for sanity check
SELECT
  (SELECT COUNT(*) FROM potholes) AS potholes,
  (SELECT COUNT(*) FROM pothole_confirmations) AS confirmations,
  (SELECT COUNT(*) FROM pothole_photos) AS photos,
  (SELECT COUNT(*) FROM admin_users) AS admins;
```
