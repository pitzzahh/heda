<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { DialogVariant } from '#lib/components/ui/dialog/context';
	import { setAlertDialog } from './context';

	let {
		children,
		open = $bindable(false),
		variant = 'default',
		// Deviation from upstream Baby UI: existing callers observe open changes.
		onOpenChange
	}: {
		children?: Snippet;
		open?: boolean;
		variant?: DialogVariant;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	let footer = $state<{ children?: Snippet; class?: string }>();

	setAlertDialog({
		get variant() {
			return variant;
		},
		get footer() {
			return footer;
		},
		set footer(next) {
			footer = next;
		}
	});
</script>

<AlertDialogPrimitive.Root bind:open {onOpenChange}>
	{@render children?.()}
</AlertDialogPrimitive.Root>
