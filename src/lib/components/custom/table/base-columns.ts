/* eslint-disable @typescript-eslint/no-unused-vars */
// import { createRawSnippet } from 'svelte';
import { renderComponent } from '@/components/ui/data-table/index.js';
import type { ColumnDef } from '@tanstack/table-core';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import { DataTableAddLoad } from '@/components/custom/table/(components)';
import type { PhaseMainLoadSchema } from '@/schema/load';
import type { SuperValidated } from 'sveltekit-superforms';
import ColumnDropdown from './column-dropdown.svelte';

export const createLeftMostBaseColumns = <T extends PhaseLoadSchedule>(
	phase_main_load_form: SuperValidated<PhaseMainLoadSchema>
): ColumnDef<T>[] => [
	{
		accessorKey: 'circuit_number',
		header: () =>
			renderComponent(DataTableAddLoad, {
				phase_main_load_form,
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
		footer: (props) => '440'
	},
	{
		accessorKey: 'va',
		header: 'VA',
		footer: (props) => '6300'
	},
	{
		header: 'CURRENT',
		columns: [
			{
				accessorKey: 'ab',
				cell: (info) => info.getValue(),
				header: () => 'AB',
				footer: (props) => '34'
			},
			{
				accessorKey: 'bc',
				cell: (info) => info.getValue(),
				header: () => 'BC',
				footer: (props) => '34'
			},
			{
				accessorKey: 'ca',
				cell: (info) => info.getValue(),
				header: () => 'CA',
				footer: (props) => '34'
			}
		]
	},
	{
		header: 'CIRCUIT BREAKER',
		columns: [
			{
				accessorKey: 'at',
				cell: (info) => info.getValue(),
				header: () => 'AT',
				footer: (props) => '65'
			},
			{
				accessorKey: 'af',
				cell: (info) => info.getValue(),
				header: () => 'AF',
				footer: (props) => '65'
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
				footer: (props) => '44'
			}
		]
	}
];

export const createRightMostBaseColumns = <T extends PhaseLoadSchedule>(): ColumnDef<T>[] => [
	{
		header: 'EGC',
		columns: [
			{
				accessorKey: 'egc_size',
				cell: (info) => info.getValue(),
				header: () => 'SIZE',
				footer: (props) => '24 AWG'
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
			return renderComponent(ColumnDropdown, { node_id: (row.original as any).id as string });
		}
	}
];
