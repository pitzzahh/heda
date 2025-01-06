<script lang="ts">
	import { getSelectNodesToDeleteState } from '@/hooks/select-nodes-to-delete.svelte';

	let { children } = $props();
	let select_nodes_to_delete_state = getSelectNodesToDeleteState();

	$effect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Alt') select_nodes_to_delete_state.setIsAltPressed(true);
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === 'Alt') select_nodes_to_delete_state.setIsAltPressed(false);
		};

		const handleWindowFocus = () => {
			select_nodes_to_delete_state.setIsAltPressed(false);
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		window.addEventListener('focus', handleWindowFocus);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
			window.removeEventListener('focus', handleWindowFocus);
		};
	});
</script>

{@render children?.()}
