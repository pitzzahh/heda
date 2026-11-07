<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { type DialogMotion, type DialogSize, type DialogVariant, setDialog } from './context.js';

	let {
		children,
		open = $bindable(false),
		motion = 'zoom',
		size = 'default',
		variant = 'default',
		dismissOnBackdrop = true,
		// Deviation from upstream Baby UI: existing callers observe open changes.
		onOpenChange
	}: {
		children?: Snippet;
		open?: boolean;
		motion?: DialogMotion;
		size?: DialogSize;
		variant?: DialogVariant;
		dismissOnBackdrop?: boolean;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	let footer = $state<{ children?: Snippet; class?: string }>();

	setDialog({
		get motion() {
			return motion;
		},
		get size() {
			return size;
		},
		get variant() {
			return variant;
		},
		get dismissOnBackdrop() {
			return dismissOnBackdrop;
		},
		get footer() {
			return footer;
		},
		set footer(next) {
			footer = next;
		}
	});
</script>

<DialogPrimitive.Root bind:open {onOpenChange}>
	{@render children?.()}
</DialogPrimitive.Root>
