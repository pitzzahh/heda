<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

	interface Props {
		/** The circuit's breaker rating. */
		at: number;
		type: 'conductor' | 'egc';
		current_insulation: string;
		node: PhaseLoadSchedule;
	}

	const insulations = ['TW-Cu', 'THWN-Cu', 'THWN-2-Cu', 'THHN-Cu'] as const;

	/**
	 * PEC 2017 1.10.1.14(C)(1)(b): terminations of circuits rated over 100 A take conductors
	 * rated 75 °C or more, so TW (60 °C) is not offered there; the engine shows a TW conductor
	 * already on such a circuit as unsizable. An EGC is not held to this.
	 */
	export function isTwBarred(type: Props['type'], at: number) {
		return type === 'conductor' && at > 100;
	}

	type Insulations = (typeof insulations)[number];
</script>

<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { changeInsulation } from '#lib/db/mutations/index.js';
	import { toast } from 'svelte-sonner';

	let { at, type, current_insulation, node }: Props = $props();
	// User picks override until undo/redo recomputes it.
	let selected_insulation = $derived(current_insulation as Insulations);

	const insulations_to_map = $derived(
		isTwBarred(type, at) ? insulations.filter((i) => i !== 'TW-Cu') : insulations
	);

	async function handleChangeInsulation(insulation: Insulations) {
		await changeInsulation({ node_id: node.id, insulation, type });
	}
</script>

<Select.Root
	type="single"
	bind:value={selected_insulation}
	onOpenChange={(value) => {
		if (!value && current_insulation !== selected_insulation) {
			handleChangeInsulation(selected_insulation);
			toast.success(
				`${type === 'conductor' ? "Conductor's" : "EGC's"} insulation changed from ${current_insulation} to ${selected_insulation}`
			);
		}
	}}
>
	<Select.Trigger size="sm" class="w-26.25 text-xs">
		{#if selected_insulation}
			{selected_insulation}
		{:else}
			Select an insulation
		{/if}
	</Select.Trigger>
	<Select.Content class="text-sm">
		{#each insulations_to_map as insulation (insulation)}
			<Select.Item value={insulation} disabled={selected_insulation === insulation}>
				{insulation}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
