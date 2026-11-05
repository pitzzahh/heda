import type { ColumnDef } from '@tanstack/table-core';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from '../base-columns';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';
import type { Node } from '#lib/types/db';
import { renderComponent } from '#lib/components/ui/data-table';
import { ConductorSetsCell, InsulationsDropdown, ErrorCell } from '../(components)';

export function onePhaseMainOrWyeCols(
	current_node: PhaseLoadSchedule,
	highest_unit?: NonNullable<Node['highest_unit_form']>
): ColumnDef<PhaseLoadSchedule>[] {
	return [
		...createLeftMostBaseColumns<PhaseLoadSchedule>(current_node),
		{
			header: 'CONDUCTOR',
			columns: [
				{
					accessorKey: 'conductor_sets',
					header: () => 'Sets',
					cell: (info) => {
						return renderComponent(ConductorSetsCell, {
							sets: info.row.original.conductor_sets as number,
							node: info.row.original
						});
					},
					footer: () => {
						return renderComponent(ConductorSetsCell, {
							sets: current_node.conductor_sets as number,
							node: current_node
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
					footer: () => {
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
						// })
						if (current_node.adjusted_current > 530 && !current_node.overrided_conductor_size) {
							return renderComponent(ErrorCell, {
								trigger_value: '-',
								tooltip_content: 'The number of set is not sufficient to size the feeder conductor'
							});
						}

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
							node: data
						});
					},
					footer: () =>
						renderComponent(InsulationsDropdown, {
							adjusted_current: current_node.adjusted_current,
							type: 'conductor',
							current_insulation: current_node.conductor_insulation as string,
							node: current_node
						})
				}
			]
		},
		...createRightMostBaseColumns<PhaseLoadSchedule>(current_node, highest_unit)
	];
}
