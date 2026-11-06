import { describe, expect, test } from 'vitest';
import { menu } from './menu';
import { anchoredSurface } from './anchored-surface';

describe('menu', () => {
	test('surface carries the anchored surface and padding', () => {
		const surface = menu().surface();
		expect(surface).toContain('border-border');
		expect(surface).toContain('bg-popover');
		expect(surface).toContain('min-w-44');
	});

	test('items fill on highlight and shrink on press', () => {
		const item = menu().item();
		expect(item).toContain('data-[highlighted]:bg-foreground/6');
		expect(item).toContain('active:scale-[var(--press-scale-row)]');
		expect(item).toContain('data-[disabled]:pointer-events-none');
	});

	test('sizes scale the surface and rows', () => {
		expect(menu({ size: 'xs' }).surface()).toContain('min-w-36');
		expect(menu({ size: 'sm' }).surface()).toContain('min-w-40');
		expect(menu({ size: 'lg' }).surface()).toContain('min-w-48');
		expect(menu({ size: 'xl' }).surface()).toContain('min-w-56');
	});

	test('destructive variant tints the item', () => {
		const item = menu({ variant: 'destructive' }).item();
		expect(item).toContain('text-destructive-strong');
		expect(menu().item()).toContain('text-foreground');
	});
});

describe('anchoredSurface', () => {
	test('sizes scale width and padding', () => {
		expect(anchoredSurface({ size: 'xs' }).content()).toContain('w-56');
		expect(anchoredSurface().content()).toContain('w-72');
		expect(anchoredSurface({ size: 'xl' }).content()).toContain('w-96');
		expect(anchoredSurface().surface()).toContain('bg-popover');
	});
});
