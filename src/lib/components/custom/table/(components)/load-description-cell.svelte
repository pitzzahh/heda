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
	let load_desc = load_description.split(' - ').at(-1);
	let load_description_state = $state(load_desc || '');
	let formElement = $state<HTMLFormElement>();
	const focusWithinForm = new IsFocusWithin(() => formElement);

	async function saveLoadDescChanges() {
		try {
			await updateLoadDescription({
				node_id,
				load_description: load_description_state,
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
		if (!focusWithinForm.current && load_description_state !== load_desc) {
			if (!load_description_state) {
				load_description_state = load_desc as string;
				return;
			}
			saveLoadDescChanges();
		}
	});
</script>

<form bind:this={formElement}>
	<input
		type="text"
		{...!focusWithinForm.current && { value: load_desc }}
		bind:value={load_description_state}
		class="w-full bg-transparent p-2 text-center outline-primary [appearance:textfield] focus:outline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
	/>
</form>
