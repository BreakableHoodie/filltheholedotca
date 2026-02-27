import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';
import { writeAuditLog } from '$lib/server/admin-auth';
import { hashIp } from '$lib/hash';
import {
	encryptTotpSecret,
	decryptTotpSecret,
	generateBackupCodes,
	hashBackupCode,
	verifyBackupCode
} from '$lib/server/admin-crypto';
import { generateTotpSecret, verifyTotpCode, generateTotpUri } from '$lib/server/admin-totp';

const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.adminUser) throw error(401, 'Unauthorized');
	// Re-fetch totp_enabled fresh so UI reflects DB state, not session cache
	const { data: user } = await adminSupabase
		.from('admin_users')
		.select('totp_enabled')
		.eq('id', locals.adminUser.id)
		.single();

	return { totpEnabled: user?.totp_enabled ?? false };
};

// ---------------------------------------------------------------------------
// Form actions — all operate on the currently logged-in user only
// ---------------------------------------------------------------------------

export const actions: Actions = {
	// Step 1: generate secret, return encrypted blob + display info
	initMfa: async ({ locals }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		if (locals.adminUser.totpEnabled) return fail(400, { error: 'MFA is already enabled' });

		const secret = await generateTotpSecret();
		const encrypted = await encryptTotpSecret(secret);
		const totpUri = generateTotpUri(secret, locals.adminUser.email);

		return { pendingSetup: true as const, encryptedSecret: encrypted, displaySecret: secret, totpUri };
	},

	// Step 2: confirm 6-digit code, save encrypted secret + backup codes
	confirmMfa: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		if (locals.adminUser.totpEnabled) return fail(400, { error: 'MFA is already enabled' });

		const fd = await request.formData();
		const encryptedSecret = fd.get('encryptedSecret')?.toString() ?? '';
		const code = fd.get('code')?.toString().replace(/\s/g, '') ?? '';

		if (!/^\d{6}$/.test(code)) return fail(400, { error: 'Enter a 6-digit code', pendingSetup: true as const, encryptedSecret });

		let secret: string;
		try {
			secret = await decryptTotpSecret(encryptedSecret);
		} catch {
			return fail(400, { error: 'Setup session expired. Please start again.' });
		}

		const valid = await verifyTotpCode(secret, code);
		if (!valid) {
			return fail(400, {
				error: 'Invalid code — check the time on your authenticator and try again.',
				pendingSetup: true as const,
				encryptedSecret,
				displaySecret: secret,
				totpUri: generateTotpUri(secret, locals.adminUser.email)
			});
		}

		// Generate and hash backup codes
		const plainCodes = generateBackupCodes();
		const hashedCodes = await Promise.all(plainCodes.map(hashBackupCode));

		const { error: dbErr } = await adminSupabase
			.from('admin_users')
			.update({
				totp_enabled: true,
				totp_secret: encryptedSecret,
				backup_codes: JSON.stringify(hashedCodes)
			})
			.eq('id', locals.adminUser.id);

		if (dbErr) return fail(500, { error: 'Failed to enable MFA. Please try again.' });

		await writeAuditLog(
			locals.adminUser.id,
			'user.mfa_enabled',
			'user',
			locals.adminUser.id,
			null,
			await hashIp(getClientAddress())
		);

		return { confirmed: true as const, backupCodes: plainCodes };
	},

	// Disable MFA — requires TOTP code (or backup code)
	disableMfa: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		if (!locals.adminUser.totpEnabled) return fail(400, { error: 'MFA is not enabled' });

		const code = (await request.formData()).get('code')?.toString().replace(/\s/g, '') ?? '';
		if (!code) return fail(400, { error: 'Enter your TOTP or backup code' });

		const { data: user } = await adminSupabase
			.from('admin_users')
			.select('totp_secret, backup_codes')
			.eq('id', locals.adminUser.id)
			.single();

		if (!user?.totp_secret) return fail(400, { error: 'MFA not configured' });

		const secret = await decryptTotpSecret(user.totp_secret);
		let valid = await verifyTotpCode(secret, code);

		if (!valid && user.backup_codes) {
			const hashes = JSON.parse(user.backup_codes) as string[];
			const result = await verifyBackupCode(code, hashes);
			valid = result.valid;
		}

		if (!valid) return fail(400, { error: 'Invalid code' });

		const { error: dbErr } = await adminSupabase
			.from('admin_users')
			.update({ totp_enabled: false, totp_secret: null, backup_codes: null })
			.eq('id', locals.adminUser.id);

		if (dbErr) return fail(500, { error: 'Failed to disable MFA' });

		await writeAuditLog(
			locals.adminUser.id,
			'user.mfa_disabled',
			'user',
			locals.adminUser.id,
			null,
			await hashIp(getClientAddress())
		);

		return { disabled: true as const };
	},

	// Regenerate backup codes — requires current TOTP code
	regenBackupCodes: async ({ request, locals, getClientAddress }) => {
		if (!locals.adminUser) throw error(401, 'Unauthorized');
		if (!locals.adminUser.totpEnabled) return fail(400, { error: 'MFA not enabled' });

		const code = (await request.formData()).get('code')?.toString().replace(/\s/g, '') ?? '';
		if (!/^\d{6}$/.test(code)) return fail(400, { error: 'Enter a 6-digit TOTP code' });

		const { data: user } = await adminSupabase
			.from('admin_users')
			.select('totp_secret')
			.eq('id', locals.adminUser.id)
			.single();

		if (!user?.totp_secret) return fail(400, { error: 'MFA not configured' });

		const secret = await decryptTotpSecret(user.totp_secret);
		const valid = await verifyTotpCode(secret, code);
		if (!valid) return fail(400, { error: 'Invalid TOTP code' });

		const plainCodes = generateBackupCodes();
		const hashedCodes = await Promise.all(plainCodes.map(hashBackupCode));

		const { error: dbErr } = await adminSupabase
			.from('admin_users')
			.update({ backup_codes: JSON.stringify(hashedCodes) })
			.eq('id', locals.adminUser.id);

		if (dbErr) return fail(500, { error: 'Failed to regenerate backup codes' });

		await writeAuditLog(
			locals.adminUser.id,
			'user.backup_codes_regenerated',
			'user',
			locals.adminUser.id,
			null,
			await hashIp(getClientAddress())
		);

		return { newBackupCodes: plainCodes };
	}
};
