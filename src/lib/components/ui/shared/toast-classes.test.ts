import { describe, expect, test } from 'vitest';
import { TOAST_CLASSES } from './toast-classes';

// Regression: the title used `truncate` and the description `line-clamp-2`, cutting
// toast content off with an ellipsis. Both wrap now.
describe('TOAST_CLASSES', () => {
	test('title and description wrap instead of clipping', () => {
		expect(TOAST_CLASSES.title).toContain('wrap-break-word');
		expect(TOAST_CLASSES.description).toContain('wrap-break-word');
		expect(TOAST_CLASSES.title).not.toContain('truncate');
		expect(TOAST_CLASSES.title).not.toContain('line-clamp');
		expect(TOAST_CLASSES.description).not.toContain('truncate');
		expect(TOAST_CLASSES.description).not.toContain('line-clamp');
	});

	test('toast keeps its grid layout and icon tints', () => {
		expect(TOAST_CLASSES.toast).toContain('grid');
		expect(TOAST_CLASSES.toast).toContain(
			'[&[data-type=error]_[data-icon]]:text-destructive-strong'
		);
		expect(TOAST_CLASSES.toast).toContain('[&[data-type=success]_[data-icon]]:text-success-strong');
	});
});
