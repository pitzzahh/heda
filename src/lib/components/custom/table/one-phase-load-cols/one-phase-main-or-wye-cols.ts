import type { ColumnDef } from '@tanstack/table-core';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from '../base-columns';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { SuperValidated } from 'sveltekit-superforms';
import type { Node } from '@/db/schema';
import { renderComponent } from '@/components/ui/data-table';
import ConductorSetsCell from '../(components)/conductor-sets-cell.svelte';
import InsulationsDropdown from '../(components)/insulations-dropdown.svelte';
import ErrorCell from '../(components)/error-cell.svelte';

export function onePhaseMainOrWyeCols(
	phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>,
	current_node: PhaseLoadSchedule,
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
					footer: (props) => current_node.conductor_qty
				},
				{
					accessorKey: 'conductor_size',
					header: () => 'Size (mm²)',
					cell: (info) => {
						const data = info.row.original;
						if (data.adjusted_current > 530 && !data.overrided_conductor_size) {
							return renderComponent(ErrorCell, {
								trigger_value: '-',
								tooltip_content: 'The number of set is not sufficient to size the feeder conductor'
							});
						}
						return info.getValue();
					},
					footer: (props) => {
						// const total_current = props.table
						// 	.getFilteredRowModel()
						// 	.rows.reduce((sum, row) => sum + row.original.current, 0);
						// const main_at = current_node.overrided_at || computeAmpereTrip(total_current);

						// return computeConductorSize({
						// 	set: current_node.conductor_sets as number,
						// 	qty: current_node.conductor_qty as number,
						// 	current: total_current,
						// 	load_type: 'Main',
						// 	at: main_at,
						// 	ambient_temp: current_node.panel_data?.ambient_temperature || 30
						// });

						return current_node.conductor_size;
					}
				},
				{
					accessorKey: 'conductor_insulation',
					header: 'Insulation',
					cell: (info) => {
						const data = info.row.original;
						return renderComponent(InsulationsDropdown, {
							adjusted_current: data.adjusted_current,
							type: 'conductor',
							current_insulation: data.conductor_insulation as string,
							node_id: data.id
						});
					},
					footer: () =>
						renderComponent(InsulationsDropdown, {
							adjusted_current: current_node.adjusted_current,
							type: 'conductor',
							current_insulation: current_node.conductor_insulation as string,
							node_id: current_node.id
						})
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
