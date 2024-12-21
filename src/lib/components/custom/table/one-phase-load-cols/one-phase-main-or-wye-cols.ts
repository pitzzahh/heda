import type { ColumnDef } from '@tanstack/table-core';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from '../base-columns';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { SuperValidated } from 'sveltekit-superforms';
import type { Node } from '@/db/schema';
import { renderComponent } from '@/components/ui/data-table';
import ConductorSetsCell from '../(components)/conductor-sets-cell.svelte';

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
					accessorKey: 'conductor_sets',
					header: () => 'Sets',
					cell: (info) => {
						return renderComponent(ConductorSetsCell, {
							sets: info.row.original.conductor_sets as number,
							node_id: info.row.original.id
						});
					},
					footer: () => {
						return renderComponent(ConductorSetsCell, {
							sets: current_node.conductor_sets as number,
							node_id: current_node.id
						});
					}
				},
				{
					accessorKey: 'conductor_qty',
					header: () => 'Qty',
					cell: (info) => info.getValue(),
					footer: () => current_node.conductor_qty
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
