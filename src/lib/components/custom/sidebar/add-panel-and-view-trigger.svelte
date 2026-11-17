<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { Node } from '#lib/types/db.js';

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
	import type { Phase } from '#lib/types/phase.js';
	import { supplyPhaseOf } from '#lib/utils/computations/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { DEFAULT_PHASES } from '#lib/constants.js';
	import { getOptionLabel } from '#lib/utils/format.js';
	import { loadScheduleRouteId } from '#lib/helpers/navigation.js';

	let {
		children,
		id,
		parent_id,
		highest_unit,
		panel_name,
		open_dialog_state = $bindable(false),
		latest_circuit_node
	}: Props = $props();

	const parent_node = $derived(getNode(parent_id));
	// What the parent feeds: the project's supply at the root, else the parent panel's phase.
	const phase = $derived(supplyPhaseOf(parent_node) ?? highest_unit.phase);

	function handleClick() {
		setTimeout(() => {
			goto(
				resolve('/(workspaces)/workspace/load-schedule/[id]', {
					id: loadScheduleRouteId(panel_name, id)
				})
			);
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
			<div class="grid gap-1.5 pt-1">
				<span class="text-[9px] font-semibold tracking-[0.24em] text-muted-foreground uppercase"
					>Main</span
				>
				<dl
					class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 text-sm sm:grid-cols-2 sm:gap-x-4"
				>
					<div class="grid min-w-0 gap-0.5">
						<dt class="text-xs text-muted-foreground">Supply from</dt>
						<dd class="min-w-0 font-medium [&>p]:truncate">
							{#if parent_node?.highest_unit_form?.distribution_unit}
								<p>{parent_node.highest_unit_form.distribution_unit}</p>
							{:else if parent_node?.panel_data?.name}
								<p>{parent_node.panel_data.name}</p>
							{:else}
								<p>N/A</p>
							{/if}
						</dd>
					</div>
					<div class="grid gap-0.5">
						<dt class="text-xs text-muted-foreground">Phase</dt>
						<dd class="font-medium">
							{getOptionLabel(DEFAULT_PHASES, highest_unit.phase) || 'N/A'}
						</dd>
					</div>
				</dl>
			</div>
		</Dialog.Header>
		<Separator class="mb-4" />
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
