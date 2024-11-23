import type { ColumnDef } from '@tanstack/table-core';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from '../base-columns';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';

export const onePhaseDeltaCols: ColumnDef<PhaseLoadSchedule>[] = [
	...createLeftMostBaseColumns<PhaseLoadSchedule>(),
	{
		header: 'CONDUCTOR',
		columns: [
			{
				accessorKey: 'sets',
				cell: (info) => info.getValue(),
				header: () => 'Sets'
			},
			{
				header: 'P + P',
				columns: [
					{
						accessorKey: 'p_plus_p_size',
						header: () => 'SIZE',
						cell: (info) => info.getValue()
					},
					{
						accessorKey: 'p_plus_p_insulation',
						header: 'INSULATION',
						cell: (info) => info.getValue()
					}
				]
			}
		]
	},
	...createRightMostBaseColumns<PhaseLoadSchedule>()
];