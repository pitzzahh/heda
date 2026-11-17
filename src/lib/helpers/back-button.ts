// The Android back button. Once the app listens for it, Android does nothing
// on its own (no history step, no exit), so every case is decided here. The
// history step it would take is not safe: it can land on the home page, which
// drops the open project without the unsaved-changes prompt.

/** What a back press does. */
export type BackPlan = 'close_layer' | 'leave_project' | 'go_home' | 'exit';

export function planBackAction(input: {
	layer_open: boolean;
	pathname: string;
	home_path: string;
	workspace_path: string;
}): BackPlan {
	if (input.layer_open) return 'close_layer';
	if (input.pathname === input.home_path) return 'exit';
	const in_workspace =
		input.pathname === input.workspace_path ||
		input.pathname.startsWith(`${input.workspace_path}/`);
	return in_workspace ? 'leave_project' : 'go_home';
}

// bits-ui marks every open layer this way: dialog, alert dialog, sheet, popover, menu, select.
const OPEN_LAYER =
	'[data-state="open"]:is([role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"])';

export function hasOpenLayer(root: ParentNode): boolean {
	return root.querySelector(OPEN_LAYER) !== null;
}

/** Closes the top layer the way the Escape key does: bits-ui listens for it on the document. */
export function closeTopLayer(doc: Document): void {
	doc.dispatchEvent(
		new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
	);
}
