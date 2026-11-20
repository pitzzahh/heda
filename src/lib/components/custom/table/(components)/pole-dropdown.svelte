<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

	interface Props {
		current_pole: '1' | '2' | '3';
		node: PhaseLoadSchedule;
	}
</script>

<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { changePole } from '#lib/db/mutations/index.js';
	import { toast } from 'svelte-sonner';

	let { node, current_pole }: Props = $props();
	// User picks override until undo/redo recomputes it.
	let selected_pole = $derived(current_pole);

	async function handleChangePole(pole: '1' | '2' | '3') {
		await changePole(node.id, pole);
	}
</script>

<Select.Root
	type="single"
	bind:value={selected_pole}
	onOpenChange={(value) => {
		if (!value && current_pole !== selected_pole) {
			handleChangePole(selected_pole);
			toast.success(`Pole changed from ${current_pole} to ${selected_pole}`);
		}
	}}
>
	<Select.Trigger size="sm" class="w-12.5 text-xs">
		{#if selected_pole}
			{selected_pole}
		{:else}
			Select a pole
		{/if}
	</Select.Trigger>
	<Select.Content class="text-sm">
		{#each ['1', '2', '3'] as pole (pole)}
			<Select.Item value={pole} disabled={selected_pole === pole}>
				{pole}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
