// import { createRawSnippet } from 'svelte';
// import { renderSnippet } from '$lib/components/ui/data-table/index.js';
import type { ColumnDef } from '@tanstack/table-core';


export type TThreePhaseLoadSchedule = {
	crkt_num: string;
	load_description: string;
	voltage: number;
	va: number;
	// Current section
	ab: number;
	bc: number;
	ca: number;
	// Circuit Breaker section
	at: number;
	pole: number;
	kaic: number;
	// Conductor section
	sets: number;
	p_plus_p_size: string;
	p_plus_p_insulation: string;
	three_phase_size: string;
	three_phase_insulation: string;
	egc_size: string;
	egc_insulation: string;
	conduit_size: string;
	conduit_type: string;
};

export const createLeftMostBaseColumns = <T>(): ColumnDef<T>[] => [
	{
		accessorKey: 'crkt_num',
		header: 'CRKT No.'
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

export const createRightMostBaseColumns = <T>(): ColumnDef<T>[] => [
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

export const columns: ColumnDef<TThreePhaseLoadSchedule>[] = [
	...createLeftMostBaseColumns<TThreePhaseLoadSchedule>(),
	{
		header: 'CONDUCTOR',
		columns: [
			{
				accessorKey: 'sets',
				cell: (info) => info.getValue(),
				header: () => 'Sets'
			},
			{
				header: 'P+P',
				columns: [
					{
						accessorKey: 'p_plus_p_size',
						header: () => 'Size',
						cell: (info) => info.getValue()
					},
					{
						accessorKey: 'p_plus_p_insulation',
						header: 'INSULATION',
						cell: (info) => info.getValue()
					}
				]
			},
			{
				header: '3P',
				columns: [
					{
						accessorKey: 'three_phase_size',
						header: () => 'Size',
						cell: (info) => info.getValue()
					},
					{
						accessorKey: 'three_phase_insulation',
						header: 'INSULATION',
						cell: (info) => info.getValue()
					}
				]
			}
		]
	},
	...createRightMostBaseColumns<TThreePhaseLoadSchedule>()
];
