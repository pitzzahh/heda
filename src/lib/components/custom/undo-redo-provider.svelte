<script lang="ts">
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';

	let { children } = $props();
	let undo_redo_state = getUndoRedoState();

	function handleKeyDown(event: KeyboardEvent) {
		if (event.ctrlKey) {
			switch (event.key.toLocaleLowerCase()) {
				case 'z':
					event.preventDefault();
					undo_redo_state.undo();
					break;
				case 'y':
					event.preventDefault();
					undo_redo_state.redo();
					break;
			}
		}
	}

	$effect(() => {
		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

{@render children?.()}
