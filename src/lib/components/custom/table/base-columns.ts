import { renderComponent } from '@/components/ui/data-table/index.js';
import type { ColumnDef } from '@tanstack/table-core';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import { ColumnDropdown } from '@/components/custom/table/(components)';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { SuperValidated } from 'sveltekit-superforms';
import type { Node } from '@/db/schema';
import { AddLoadDialog } from '@/components/custom/load';
import AtFooterCell from './(components)/at-footer-cell.svelte';
import InsulationsDropdown from './(components)/insulations-dropdown.svelte';
import PoleDropdown from './(components)/pole-dropdown.svelte';
import LoadDescriptionCell from './(components)/load-description-cell.svelte';

export const createLeftMostBaseColumns = <T extends PhaseLoadSchedule>(
	phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>,
	current_node: PhaseLoadSchedule,
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
		header: 'LOAD DESCRIPTION',
		cell: (info) => {
			const data = info.row.original;

			if (data.load_data && data.load_data.config_preference === 'DEFAULT') {
				return info.getValue();
			}

			return renderComponent(LoadDescriptionCell, {
				load_description: data.load_description,
				node_id: data.id,
				node_type: data.node_type as 'panel' | 'load'
			});
		},
		footer: () => 'MAIN'
	},
	{
		accessorKey: 'voltage',
		header: 'VOLTAGE (V)',
		footer: (props) => {
			// render the voltage of first index since all voltage cells are the same
			return props.table.getFilteredRowModel().rows.at(0)?.original.voltage;
		}
	},
	{
		accessorKey: 'va',
		header: 'APPARENT POWER (VA)',
		footer: (props) => {
			// return props.table.getFilteredRowModel().rows.reduce((sum, row) => sum + row.original.va, 0);
			return current_node.va;
		}
	},
	{
		accessorKey: 'current',
		header: 'CURRENT (A)',
		footer: (props) => {
			return current_node.current.toFixed(2);
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
				cell: (info) => {
					const at = info.getValue();
					return !at ? '' : at;
				},
				header: () => 'AT',
				footer: (props) => {
					// const total_current = parseFloat(
					// 	props.table
					// 		.getFilteredRowModel()
					// 		.rows.reduce((sum, row) => sum + row.original.current, 0)
					// 		.toFixed(2)
					// );
					// const child_load_ampere_trips = props.table
					// 	.getFilteredRowModel()
					// 	.rows.map((row) => row.original.at || row.original.overrided_at)
					// 	.filter(Boolean);
					// const main_at = current_node.overrided_at || computeAmpereTrip(total_current);
					// const has_greater_child_at = child_load_ampere_trips.some(
					// 	(child_at) => child_at && child_at >= main_at
					// );

					// return renderComponent(AtFooterCell, {
					// 	at: !main_at ? '' : main_at.toString(),
					// 	has_greater_child_at
					// });
					const child_load_ampere_trips = props.table
						.getFilteredRowModel()
						.rows.map((row) => row.original.at || row.original.overrided_at)
						.filter(Boolean);

					const has_greater_child_at = child_load_ampere_trips.some(
						(child_at) => child_at && child_at >= current_node.at
					);

					return renderComponent(AtFooterCell, {
						at: !current_node.at ? '' : current_node.at.toString(),
						has_greater_child_at
					});
				}
			},
			{
				accessorKey: 'ampere_frames',
				cell: (info) => info.getValue(),
				header: () => 'AF',
				footer: (props) => current_node.ampere_frames
			},
			{
				accessorKey: 'pole',
				cell: (info) => {
					const data = info.row.original;
					return renderComponent(PoleDropdown, {
						current_pole: data.pole as '1' | '2',
						node_id: data.id
					});
				},

				header: () => 'Pole',
				footer: (props) => {
					return renderComponent(PoleDropdown, {
						current_pole: current_node.pole as '1' | '2',
						node_id: current_node.id
					});
				}
			},
			{
				accessorKey: 'kaic',
				cell: (info) => info.getValue(),
				header: () => 'kAIC',
				footer: (props) => current_node.kaic || ''
			}
		]
	}
];

export const createRightMostBaseColumns = <T extends PhaseLoadSchedule>(
	phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>,
	current_node: PhaseLoadSchedule,
	highest_unit?: NonNullable<Node['highest_unit_form']>
): ColumnDef<T>[] => [
	{
		header: 'EGC',
		columns: [
			{
				accessorKey: 'egc_size',
				cell: (info) => info.getValue(),
				header: () => 'SIZE',
				footer: (props) => current_node.egc_size
			},
			{
				accessorKey: 'egc_insulation',
				cell: (info) => {
					const data = info.row.original;
					return renderComponent(InsulationsDropdown, {
						adjusted_current: data.adjusted_current,
						type: 'egc',
						current_insulation: data.egc_insulation as string,
						node_id: data.id
					});
				},
				header: () => 'INSULATION',
				footer: (props) =>
					renderComponent(InsulationsDropdown, {
						adjusted_current: current_node.adjusted_current,
						type: 'egc',
						current_insulation: current_node.egc_insulation as string,
						node_id: current_node.id
					})
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
				footer: (props) => current_node.conduit_size
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
			return renderComponent(ColumnDropdown, {
				node: row.original,
				phase_main_load_form,
				highest_unit
			});
		},

		footer: (props) => {
			return renderComponent(ColumnDropdown, {
				node: current_node as PhaseLoadSchedule,
				phase_main_load_form,
				highest_unit
			});
		}
	}
];
