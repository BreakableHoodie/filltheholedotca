// src/lib/map/popup.ts
/**
 * Single source of truth for Leaflet popup HTML.
 *
 * Why this exists (GitHub issue #251): the popup template used to be copy-pasted
 * across every render path (initial map bootstrap, the 60s poll's "update an
 * existing marker" branch, and its "create a new marker" branch). Three of the
 * four copies gained a "✓ It's fixed!" button for `reported` potholes; the
 * fourth didn't, so potholes that arrived via the poll rendered with no button
 * until the page was reloaded. Routing every call site through these functions
 * makes that class of drift unrepresentable — there is only one place left to
 * update.
 *
 * Both functions escape `address`/`description` internally via `escapeHtml`
 * before interpolating into the returned HTML string, which is handed to
 * Leaflet's `bindPopup`/`setPopupContent`. Callers must not re-escape or
 * bypass this — it is the only thing standing between user-supplied report
 * text and the popup's innerHTML.
 */
import { STATUS_CONFIG } from '$lib/constants';
import { escapeHtml } from '$lib/escape';
import type { Pothole } from '$lib/types';

function resolveStatusInfo(status: string) {
	return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.reported;
}

function formatAddress(pothole: Pick<Pothole, 'address' | 'lat' | 'lng'>): string {
	return escapeHtml(pothole.address || `${pothole.lat.toFixed(5)}, ${pothole.lng.toFixed(5)}`);
}

/**
 * Public map/homepage popup — used by the initial Leaflet bootstrap and both
 * poll-driven render paths (new marker + existing marker update) in
 * `src/routes/+page.svelte`.
 */
export function buildPotholePopupHtml(pothole: Pothole): string {
	const info = resolveStatusInfo(pothole.status);
	const address = formatAddress(pothole);
	const description = pothole.description ? escapeHtml(pothole.description) : null;
	const detailHref = `/hole/${pothole.id}`;
	const statusNote =
		pothole.status === 'reported'
			? 'Seen this too? Open details to watch it, share it, or report it officially.'
			: pothole.status === 'filled'
				? 'Marked filled by the community. Open details to review the timeline.'
				: 'Archived after no action. Open details if you need the full history.';
	const fixedBtn =
		pothole.status === 'reported'
			? `<button class="popup-fix-btn" data-action="mark-filled" data-pothole-id="${pothole.id}">✓ It's fixed!</button>`
			: '';

	return `<div class="popup-content">
		<div class="popup-header">
			<strong>${address}</strong>
			<span class="popup-status popup-status--${pothole.status}">${info.label}</span>
		</div>
		${description ? `<em class="popup-desc">${description}</em>` : ''}
		<p class="popup-note">${statusNote}</p>
		<div class="popup-actions">
			<a href="${detailHref}" class="popup-primary-link">Open details</a>
			<button class="popup-secondary-btn" data-action="share-link" data-pothole-id="${pothole.id}">Share or copy link</button>
			${fixedBtn}
		</div>
	</div>`;
}

/**
 * Admin map popup — used by `src/routes/admin/map/+page.svelte`. Kept separate
 * from `buildPotholePopupHtml` rather than branched: it links to the admin
 * moderation route instead of the public detail page, surfaces
 * `confirmed_count`/`filled_at` for moderators, and has no "It's fixed!"
 * button or share action, so folding it into one function would trade the
 * drift risk this module exists to remove for a pile of `isAdmin` branches.
 */
export function buildAdminPotholePopupHtml(pothole: Pothole): string {
	const info = resolveStatusInfo(pothole.status);
	const address = formatAddress(pothole);
	const description = pothole.description ? escapeHtml(pothole.description) : null;
	const manageHref = `/admin/potholes/${pothole.id}`;
	const statusLabel = info.label;

	return `<div class="popup-content">
		<div class="popup-header">
			<strong>${address}</strong>
		</div>
		<p style="margin:2px 0 4px;font-size:11px;color:#52525b">
			<span class="popup-status popup-status--${pothole.status}">${statusLabel}</span>
			<span style="margin-left:6px">${pothole.confirmed_count} conf.</span>
		</p>
		${description ? `<em style="display:block;margin-bottom:4px;font-size:12px;color:#52525b">${description}</em>` : ''}
		<p style="font-size:11px;color:#71717a;margin:0 0 6px">
			${new Date(pothole.created_at).toLocaleDateString()}
			${pothole.filled_at ? `· Filled ${new Date(pothole.filled_at).toLocaleDateString()}` : ''}
		</p>
		<a href="${manageHref}" class="popup-primary-link" style="display:block;text-align:center">Manage →</a>
	</div>`;
}
