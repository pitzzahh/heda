<script lang="ts">
	import { IsFocusWithin } from 'runed';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { updateLoadDescription } from '@/db/mutations';

	let {
		load_description,
		node_id,
		node_type
	}: { load_description: string; node_id: string; node_type: 'panel' | 'load' } = $props();
	let load_description_suffix = load_description.split(' - ').at(-1);
	let load_description_state = $state(load_description);
	let formElement = $state<HTMLFormElement>();
	const focusWithinForm = new IsFocusWithin(() => formElement);

	async function saveLoadDescChanges() {
		try {
			await updateLoadDescription({
				node_id,
				load_description:
					node_type === 'load'
						? (load_description.split(' - ').at(0) as string) + ' - ' + load_description_state
						: load_description_state,
				node_type
			});
			invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
			toast.success('Load description updated successfully');
		} catch (error) {
			console.log(error);
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
		class="w-full bg-transparent p-2 text-center outline-primary [appearance:textfield] focus:outline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
	/>
</form>
