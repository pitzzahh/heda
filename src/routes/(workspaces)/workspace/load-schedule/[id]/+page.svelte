<script lang="ts">
	import { DataTable } from '@/components/custom/table';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { page } from '$app/state';
	import { onePhaseMainOrWyeCols } from '@/components/custom/table/one-phase-load-cols/one-phase-main-or-wye-cols.js';
	import {
		getComputedLoads,
		getComputedVoltageDrops,
		getRootNode,
		getNodeById
	} from '@/db/queries/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { voltageDropColumns } from '@/components/custom/table/voltage-drop-cols/voltage-drop-cols.js';
	import { Skeletal } from '@/components/custom/index.js';
	import { getProjectState } from '@/hooks/project-state.svelte';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';

	let { data } = $props();

	const { root_node } = data;
	const params = $derived(page.params);
	const node_id = $derived(params.id.split('_').at(-1) as string);
	const project_state = getProjectState();
	const undo_redo_state = getUndoRedoState();

	$effect(() => {
		if (!project_state.loaded) {
			toast.warning('Project not loaded yet. Redirecting to workspaces...', {
				description: 'Please create a project or load an existing one first.'
			});
			goto(`/`);
		}
	});
</script>

<div class="flex w-full flex-col gap-2">
	<div class="grid grid-cols-2">
		<div>
			<p class="font-semibold">
				Distribution Unit: <span class="font-normal">
					{#await getNodeById(node_id)}
						Loading...
					{:then current_node}
						{current_node?.panel_data?.name ??
							current_node?.highest_unit_form?.distribution_unit ??
							'NOT FOUND'}
					{/await}
				</span>
			</p>
			<p class="font-semibold">
				Phase: <span class="font-normal">
					{#await getRootNode()}
						Loading...
					{:then root_node}
						{root_node?.highest_unit_form?.phase ?? ''}
					{/await}</span
				>
			</p>
		</div>

		<p class="font-semibold">
			Supply From:
			<span class="font-normal">
				{#await getNodeById(node_id)}
					Loading...
				{:then current_node}
					{@const parent_id = current_node?.parent_id}
					{#if parent_id}
						{#await getNodeById(parent_id)}
							Loading...
						{:then parent_node}
							{parent_node?.panel_data?.name ||
								parent_node?.highest_unit_form?.distribution_unit ||
								'--'}
						{/await}
					{:else}
						--
					{/if}
				{/await}
			</span>
		</p>
	</div>
	<Tabs.Root value="load-sched" class="w-full">
		<Tabs.List class="place-self-end">
			<Tabs.Trigger value="load-sched">Load Schedule</Tabs.Trigger>
			<Tabs.Trigger value="voltage-drop">Voltage Drop</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="load-sched">
			{#key undo_redo_state.has_unsaved_actions}
				{#await Promise.all([getNodeById(node_id), getComputedLoads(node_id as string)])}
					<Skeletal options_count={10} />
				{:then [current_node, loads]}
					<DataTable
						data={loads && loads.length > 0 ? (loads as PhaseLoadSchedule[]) : []}
						columns={onePhaseMainOrWyeCols(
							data.phase_main_load_form,
							current_node as PhaseLoadSchedule,
							root_node?.highest_unit_form,
							loads && loads.length > 0 ? loads.at(-1) : undefined
						)}
						is_footer_shown={current_node?.node_type !== 'root'}
					/>
				{/await}
			{/key}
		</Tabs.Content>
		<Tabs.Content value="voltage-drop">
			{#await getComputedVoltageDrops()}
				<Skeletal options_count={10} />
			{:then voltage_drops}
				<DataTable data={voltage_drops} is_footer_shown={false} columns={voltageDropColumns()} />
			{/await}
		</Tabs.Content>
	</Tabs.Root>
</div>
