/**
 * Phones and tablets (below lg, where modals become drawers). Nothing autofocuses
 * there: focusing a field pops the on-screen keyboard over the drawer.
 */
export function isCompactViewport(): boolean {
	// Optional: no matchMedia during prerender or in jsdom.
	return globalThis.matchMedia?.('(max-width: 1023px)').matches ?? false;
}
