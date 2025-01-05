import type { VoltageDrop } from '@/types/voltage-drop';
import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '@/components/ui/data-table';
import VdCurrentCell from '../(components)/vd-current-cell.svelte';
import { ActionsColumnDropdown } from '../(components)';

export const voltageDropColumns = <T extends VoltageDrop>(): ColumnDef<T>[] => [
	{
		accessorKey: 'from_node_name',
		cell: (info) => info.getValue(),
		header: () => 'From NODE'
	},
	{
		accessorKey: 'to_node_name',
		cell: (info) => info.getValue(),
		header: () => 'To NODE'
	},
	{
		header: 'CABLE',
		columns: [
			{
				accessorKey: 'conductor_sets',
				header: () => 'Sets',
				cell: (info) => info.getValue()
			},
			{
				accessorKey: 'conductor_qty',
				header: () => 'Qty',
				cell: (info) => info.getValue()
			},
			{
				accessorKey: 'conductor_size',
				header: () => 'Size (mm²)',
				cell: (info) => {
					// const data = info.row.original;
					// if (data.adjusted_current > 530 && !data.overrided_conductor_size) {
					// 	return renderComponent(ErrorCell, {
					// 		trigger_value: '-',
					// 		tooltip_content: 'The number of set is not sufficient to size the feeder conductor'
					// 	});
					// }
					return info.getValue();
				}
			}
		]
	},
	{
		header: 'Z',
		columns: [
			{
				accessorKey: 'z',
				cell: (info) => info.getValue(),
				header: () => '(Ω/305m)'
			}
		]
	},
	{
		header: 'LENGTH',
		columns: [
			{
				accessorKey: 'length',
				cell: (info) => info.getValue(),
				header: '(m)'
			}
		]
	},
	{
		header: 'CURRENT',
		columns: [
			{
				accessorKey: 'current',
				cell: (info) => {
					const current = info.getValue();
					const node = info.row.original;

					return renderComponent(VdCurrentCell, {
						current,
						is_at_used: node.is_at_used_as_currents_value as boolean,
						node
					});
				},
				header: '(A)'
			}
		]
	},
	{
		header: 'Actual Z',
		columns: [
			{
				accessorKey: 'actual_z',
				cell: (info) => info.getValue(),
				header: () => '(Ω)'
			}
		]
	},
	{
		header: 'VOLTAGE DROP (V)',
		columns: [
			{
				accessorKey: 'voltage_per_segment',
				cell: (info) => info.getValue(),
				header: () => 'Per Segment'
				// footer: (props) => ""
			},
			{
				accessorKey: 'voltage_at_end_circuit',
				cell: (info) => info.getValue(),
				header: () => 'At End Circuit'
				// footer: (props) => ""
			}
		]
	},
	{
		header: 'VOLTAGE AT RECEIVING END (V)',
		accessorKey: 'voltage_at_receiving_end',
		cell: (info) => info.getValue()
	},
	{
		header: 'PERCENT VOLTAGE DROP (%)',
		accessorKey: 'percent_voltage_drop',
		cell: (info) => info.getValue()
	},

	{
		header: 'Actions',
		cell: ({ row }) => {
			return renderComponent(ActionsColumnDropdown, {
				node: row.original,
				is_in_vd_table: true
			});
		}
	}
];
