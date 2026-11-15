import type { ColumnDef } from '@tanstack/table-core';
import { describe, expect, test } from 'vitest';
import { createLeftMostBaseColumns, createRightMostBaseColumns } from './base-columns.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

const stub = {} as PhaseLoadSchedule;

function keysOf(columns: ColumnDef<PhaseLoadSchedule>[]): unknown[] {
	return columns.map((column) => ('accessorKey' in column ? column.accessorKey : undefined));
}

function subcolumnsOf(column: ColumnDef<PhaseLoadSchedule> | undefined): unknown[] {
	if (!column || !('columns' in column) || !column.columns) return [];
	return keysOf(column.columns as ColumnDef<PhaseLoadSchedule>[]);
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
		expect(subcolumnsOf(breaker)).toEqual(['at', 'ampere_frames', 'pole', 'kaic']);
	});

	test('right columns close with grounding, conduit and actions', () => {
		const columns = createRightMostBaseColumns(stub);
		const headers = columns.map((column) =>
			typeof column.header === 'string' ? column.header : undefined
		);
		expect(headers).toEqual(['EGC', 'CONDUIT', 'Actions']);
	});
});
