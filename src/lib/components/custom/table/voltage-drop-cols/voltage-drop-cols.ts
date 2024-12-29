import type { ColumnDef } from '@tanstack/table-core';

export const voltageDropColumns = <T extends any>(): ColumnDef<T>[] => [
	{
		accessorKey: 'to_node',
		header: () => 'To NODE'
		// footer: () => 'Total'
	},
	{
		header: 'CABLE',
		columns: [
			{
				accessorKey: 'cable_sets',
				cell: (info) => info.getValue(),
				header: () => 'Sets'
				// footer: (props) => ""
			},
			{
				accessorKey: 'cable_qty',
				cell: (info) => info.getValue(),
				header: () => 'Qty'
				// footer: (props) => ''
			},
			{
				accessorKey: 'cable_size',
				cell: (info) => info.getValue(),
				header: () => 'Size (mm2)'
				// footer: (props) => ''
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
				// footer: (props) => ""
			}
		]
	},
	{
		header: 'LENGTH CURRENT',
		columns: [
			{
				accessorKey: '(m)',
				cell: (info) => info.getValue(),
				header: () => '(m)'
				// footer: (props) => ""
			},
			{
				accessorKey: '(A)',
				cell: (info) => info.getValue(),
				header: () => '(A)'
				// footer: (props) => ""
			},
			{
				accessorKey: '(Ω)',
				cell: (info) => info.getValue(),
				header: () => '(Ω)'
				// footer: (props) => ""
			}
		]
	},
	{
		header: 'Z',
		columns: [
			{
				accessorKey: 'zz',
				cell: (info) => info.getValue(),
				header: () => '(Ω)'
				// footer: (props) => ""
			}
		]
	},
	{
		header: 'VOLTAGE DROP (V)',
		columns: [
			{
				accessorKey: 'per_segment',
				cell: (info) => info.getValue(),
				header: () => 'Per Segment'
				// footer: (props) => ""
			},
			{
				accessorKey: 'at_end_circuit',
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
