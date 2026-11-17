import type { ColumnDef } from '@tanstack/table-core';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
import { PHASE_ASSIGNMENTS } from '#lib/constants.js';
import { rowPhaseVa } from '#lib/utils/computations/index.js';
import { renderComponent } from '#lib/components/ui/data-table/index.js';
import { onePhaseMainOrWyeCols } from './one-phase-load-cols/index.js';
import { PhaseDropdown, WyeCurrentFooterCell } from './(components)/index.js';

/**
 * Load schedule of a 400Y/230 V panel (PEC 2017 App. D Ex. D6/D8): the
 * single-phase columns plus each circuit's phase and the VA it puts on A, B
 * and C, totalled per phase in the footer.
 */
export function threePhaseWyeCols(current_node: PhaseLoadSchedule): ColumnDef<PhaseLoadSchedule>[] {
	const columns = onePhaseMainOrWyeCols(current_node).map((column) =>
		'accessorKey' in column && column.accessorKey === 'current'
			? {
					...column,
					footer: () =>
						renderComponent(WyeCurrentFooterCell, {
							current: current_node.current,
							balanced_current: current_node.balanced_current
						})
				}
			: column
	);
	const after_current =
		columns.findIndex((column) => 'accessorKey' in column && column.accessorKey === 'current') + 1;

	const phase_columns: ColumnDef<PhaseLoadSchedule>[] = [
		{
			accessorKey: 'phase',
			header: 'PHASE',
			cell: (info) =>
				renderComponent(PhaseDropdown, {
					phase: info.row.original.phase ?? 'A',
					node: info.row.original
				}),
			footer: () => 'ABC'
		},
		{
			header: 'VA PER PHASE',
			columns: PHASE_ASSIGNMENTS.map((phase): ColumnDef<PhaseLoadSchedule> => ({
				id: `phase_va_${phase}`,
				accessorFn: (row) => rowPhaseVa(row, phase),
				header: () => phase,
				cell: (info) => info.getValue(),
				footer: () => Number((current_node.phase_va?.[phase] ?? 0).toFixed(2))
			}))
		}
	];

	return [...columns.slice(0, after_current), ...phase_columns, ...columns.slice(after_current)];
}
