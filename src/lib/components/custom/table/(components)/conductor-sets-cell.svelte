<script lang="ts">
	import { IsFocusWithin } from 'runed';
	import { updateConductorSets } from '@/db/mutations';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';

	let { sets, node_id }: { sets: number; node_id: string } = $props();
	let sets_value = $state(sets);
	let formElement = $state<HTMLFormElement>();
	const focusWithinForm = new IsFocusWithin(() => formElement);

	async function saveSetsChanges() {
		try {
			const updated_set = await updateConductorSets({
				node_id,
				sets: !sets_value ? 1 : sets_value
			});

			sets_value = updated_set?._data.conductor_sets as number;
			invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
			toast.success('Sets updated successfully');
		} catch (error) {
			console.log(error);
			toast.error('An error occured while updating the sets');
		}
	}

	$effect(() => {
		if (!focusWithinForm.current && sets_value !== sets) {
			if (sets_value && sets_value >= 1) {
				saveSetsChanges();
			} else {
				sets_value = sets;
			}
		}
	});
</script>

<form bind:this={formElement}>
	<input
		type="number"
		bind:value={sets_value}
		class="w-16 bg-transparent p-2 text-center outline-primary [appearance:textfield] focus:outline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
	/>
</form>
