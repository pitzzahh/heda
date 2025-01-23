<script lang="ts">
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { getProjectState } from '@/hooks/project-state.svelte';

	let { children } = $props();
	let undo_redo_state = getUndoRedoState();
	const project_state = getProjectState();

	function handleKeyDown(event: KeyboardEvent) {
		if (event.ctrlKey) {
			switch (event.key.toLocaleLowerCase()) {
				case 'z':
					event.preventDefault();
					undo_redo_state.undo(project_state.current_project_name);
					break;
				case 'y':
					event.preventDefault();
					undo_redo_state.redo(project_state.current_project_name);
					break;
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

{@render children?.()}
