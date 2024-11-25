import type { ColumnDef } from '@tanstack/table-core';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from '../base-columns';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import type { SuperValidated } from 'sveltekit-superforms';
import type { PhaseMainLoadSchema } from '@/schema/load';

export function threePhaseDeltaCols(
	phase_main_load_form: SuperValidated<PhaseMainLoadSchema>
): ColumnDef<PhaseLoadSchedule>[] {
	return [
		...createLeftMostBaseColumns<PhaseLoadSchedule>(phase_main_load_form),
		{
			header: 'CONDUCTOR',
			columns: [
				{
					accessorKey: 'sets',
					cell: (info) => info.getValue(),
					header: () => 'Sets'
				},
				{
					header: 'P+P',
					columns: [
						{
							accessorKey: 'p_plus_p_size',
							header: () => 'Size',
							cell: (info) => info.getValue()
						},
						{
							accessorKey: 'p_plus_p_insulation',
							header: 'INSULATION',
							cell: (info) => info.getValue()
						}
					]
				},
				{
					header: '3P',
					columns: [
						{
							accessorKey: 'three_phase_size',
							header: () => 'Size',
							cell: (info) => info.getValue()
						},
						{
							accessorKey: 'three_phase_insulation',
							header: 'INSULATION',
							cell: (info) => info.getValue()
						}
					]
				}
			]
		},
		...createRightMostBaseColumns<PhaseLoadSchedule>()
	];
}
