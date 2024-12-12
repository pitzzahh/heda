import type { ColumnDef } from '@tanstack/table-core';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from '../base-columns';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import type { SuperValidated } from 'sveltekit-superforms';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { HighestUnitSchema } from '@/schema';

export function onePhaseDeltaCols(
	phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>,
	highest_unit: HighestUnitSchema
): ColumnDef<PhaseLoadSchedule>[] {
	return [
		...createLeftMostBaseColumns<PhaseLoadSchedule>(phase_main_load_form, highest_unit),
		{
			header: 'CONDUCTOR',
			columns: [
				{
					accessorKey: 'sets',
					cell: (info) => info.getValue(),
					header: () => 'Sets',
					footer: () => ''
				},
				{
					header: 'P + P',
					columns: [
						{
							accessorKey: 'p_plus_p_size',
							header: () => 'SIZE',
							cell: (info) => info.getValue(),
							footer: () => ''
						},
						{
							accessorKey: 'p_plus_p_insulation',
							header: 'INSULATION',
							cell: (info) => info.getValue(),
							footer: () => ''
						}
					]
				}
			]
		},
		...createRightMostBaseColumns<PhaseLoadSchedule>()
	];
}
