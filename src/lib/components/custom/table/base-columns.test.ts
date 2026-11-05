import { describe, expect, test } from 'vitest';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from './base-columns';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';

const stub = {} as PhaseLoadSchedule;

function keysOf(columns: { accessorKey?: unknown }[]): unknown[] {
	return columns.map((column) => column.accessorKey);
}

describe('schedule base columns', () => {
	test('left columns open with circuit, description and power', () => {
		const columns = createLeftMostBaseColumns(stub);
		expect(keysOf(columns).slice(0, 5)).toEqual([
			'circuit_number',
			'load_description',
			'voltage',
			'va',
			'current'
		]);
		const breaker = columns.find((column) => column.header === 'CIRCUIT BREAKER');
		expect(keysOf((breaker as { columns: [] }).columns ?? [])).toEqual([
			'at',
			'ampere_frames',
			'pole',
			'kaic'
		]);
	});

	test('right columns close with grounding, conduit and actions', () => {
		const columns = createRightMostBaseColumns(stub);
		const headers = columns.map((column) =>
			typeof column.header === 'string' ? column.header : undefined
		);
		expect(headers).toEqual(['EGC', 'CONDUIT', 'Actions']);
	});
});
