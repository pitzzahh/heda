<script lang="ts">
	import { DataTable } from '@/components/custom/table';
	import { threePhaseWyeCols } from '@/components/custom/table/three-phase-load-cols/three-phase-wye-cols.js';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { page } from '$app/stores';

	// FOR FUTURE REFERENCE
	// const table_data: PhaseLoadSchedule[] = [
	// {
	// 	crkt_num: 'CKT-001',
	// 	load_description: 'Lighting Load',
	// 	voltage: 120,
	// 	va: 1500,
	// 	ab: 10,
	// 	bc: 12,
	// 	ca: 11,
	// 	at: 20,
	// 	pole: 1,
	// 	kaic: 14,
	// 	sets: 2,
	// 	p_plus_p_size: '12 AWG',
	// 	p_plus_p_insulation: 'THHN',
	// 	three_phase_size: '10 AWG',
	// 	three_phase_insulation: 'THHN',
	// 	egc_size: '8 AWG',
	// 	egc_insulation: 'THWN',
	// 	conduit_size: '3/4 in',
	// 	conduit_type: 'PVC'
	// },
	// {
	// 	crkt_num: 'CKT-002',
	// 	load_description: 'HVAC Load',
	// 	voltage: 240,
	// 	va: 3000,
	// 	ab: 15,
	// 	bc: 14,
	// 	ca: 13,
	// 	at: 30,
	// 	pole: 2,
	// 	kaic: 20,
	// 	sets: 1,
	// 	p_plus_p_size: '10 AWG',
	// 	p_plus_p_insulation: 'XHHW',
	// 	three_phase_size: '8 AWG',
	// 	three_phase_insulation: 'XHHW',
	// 	egc_size: '6 AWG',
	// 	egc_insulation: 'THHN',
	// 	conduit_size: '1 in',
	// 	conduit_type: 'EMT'
	// },
	// {
	// 	crkt_num: 'CKT-003',
	// 	load_description: 'Receptacle Load',
	// 	voltage: 120,
	// 	va: 1800,
	// 	ab: 9,
	// 	bc: 8,
	// 	ca: 10,
	// 	at: 15,
	// 	pole: 1,
	// 	kaic: 10,
	// 	sets: 3,
	// 	p_plus_p_size: '14 AWG',
	// 	p_plus_p_insulation: 'THHN',
	// 	three_phase_size: '12 AWG',
	// 	three_phase_insulation: 'THHN',
	// 	egc_size: '10 AWG',
	// 	egc_insulation: 'THWN',
	// 	conduit_size: '1/2 in',
	// 	conduit_type: 'PVC'
	// }
	// ];

	let { data } = $props();
	let params = $derived($page.params);

	let root_node = data.root_node;
	const phases: Record<string, string> = {
		ONE_PHASE: '1P',
		THREE_PHASE_WYE: '3P-Y',
		THREE_PHASE_DELTA: '3P-Δ'
	};
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
				Phase: <span class="font-normal"
					>{phases[root_node?.highest_unit_form?.phase as string] || ''}</span
				>
			</p>
			<p class="font-semibold">
				Wire Length: <span class="font-normal">{root_node?.highest_unit_form?.wire_length}</span>
			</p>
		</div>
		<div>
			<p class="font-semibold">
				Ambient Temperature: <span class="font-normal"
					>{root_node?.highest_unit_form?.ambient_temperature}</span
				>
			</p>
			<p class="font-semibold">
				Panel: <span class="font-normal">{params.id.split('_').at(0)}</span>
			</p>
		</div>
	</div>
	<DataTable
		data={data?.nodes && data.nodes.length > 0
			? (data.nodes as unknown as PhaseLoadSchedule[])
			: []}
		columns={threePhaseWyeCols(data.phase_main_load_form)}
	/>
</div>
