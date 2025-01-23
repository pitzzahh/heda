<script lang="ts">
	import { IsFocusWithin } from 'runed';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { updateLoadDescription } from '@/db/mutations';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { getProjectState } from '@/hooks/project-state.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';

	let {
		load_description,
		node_id,
		node_type,
		node
	}: {
		load_description: string;
		node_id: string;
		node_type: 'panel' | 'load';
		node: PhaseLoadSchedule;
	} = $props();
	let load_description_suffix = load_description.split(' - ').at(-1);
	let load_description_state = $state(load_description);
	let formElement = $state<HTMLFormElement>();
	const focusWithinForm = new IsFocusWithin(() => formElement);

	const undo_redo_state = getUndoRedoState();
	const project_state = getProjectState();

	async function saveLoadDescChanges() {
		try {
			const updated_node = await updateLoadDescription({
				node_id,
				load_description:
					node_type === 'load'
						? (load_description.split(' - ').at(0) as string) + ' - ' + load_description_state
						: load_description_state,
				node_type,
				instance_name: project_state.current_project_name
			});
			undo_redo_state.setActionToUndo({
				action: 'update_node',
				data: updated_node as unknown as PhaseLoadSchedule,
				previous_data: node
			});
			invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
			toast.success('Load description updated successfully');
		} catch (err) {
			console.error(`Error: failed to update load description: ${JSON.stringify(err, null, 2)}`);
			toast.error('An error occured while updating the load description');
		}
	}

	$effect(() => {
		if (focusWithinForm.current && node_type === 'load') {
			load_description_state = load_description_suffix as string;
		}

		if (!focusWithinForm.current) {
			if (
				node_type === 'panel' &&
				load_description_state !== load_description &&
				load_description_state
			) {
				saveLoadDescChanges();
			} else load_description_state = load_description;

			if (
				node_type === 'load' &&
				load_description_state !== load_description &&
				load_description_state !== load_description_suffix &&
				load_description_state
			) {
				saveLoadDescChanges();
			} else {
				load_description_state = load_description;
			}
		}
	});
</script>

<form bind:this={formElement}>
	<input
		type="text"
		bind:value={load_description_state}
		class="outline-primary w-full [appearance:textfield] bg-transparent p-2 text-center focus:outline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
	/>
</form>
