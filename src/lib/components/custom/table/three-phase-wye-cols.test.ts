import type { ColumnDef } from '@tanstack/table-core';
import { describe, expect, test } from 'vitest';
import { rowPhaseVa } from '#lib/utils/computations/index.js';
import { threePhaseWyeCols } from './three-phase-wye-cols.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

function keyOf(column: ColumnDef<PhaseLoadSchedule>): unknown {
	return 'accessorKey' in column ? column.accessorKey : (column.id ?? column.header);
}

describe('threePhaseWyeCols', () => {
	test('adds the phase and per-phase VA right after the current', () => {
		const columns = threePhaseWyeCols({} as PhaseLoadSchedule);
		const keys = columns.map(keyOf);
		const current = keys.indexOf('current');
		expect(keys.slice(current, current + 3)).toEqual(['current', 'phase', 'VA PER PHASE']);
		const per_phase = columns[current + 2] as { columns: ColumnDef<PhaseLoadSchedule>[] };
		expect(per_phase.columns.map(keyOf)).toEqual(['phase_va_A', 'phase_va_B', 'phase_va_C']);
		expect(columns.at(-1)).toMatchObject({ header: 'Actions' });
		expect(columns.some((column) => column.header === 'CONDUCTOR')).toBe(true);
	});
});

describe('rowPhaseVa', () => {
	test('puts single-phase VA on its own phase only', () => {
		const row = { va: 1_840, phase: 'B' } as PhaseLoadSchedule;
		expect(['A', 'B', 'C'].map((p) => rowPhaseVa(row, p as 'A'))).toEqual(['', 1_840, '']);
	});

	test('splits three-phase VA evenly (D6 6-kVA package ACU → 2 000 VA per phase)', () => {
		const row = { va: 6_000, phase: 'ABC' } as PhaseLoadSchedule;
		expect(['A', 'B', 'C'].map((p) => rowPhaseVa(row, p as 'A'))).toEqual([2_000, 2_000, 2_000]);
	});
});
