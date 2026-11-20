import type { ColumnDef } from '@tanstack/table-core';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from '../base-columns.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
import { renderComponent } from '#lib/components/ui/data-table/index.js';
import { ConductorSetsCell, InsulationsDropdown, ErrorCell } from '../(components)/index.js';

export function onePhaseMainOrWyeCols(
	current_node: PhaseLoadSchedule,
	overload = false
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
						if (data.conductor_size === -1) {
							return renderComponent(ErrorCell, {
								trigger_value: '-',
								tooltip_content:
									'No conductor in PEC 2017 Table 3.10.2.6(B)(16) meets this circuit at its ambient and insulation: add conductor sets or change the insulation'
							});
						}
						return info.getValue();
					},
					footer: () => {
						if (current_node.conductor_size === -1) {
							return renderComponent(ErrorCell, {
								trigger_value: '-',
								tooltip_content:
									'No conductor in PEC 2017 Table 3.10.2.6(B)(16) meets this circuit at its ambient and insulation: add conductor sets or change the insulation'
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
							at: data.at,
							type: 'conductor',
							current_insulation: data.conductor_insulation as string,
							node: data
						});
					},
					footer: () =>
						renderComponent(InsulationsDropdown, {
							at: current_node.at,
							type: 'conductor',
							current_insulation: current_node.conductor_insulation as string,
							node: current_node
						})
				}
			]
		},
		...createRightMostBaseColumns<PhaseLoadSchedule>(current_node, overload)
	];
}
