import { describe, expect, test } from 'vitest';
import { voltageDropColumns } from './voltage-drop-cols';
import type { VoltageDrop } from '#lib/types/voltage-drop';

describe('voltageDropColumns', () => {
	test('spans from/to nodes through cable to results', () => {
		const columns = voltageDropColumns<VoltageDrop>();
		const keys = columns.map((column) => column.accessorKey);
		expect(keys.slice(0, 2)).toEqual(['from_node_name', 'to_node_name']);
		const headers = columns.map((column) => column.header).filter((h) => typeof h === 'string');
		expect(headers).toContain('CABLE');
	});
});
