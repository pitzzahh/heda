import type { ColumnDef } from '@tanstack/table-core';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
import { default_phases } from '#lib/constants.js';
import { phaseLabels } from '#lib/utils/computations/index.js';
import { renderComponent } from '#lib/components/ui/data-table/index.js';
import { onePhaseMainOrWyeCols } from './one-phase-load-cols/index.js';
import { PhaseDropdown, ThreePhaseCurrentFooterCell } from './(components)/index.js';

/**
 * Load schedule of a three-phase panel: the single-phase columns plus each
 * circuit's phase and the VA it puts on A, B and C of a 400Y/230 V panel (PEC
 * 2017 App. D Ex. D6/D8), or on the line pairs AB, BC and CA of a 230 V delta
 * one, totalled in the footer.
 */
export function threePhaseCols(
	current_node: PhaseLoadSchedule,
	supply_phase: string | undefined
): ColumnDef<PhaseLoadSchedule>[] {
	const is_delta = supply_phase === default_phases.THREE_PHASE_DELTA;
	const columns = onePhaseMainOrWyeCols(current_node).map((column) =>
		'accessorKey' in column && column.accessorKey === 'current'
			? {
					...column,
					footer: () =>
						renderComponent(ThreePhaseCurrentFooterCell, {
							current: current_node.current,
							balanced_current: current_node.balanced_current,
							line_current: current_node.line_current,
							line_voltage: is_delta ? 230 : 400
						})
				}
			: column
	);
	const after_current =
		columns.findIndex((column) => 'accessorKey' in column && column.accessorKey === 'current') + 1;
	const totals: Partial<Record<string, number>> | undefined = is_delta
		? current_node.pair_va
		: current_node.phase_va;

	const phase_columns: ColumnDef<PhaseLoadSchedule>[] = [
		{
			accessorKey: 'phase',
			header: 'PHASE',
			cell: (info) =>
				renderComponent(PhaseDropdown, {
					phase: info.row.original.phase ?? phaseLabels(supply_phase)[0]!,
					node: info.row.original,
					supply_phase
				}),
			footer: () => 'ABC'
		},
		{
			header: is_delta ? 'VA PER LINE PAIR' : 'VA PER PHASE',
			columns: phaseLabels(supply_phase).map((phase, index): ColumnDef<PhaseLoadSchedule> => ({
				id: `phase_va_${phase}`,
				// The engine's share of the row on this phase or pair; blank where it puts none.
				accessorFn: (row) => row.phase_loads?.[index] ?? '',
				header: () => phase,
				cell: (info) => info.getValue(),
				footer: () => Number((totals?.[phase] ?? 0).toFixed(2))
			}))
		}
	];

	return [...columns.slice(0, after_current), ...phase_columns, ...columns.slice(after_current)];
}
