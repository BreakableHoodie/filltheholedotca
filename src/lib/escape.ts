/**
 * Escape HTML metacharacters in a user-supplied string so it is safe to
 * interpolate into an innerHTML context (e.g. Leaflet bindPopup).
 *
 * We intentionally escape to plain text (no HTML allowed through) rather
 * than using a sanitiser like DOMPurify, which would permit some tags.
 * The five characters below cover all HTML injection vectors in attribute
 * values and text nodes.
 */
export function escapeHtml(str: string): string {
	return str.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c] ?? c
	);
}

/**
 * Decode a narrow set of HTML entities used by older write-time sanitization.
 * This restores human-readable strings; escaping must still happen at render time.
 */
export function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}
