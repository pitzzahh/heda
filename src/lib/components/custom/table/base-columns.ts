import { renderComponent } from '@/components/ui/data-table/index.js';
import type { ColumnDef } from '@tanstack/table-core';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import { ColumnDropdown } from '@/components/custom/table/(components)';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { SuperValidated } from 'sveltekit-superforms';
import type { Node } from '@/db/schema';
import { computeAmpereTrip } from '@/utils/computations';
import { AddLoadDialog } from '@/components/custom/load';
import AtCell from './(components)/at-cell.svelte';

function getComputedMainAT(currents: number[]) {
	const total_current = currents.reduce((sum, current) => sum + current, 0);
	return computeAmpereTrip(total_current);
}

export const createLeftMostBaseColumns = <T extends PhaseLoadSchedule>(
	phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>,
	highest_unit?: NonNullable<Node['highest_unit_form']>,
	latest_circuit_node?: Node
): ColumnDef<T>[] => [
	{
		accessorKey: 'circuit_number',
		header: () =>
			renderComponent(AddLoadDialog, {
				phase_main_load_form,
				highest_unit,
				latest_circuit_node,
				'aria-label': 'Select row',
				class: 'translate-y-[2px]'
			}),
		footer: () => 'Total'
	},
	{
		accessorKey: 'load_description',
		header: 'Load Description',
		footer: () => 'MAIN'
	},
	{
		accessorKey: 'voltage',
		header: 'Voltage',
		footer: (props) => {
			// render the voltage of first index since all voltage cells are the same
			return props.table.getFilteredRowModel().rows.at(0)?.original.voltage;
		}
	},
	{
		accessorKey: 'va',
		header: 'VA',
		footer: (props) => {
			return props.table.getFilteredRowModel().rows.reduce((sum, row) => sum + row.original.va, 0);
		}
	},
	{
		accessorKey: 'current',
		header: 'CURRENT',
		footer: (props) => {
			return props.table
				.getFilteredRowModel()
				.rows.reduce((sum, row) => sum + row.original.current, 0)
				.toFixed(2);
		}
	},

	// NOTE: SHOULD ONLY SHOW IF THE PHASE IS 3
	// {
	// 	header: 'CURRENT',
	// 	columns: [
	// 		{
	// 			accessorKey: 'ab',
	// 			cell: (info) => info.getValue(),
	// 			header: () => 'AB',
	// 			footer: (props) => '34'
	// 		},
	// 		{
	// 			accessorKey: 'bc',
	// 			cell: (info) => info.getValue(),
	// 			header: () => 'BC',
	// 			footer: (props) => '34'
	// 		},
	// 		{
	// 			accessorKey: 'ca',
	// 			cell: (info) => info.getValue(),
	// 			header: () => 'CA',
	// 			footer: (props) => '34'
	// 		}
	// 	]
	// },
	{
		header: 'CIRCUIT BREAKER',
		columns: [
			{
				accessorKey: 'at',
				cell: (info) => info.getValue(),
				header: () => 'AT',
				footer: (props) => {
					const currents = props.table
						.getFilteredRowModel()
						.rows.map((row) => row.original.current);
					const load_ampere_trips = props.table
						.getFilteredRowModel()
						.rows.map((row) => row.original.at);
					const at = getComputedMainAT(currents);
					const has_greater_child_at = load_ampere_trips.some((current) => current >= at);

					return renderComponent(AtCell, {
						at: !at ? '' : at.toString(),
						has_greater_child_at
					});
				}
			},
			{
				accessorKey: 'af',
				cell: (info) => info.getValue(),
				header: () => 'AF',
				footer: (props) => ''
			},
			{
				accessorKey: 'pole',
				cell: (info) => info.getValue(),
				header: () => 'Pole',
				footer: (props) => ''
			},
			{
				accessorKey: 'kaic',
				cell: (info) => info.getValue(),
				header: () => 'kAIC',
				footer: (props) => ''
			}
		]
	}
];

export const createRightMostBaseColumns = <T extends PhaseLoadSchedule>(
	phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>,
	highest_unit?: NonNullable<Node['highest_unit_form']>
): ColumnDef<T>[] => [
	{
		header: 'EGC',
		columns: [
			{
				accessorKey: 'egc_size',
				cell: (info) => info.getValue(),
				header: () => 'SIZE',
				footer: (props) => ''
			},
			{
				accessorKey: 'egc_insulation',
				cell: (info) => info.getValue(),
				header: () => 'INSULATION',
				footer: (props) => ''
			}
		]
	},
	{
		header: 'CONDUIT',
		columns: [
			{
				accessorKey: 'conduit_size',
				cell: (info) => info.getValue(),
				header: () => 'SIZE',
				footer: (props) => ''
			},
			{
				accessorKey: 'conduit_type',
				cell: (info) => info.getValue(),
				header: () => 'TYPE',
				footer: (props) => ''
			}
		]
	},
	{
		header: 'Actions',
		cell: ({ row }) => {
			if (row.original.node_type === 'panel') return;
			return renderComponent(ColumnDropdown, {
				node: row.original,
				phase_main_load_form,
				highest_unit
			});
		}
	}
];
