import { renderComponent } from '@/components/ui/data-table/index.js';
import type { ColumnDef } from '@tanstack/table-core';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { SuperValidated } from 'sveltekit-superforms';
import type { Node } from '@/db/schema';
import {
	PoleDropdown,
	LoadDescriptionCell,
	ErrorCell,
	AtFooterCell,
	InsulationsDropdown,
	ActionsColumnDropdown
} from './(components)';

export const createLeftMostBaseColumns = <T extends PhaseLoadSchedule>(
	phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>,
	current_node: PhaseLoadSchedule,
	highest_unit?: NonNullable<Node['highest_unit_form']>,
	latest_circuit_node?: Node
): ColumnDef<T>[] => [
	{
		accessorKey: 'circuit_number',
		// header: () =>
		// 	renderComponent(AddLoadDialog, {
		// 		phase_main_load_form,
		// 		highest_unit,
		// 		latest_circuit_node,
		// 		'aria-label': 'Select row',
		// 		class: 'translate-y-[2px]'
		// 	}),
		header: () => 'CRKT #',
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
				node_type: data.node_type as 'panel' | 'load',
				node: data
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

					if (!at) {
						return renderComponent(ErrorCell, {
							trigger_value: '-',
							tooltip_content: 'No valid AT found for the given current.'
						});
					}

					return at;
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

					if (!current_node.at) {
						return renderComponent(ErrorCell, {
							trigger_value: '-',
							tooltip_content: 'No valid AT found for the given current.'
						});
					}

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
						node: data
					});
				},

				header: () => 'Pole',
				footer: (props) => {
					return renderComponent(PoleDropdown, {
						current_pole: current_node.pole as '1' | '2',
						node: current_node
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
				cell: (info) => {
					if (info.getValue() === -1) {
						return renderComponent(ErrorCell, {
							trigger_value: '-',
							tooltip_content: 'No valid EGC size found for the given AT.'
						});
					}

					return info.getValue();
				},
				header: () => 'SIZE',
				footer: (props) => {
					if (current_node.egc_size === -1) {
						return renderComponent(ErrorCell, {
							trigger_value: '-',
							tooltip_content: 'No valid EGC size found for the given AT.'
						});
					}

					return current_node.egc_size;
				}
			},
			{
				accessorKey: 'egc_insulation',
				cell: (info) => {
					const data = info.row.original;
					return renderComponent(InsulationsDropdown, {
						adjusted_current: data.adjusted_current,
						type: 'egc',
						current_insulation: data.egc_insulation as string,
						node: data
					});
				},
				header: () => 'INSULATION',
				footer: (props) =>
					renderComponent(InsulationsDropdown, {
						adjusted_current: current_node.adjusted_current,
						type: 'egc',
						current_insulation: current_node.egc_insulation as string,
						node: current_node
					})
			}
		]
	},
	{
		header: 'CONDUIT',
		columns: [
			{
				accessorKey: 'conduit_size',
				cell: (info) => {
					const data = info.row.original;
					if (data.adjusted_current > 530 && !data.overrided_conduit_size) {
						return renderComponent(ErrorCell, {
							trigger_value: '-',
							tooltip_content: 'Insufficient Information'
						});
					}

					if (data.conduit_size === -1 && !data.overrided_conduit_size) {
						return renderComponent(ErrorCell, {
							trigger_value: '-',
							tooltip_content: 'No valid conduit size found for the given total conductors.'
						});
					}

					return info.getValue();
				},
				header: () => 'SIZE',
				footer: (props) => {
					if (current_node.adjusted_current > 530 && !current_node.overrided_conduit_size) {
						return renderComponent(ErrorCell, {
							trigger_value: '-',
							tooltip_content: 'Insufficient Information'
						});
					}

					if (current_node.conduit_size === -1 && !current_node.overrided_conduit_size) {
						return renderComponent(ErrorCell, {
							trigger_value: '-',
							tooltip_content: 'No valid conduit size found for the given total conductors.'
						});
					}

					return current_node.conduit_size;
				}
			},
			{
				accessorKey: 'conduit_type',
				cell: (info) => info.getValue(),
				header: () => 'TYPE',
				footer: (props) => current_node.conduit_type
			}
		]
	},
	{
		header: 'Actions',
		cell: ({ row }) => {
			return renderComponent(ActionsColumnDropdown, {
				node: row.original,
				phase_main_load_form,
				highest_unit
			});
		},

		footer: (props) => {
			return renderComponent(ActionsColumnDropdown, {
				node: current_node as PhaseLoadSchedule,
				phase_main_load_form,
				highest_unit
			});
		}
	}
];
