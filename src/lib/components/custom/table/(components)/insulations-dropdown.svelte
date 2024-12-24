<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import * as Select from '$lib/components/ui/select/index.js';
	import { changeInsulation } from '@/db/mutations';
	import { toast } from 'svelte-sonner';

	interface Props {
		adjusted_current: number;
		type: 'conductor' | 'egc';
		current_insulation: string;
		node_id: string;
	}
	type Insulations = (typeof insulations)[number];

	let { adjusted_current, type, current_insulation, node_id }: Props = $props();
	let selected_insulation = $state<Insulations>(current_insulation as Insulations);

	const insulations = ['TW-Cu', 'THWN-Cu', 'THHN-Cu'] as const;
	const insulations_to_map =
		type === 'egc'
			? insulations
			: adjusted_current > 100
				? insulations.filter((i) => i !== 'TW-Cu')
				: insulations;

	$effect(() => {
		if (adjusted_current > 100 && current_insulation === 'TW-Cu') {
			handleChangeInsulation('THHN-Cu');
		}
	});

	async function handleChangeInsulation(insulation: Insulations) {
		await changeInsulation({ node_id, insulation, type });
		await invalidateAll();
	}
</script>

<Select.Root
	type="single"
	bind:value={selected_insulation}
	onOpenChange={async (value) => {
		if (!value && current_insulation !== selected_insulation) {
			await handleChangeInsulation(selected_insulation);
			toast.success(
				`${type === 'conductor' ? "Conductor's" : "EGC's"} insulation changed from ${current_insulation} to ${selected_insulation}`
			);
		}
	}}
>
	<Select.Trigger class="w-[105px] text-xs"
		>{selected_insulation ? selected_insulation : 'Select an insulation'}</Select.Trigger
	>
	<Select.Content class="text-sm">
		{#each insulations_to_map as insulation, i (i)}
			<Select.Item value={insulation} disabled={selected_insulation === insulation}>
				{insulation}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
