<script lang="ts">
	import { getSelectNodesToDeleteState } from '@/hooks/select-nodes-to-delete.svelte';

	let { children } = $props();
	let select_nodes_to_delete_state = getSelectNodesToDeleteState();

	$effect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Shift') select_nodes_to_delete_state.setIsShiftPressed(true);
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === 'Shift') select_nodes_to_delete_state.setIsShiftPressed(false);
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	});
</script>

{@render children?.()}
