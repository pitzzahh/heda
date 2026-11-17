<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getDialog } from './context.js';

	let { children, class: classProp }: { children?: Snippet; class?: string } = $props();

	const dialog = getDialog();

	// Rendered by DialogContent above the scroll area, so nothing is emitted here.
	$effect(() => {
		dialog.header = { children, class: classProp };
		return () => {
			dialog.header = undefined;
		};
	});
</script>
