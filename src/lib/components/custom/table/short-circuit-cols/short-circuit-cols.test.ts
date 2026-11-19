import type { ColumnDef } from '@tanstack/table-core';
import { describe, expect, test } from 'vitest';
import {
	formatAmperes,
	formatImpedance,
	formatRequiredKiloamperes,
	shortCircuitColumns
} from './short-circuit-cols.js';
import type { ShortCircuit } from '#lib/types/short-circuit.js';

function leafKeys(columns: ColumnDef<ShortCircuit>[]): unknown[] {
	return columns.flatMap((column) =>
		'columns' in column && column.columns
			? leafKeys(column.columns)
			: ['accessorKey' in column ? column.accessorKey : column.id]
	);
}

describe('shortCircuitColumns', () => {
	test('runs from the nodes through the cable to the PEC 1.10.1.9 check', () => {
		expect(leafKeys(shortCircuitColumns<ShortCircuit>())).toEqual([
			'from_node_name',
			'to_node_name',
			'conductor_sets',
			'conductor_size',
			'conduit_type',
			'length',
			'conductor_z_ohm',
			'conductor_z_pu',
			'motor_z_pu',
			'supply_z_pu',
			'supply_fault_current',
			'node_fault_current',
			'required_interrupting_rating_ka',
			'interrupting_rating_ka',
			'status'
		]);
	});
});

describe('formatting', () => {
	test('rounds amperes with separators and dashes missing values', () => {
		expect(formatAmperes(17_391.304)).toBe('17,391');
		expect(formatAmperes(0)).toBe('0');
		expect(formatAmperes(null)).toBe('—');
	});

	test('rounds the required rating up, so it never reads below the fault current', () => {
		// PEC 2017 App. D Ex. D13 bus: 17,322 A needs at least 17.4 kA, not 17.3.
		expect(formatRequiredKiloamperes(17_322)).toBe('17.4');
		expect(formatRequiredKiloamperes(17_300)).toBe('17.3');
		expect(formatRequiredKiloamperes(null)).toBe('—');
	});

	test('shows impedances to four decimals', () => {
		expect(formatImpedance(0.0503)).toBe('0.0503');
		expect(formatImpedance(0.040311)).toBe('0.0403');
		expect(formatImpedance(null)).toBe('—');
	});
});
