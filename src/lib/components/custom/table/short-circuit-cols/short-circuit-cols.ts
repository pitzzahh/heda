import type { ShortCircuit } from '#lib/types/short-circuit.js';
import type { ColumnDef } from '@tanstack/table-core';
import { renderComponent } from '#lib/components/ui/data-table/index.js';
import { KaicCell, ScStatusCell } from '../(components)/index.js';

/** Fault current in whole amperes; a dash when there is no source to compute it from. */
export function formatAmperes(value: number | null): string {
	return value === null ? '—' : Math.round(value).toLocaleString('en-US');
}

/**
 * The least interrupting rating a breaker needs (PEC 2017 1.10.1.9: at least the current
 * available at its line terminals), in kA rounded up to 0.1 so it never reads below it.
 */
export function formatRequiredKiloamperes(fault_current: number | null): string {
	return fault_current === null ? '—' : (Math.ceil(fault_current / 100) / 10).toFixed(1);
}

/** Per-unit and ohm values to four significant decimals; a dash when absent. */
export function formatImpedance(value: number | null): string {
	return value === null ? '—' : value.toFixed(4);
}

export const shortCircuitColumns = <T extends ShortCircuit>(): ColumnDef<T>[] => [
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
				id: 'conductor_size',
				accessorFn: (row) => row.overrided_conductor_size || row.conductor_size,
				header: () => 'Size (mm²)',
				cell: (info) => info.getValue()
			},
			{
				accessorKey: 'conduit_type',
				header: () => 'Conduit',
				cell: (info) => info.getValue()
			},
			{
				accessorKey: 'length',
				header: () => 'Length (m)',
				cell: (info) => info.getValue()
			}
		]
	},
	{
		header: 'CONDUCTOR Z',
		columns: [
			{
				accessorKey: 'conductor_z_ohm',
				header: () => '(Ω)',
				cell: (info) => formatImpedance(info.getValue<number>())
			},
			{
				accessorKey: 'conductor_z_pu',
				header: () => '(pu)',
				cell: (info) => formatImpedance(info.getValue<number>())
			}
		]
	},
	{
		header: 'MOTOR Z',
		columns: [
			{
				accessorKey: 'motor_z_pu',
				header: () => '(pu)',
				cell: (info) => formatImpedance(info.getValue<number | null>())
			}
		]
	},
	{
		header: 'AT BREAKER (SUPPLY BUS)',
		columns: [
			{
				accessorKey: 'supply_z_pu',
				header: () => 'Z (pu)',
				cell: (info) => formatImpedance(info.getValue<number | null>())
			},
			{
				accessorKey: 'supply_fault_current',
				header: () => 'Isc (A)',
				cell: (info) => formatAmperes(info.getValue<number | null>())
			}
		]
	},
	{
		header: 'AT END OF RUN',
		columns: [
			{
				accessorKey: 'node_fault_current',
				header: () => 'Isc (A)',
				cell: (info) => formatAmperes(info.getValue<number | null>())
			}
		]
	},
	{
		header: 'kAIC',
		columns: [
			{
				id: 'required_interrupting_rating_ka',
				accessorFn: (row) => row.supply_fault_current,
				header: () => 'Required',
				cell: (info) => formatRequiredKiloamperes(info.getValue<number | null>())
			},
			{
				accessorKey: 'interrupting_rating_ka',
				header: () => 'Rating',
				cell: (info) =>
					renderComponent(KaicCell, {
						kaic: info.row.original.interrupting_rating_ka,
						node: info.row.original
					})
			}
		]
	},
	{
		header: 'STATUS',
		accessorKey: 'status',
		cell: (info) => renderComponent(ScStatusCell, { status: info.row.original.status })
	}
];
