<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { Node } from '#lib/types/db/index.js';

	interface Props {
		children?: Snippet;
		id: string;
		panel_name: string;
		highest_unit: NonNullable<Node['highest_unit_form']>;
		parent_id: string;
		open_dialog_state?: boolean;
		latest_circuit_node?: Node;
	}
</script>

<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
	import { GenericPhaseMainPanelForm } from '#lib/components/custom/panel/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import type { Phase } from '#lib/types/phase/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { DEFAULT_PHASES } from '#lib/constants/index.js';
	import { getOptionLabel } from '#lib/utils/format/index.js';

	let {
		children,
		id,
		parent_id,
		highest_unit,
		panel_name,
		open_dialog_state = $bindable(false),
		latest_circuit_node
	}: Props = $props();

	const phase = $derived(highest_unit.phase);
	const parent_node = $derived(getNode(parent_id));

	function handleClick() {
		setTimeout(() => {
			goto(resolve('/(workspaces)/workspace/load-schedule/[id]', { id: panel_name + '_' + id }));
		}, 300);
	}
</script>

<button class="flex w-full items-center gap-2" onclick={handleClick}>
	{@render children?.()}
</button>

<Dialog.Root bind:open={open_dialog_state}>
	<Dialog.Content class="w-full max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Add a Panel</Dialog.Title>
			<div class="flex flex-col items-center justify-start">
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Supply From:</h4>
							{#if parent_node?.highest_unit_form?.distribution_unit}
								<p>{parent_node.highest_unit_form.distribution_unit}</p>
							{:else if parent_node?.panel_data?.name}
								<p>{parent_node.panel_data.name}</p>
							{:else}
								<p>N/A</p>
							{/if}
						</div>
					</div>
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Phase:</h4>
							<p>
								{getOptionLabel(DEFAULT_PHASES, highest_unit.phase) || 'N/A'}
							</p>
						</div>
					</div>
				</div>
			</div>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<svelte:boundary>
			<GenericPhaseMainPanelForm
				action="add"
				{parent_id}
				main_phase={phase as Phase}
				closeDialog={() => (open_dialog_state = false)}
				{latest_circuit_node}
			/>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>
