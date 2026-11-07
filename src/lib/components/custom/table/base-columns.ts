import { renderComponent } from '#lib/components/ui/data-table/index.js';
import type { ColumnDef } from '@tanstack/table-core';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import type { Node } from '#lib/types/db/index.js';
import {
	PoleDropdown,
	LoadDescriptionCell,
	ErrorCell,
	AtFooterCell,
	InsulationsDropdown,
	ActionsColumnDropdown
} from './(components)/index.js';

export const createLeftMostBaseColumns = <T extends PhaseLoadSchedule>(
	current_node: PhaseLoadSchedule
): ColumnDef<T>[] => [
	{
		accessorKey: 'circuit_number',
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
		footer: () => {
			return current_node.va;
		}
	},
	{
		accessorKey: 'current',
		header: 'CURRENT (A)',
		footer: () => {
			return current_node.current.toFixed(2);
		}
	},

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
				footer: () => current_node.ampere_frames
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
				footer: () => {
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
				footer: () => current_node.kaic || ''
			}
		]
	}
];

export const createRightMostBaseColumns = <T extends PhaseLoadSchedule>(
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
				footer: () => {
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
				footer: () =>
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
				footer: () => {
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
				footer: () => current_node.conduit_type
			}
		]
	},
	{
		header: 'Actions',
		cell: ({ row }) => {
			return renderComponent(ActionsColumnDropdown, {
				node: row.original,
				highest_unit
			});
		},

		footer: () => {
			return renderComponent(ActionsColumnDropdown, {
				node: current_node as PhaseLoadSchedule,
				highest_unit
			});
		}
	}
];
