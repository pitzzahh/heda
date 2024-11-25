<script lang="ts">
	import { page } from '$app/stores';
	import { DataTable } from '@/components/custom/table';
	import { onePhaseMainOrWyeCols } from '@/components/custom/table/one-phase-load-cols';

	import type { PhaseLoadSchedule } from '@/types/load/one_phase';

	let id = $page.params.id;

	const table_data: PhaseLoadSchedule[] = [
		{
			crkt_num: 'CKT-001',
			load_description: 'Lighting Load',
			voltage: 120,
			va: 1500,
			ab: 10,
			bc: 12,
			ca: 11,
			at: 20,
			pole: 1,
			kaic: 14,
			sets: 2,
			p_plus_p_size: '12 AWG',
			p_plus_p_insulation: 'THHN',
			three_phase_size: '10 AWG',
			three_phase_insulation: 'THHN',
			egc_size: '8 AWG',
			egc_insulation: 'THWN',
			conduit_size: '3/4 in',
			conduit_type: 'PVC'
		},
		{
			crkt_num: 'CKT-002',
			load_description: 'HVAC Load',
			voltage: 240,
			va: 3000,
			ab: 15,
			bc: 14,
			ca: 13,
			at: 30,
			pole: 2,
			kaic: 20,
			sets: 1,
			p_plus_p_size: '10 AWG',
			p_plus_p_insulation: 'XHHW',
			three_phase_size: '8 AWG',
			three_phase_insulation: 'XHHW',
			egc_size: '6 AWG',
			egc_insulation: 'THHN',
			conduit_size: '1 in',
			conduit_type: 'EMT'
		},
		{
			crkt_num: 'CKT-003',
			load_description: 'Receptacle Load',
			voltage: 120,
			va: 1800,
			ab: 9,
			bc: 8,
			ca: 10,
			at: 15,
			pole: 1,
			kaic: 10,
			sets: 3,
			p_plus_p_size: '14 AWG',
			p_plus_p_insulation: 'THHN',
			three_phase_size: '12 AWG',
			three_phase_insulation: 'THHN',
			egc_size: '10 AWG',
			egc_insulation: 'THWN',
			conduit_size: '1/2 in',
			conduit_type: 'PVC'
		}
	];

	let { data } = $props();
</script>

<div class="flex w-full flex-col gap-2">
	<div>
		<p>Distribution Unit: MDP</p>
		<p>Phase: 1P</p>
	</div>
	<DataTable data={table_data} columns={onePhaseMainOrWyeCols(data.phase_main_load_form)} />
</div>
