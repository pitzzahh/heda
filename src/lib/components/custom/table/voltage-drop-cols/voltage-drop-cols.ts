import type { VoltageDrop } from '@/types/voltage-drop';
import type { ColumnDef } from '@tanstack/table-core';

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
				cell: (info) => info.getValue(),
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
	}
];
