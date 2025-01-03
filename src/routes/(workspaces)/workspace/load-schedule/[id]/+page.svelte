<script lang="ts">
	import { DataTable } from '@/components/custom/table';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { page } from '$app/state';
	import { onePhaseMainOrWyeCols } from '@/components/custom/table/one-phase-load-cols/one-phase-main-or-wye-cols.js';
	import { getNodeById } from '@/db/queries/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { voltageDropColumns } from '@/components/custom/table/voltage-drop-cols/voltage-drop-cols.js';

	let { data } = $props();
	let params = $derived(page.params);
	const { root_node } = data;
	let supply_from_name = $state('');
	let loads = $derived(data?.nodes);

	$effect(() => {
		const nodeId = params.id.split('_').at(-1) as string;

		getNodeById(nodeId).then((current_node) => {
			const parentId = current_node?.parent_id;

			if (parentId) {
				getNodeById(parentId).then((node) => {
					supply_from_name =
						node?.panel_data?.name || node?.highest_unit_form?.distribution_unit || '--';
				});
			} else supply_from_name = '--';
		});
	});
</script>

<div class="flex w-full flex-col gap-2">
	<div class="grid grid-cols-2">
		<div>
			<p class="font-semibold">
				Distribution Unit: <span class="font-normal"
					>{root_node?.highest_unit_form?.distribution_unit}</span
				>
			</p>
			<p class="font-semibold">
				Phase: <span class="font-normal">{root_node?.highest_unit_form?.phase ?? ''}</span>
			</p>
		</div>

		<p class="font-semibold">
			Supply From:
			<span class="font-normal">
				{supply_from_name}
			</span>
		</p>
	</div>
	<Tabs.Root value="load-sched" class="w-full">
		<Tabs.List class="place-self-end">
			<Tabs.Trigger value="load-sched">Load Schedule</Tabs.Trigger>
			<Tabs.Trigger value="voltage-drop">Voltage Drop</Tabs.Trigger>
		</Tabs.List>
		<Tabs.Content value="load-sched">
			{#key loads}
				<DataTable
					data={loads && loads.length > 0 ? (loads as PhaseLoadSchedule[]) : []}
					columns={onePhaseMainOrWyeCols(
						data.phase_main_load_form,
						data.current_node as PhaseLoadSchedule,
						root_node?.highest_unit_form,
						loads && loads.length > 0 ? loads.at(-1) : undefined
					)}
					is_root_node={data.current_node?.node_type === 'root'}
				/>
			{/key}
		</Tabs.Content>
		<Tabs.Content value="voltage-drop">
			<DataTable data={[]} columns={voltageDropColumns()} is_root_node={false} />
		</Tabs.Content>
	</Tabs.Root>
</div>
