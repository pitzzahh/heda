// import { createRawSnippet } from 'svelte';
// import { renderSnippet } from '$lib/components/ui/data-table/index.js';
import type { ColumnDef } from '@tanstack/table-core';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';

export const createLeftMostBaseColumns = <T extends PhaseLoadSchedule>(): ColumnDef<T>[] => [
	{
		accessorKey: 'crkt_num',
		header: 'CRKT No.',
	},
	{
		accessorKey: 'load_description',
		header: 'Load Description'
	},
	{
		accessorKey: 'voltage',
		header: 'Voltage'
	},
	{
		accessorKey: 'va',
		header: 'VA'
	},
	{
		header: 'CURRENT',
		columns: [
			{
				accessorKey: 'ab',
				cell: (info) => info.getValue(),
				header: () => 'AB'
			},
			{
				accessorKey: 'bc',
				cell: (info) => info.getValue(),
				header: () => 'BC'
			},
			{
				accessorKey: 'ca',
				cell: (info) => info.getValue(),
				header: () => 'CA'
			}
		]
	},
	{
		header: 'CIRCUIT BREAKER',
		columns: [
			{
				accessorKey: 'at',
				cell: (info) => info.getValue(),
				header: () => 'AF'
			},
			{
				accessorKey: 'pole',
				cell: (info) => info.getValue(),
				header: () => 'Pole'
			},
			{
				accessorKey: 'kaic',
				cell: (info) => info.getValue(),
				header: () => 'kAIC'
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
				header: () => 'SIZE'
			},
			{
				accessorKey: 'egc_insulation',
				cell: (info) => info.getValue(),
				header: () => 'INSULATION'
			}
		]
	},
	{
		header: 'CONDUIT',
		columns: [
			{
				accessorKey: 'conduit_size',
				cell: (info) => info.getValue(),
				header: () => 'SIZE'
			},
			{
				accessorKey: 'conduit_type',
				cell: (info) => info.getValue(),
				header: () => 'TYPE'
			}
		]
	}
];