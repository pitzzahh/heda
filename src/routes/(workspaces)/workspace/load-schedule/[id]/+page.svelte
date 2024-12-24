<script lang="ts">
	import { DataTable } from '@/components/custom/table';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { page } from '$app/stores';
	import { onePhaseMainOrWyeCols } from '@/components/custom/table/one-phase-load-cols/one-phase-main-or-wye-cols.js';
	import { getNodeById } from '@/db/queries/index.js';

	let { data } = $props();
	let params = $derived($page.params);
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
			<!-- <p class="font-semibold">
				Wire Length: <span class="font-normal">{root_node?.highest_unit_form?.wire_length}</span>
			</p> -->
		</div>
		<div>
			<!-- <p class="font-semibold">
				Terminal Temperature: <span class="font-normal"
					>{root_node?.highest_unit_form?.terminal_temperature}</span
				>
			</p> -->
			<!-- <p class="font-semibold">
		</div>
		<div>
			<p class="font-semibold">
				Panel: <span class="font-normal">{params.id.split('_').at(0)}</span>
			</p> -->

			<p class="font-semibold">
				Supply From:
				<span class="font-normal">
					{supply_from_name}
				</span>
			</p>
		</div>
	</div>
	{#key loads}
		<DataTable
			data={loads && loads.length > 0 ? (loads as unknown as PhaseLoadSchedule[]) : []}
			columns={onePhaseMainOrWyeCols(
				data.phase_main_load_form,
				data.current_node as unknown as PhaseLoadSchedule,
				root_node?.highest_unit_form,
				loads && loads.length > 0 ? loads.at(-1) : undefined
			)}
			is_root_node={data.current_node?.node_type === 'root'}
		/>
	{/key}
</div>
