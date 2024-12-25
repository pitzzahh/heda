<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import * as Select from '$lib/components/ui/select/index.js';
	import { changePole } from '@/db/mutations';
	import { toast } from 'svelte-sonner';

	interface Props {
		current_pole: '1' | '2';
		node_id: string;
	}

	let { node_id, current_pole }: Props = $props();
	let selected_pole = $state<'1' | '2'>(current_pole);

	async function handleChangeInsulation(pole: '1' | '2') {
		changePole(node_id, pole);
		await invalidateAll();
	}
</script>

<Select.Root
	type="single"
	bind:value={selected_pole}
	onOpenChange={async (value) => {
		if (!value && current_pole !== selected_pole) {
			await handleChangeInsulation(selected_pole);
			toast.success(`Pole changed from ${current_pole} to ${selected_pole}`);
		}
	}}
>
	<Select.Trigger class="w-[50px] text-xs"
		>{selected_pole ? selected_pole : 'Select a pole'}</Select.Trigger
	>
	<Select.Content class="text-sm">
		{#each ['1', '2'] as pole, i (i)}
			<Select.Item value={pole} disabled={selected_pole === pole}>
				{pole}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
