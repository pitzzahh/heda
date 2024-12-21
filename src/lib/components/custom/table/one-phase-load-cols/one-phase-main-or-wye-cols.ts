import type { ColumnDef } from '@tanstack/table-core';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from '../base-columns';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { SuperValidated } from 'sveltekit-superforms';
import type { Node } from '@/db/schema';

export function onePhaseMainOrWyeCols(
	phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>,
	current_node: Node,
	highest_unit?: NonNullable<Node['highest_unit_form']>,
	latest_circuit_node?: Node
): ColumnDef<PhaseLoadSchedule>[] {
	return [
		...createLeftMostBaseColumns<PhaseLoadSchedule>(
			phase_main_load_form,
			current_node,
			highest_unit,
			latest_circuit_node
		),
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
					accessorKey: 'conductor_quantity',
					header: () => 'Qty',
					cell: (info) => info.getValue(),
					footer: () => ''
				},
				{
					accessorKey: 'conductor_size',
					header: () => 'Size (mm²)',
					cell: (info) => info.getValue(),
					footer: () => ''
				},
				{
					accessorKey: 'conductor_insulation',
					header: 'Insulation',
					cell: (info) => info.getValue(),
					footer: () => ''
				}
			]
		},
		...createRightMostBaseColumns<PhaseLoadSchedule>(
			phase_main_load_form,
			current_node,
			highest_unit
		)
	];
}
