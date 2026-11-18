import type { ColumnDef } from '@tanstack/table-core';
import { describe, expect, test } from 'vitest';
import { rowPhaseVa } from '#lib/utils/computations/index.js';
import { threePhaseCols } from './three-phase-cols.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

function keyOf(column: ColumnDef<PhaseLoadSchedule>): unknown {
	return 'accessorKey' in column ? column.accessorKey : (column.id ?? column.header);
}

describe('threePhaseCols', () => {
	test('adds the phase and per-phase VA right after the current', () => {
		const columns = threePhaseCols({} as PhaseLoadSchedule, 'three_phase_wye');
		const keys = columns.map(keyOf);
		const current = keys.indexOf('current');
		expect(keys.slice(current, current + 3)).toEqual(['current', 'phase', 'VA PER PHASE']);
		const per_phase = columns[current + 2] as { columns: ColumnDef<PhaseLoadSchedule>[] };
		expect(per_phase.columns.map(keyOf)).toEqual(['phase_va_A', 'phase_va_B', 'phase_va_C']);
		expect(columns.at(-1)).toMatchObject({ header: 'Actions' });
		expect(columns.some((column) => column.header === 'CONDUCTOR')).toBe(true);
	});

	test('lists VA per line pair, totalled from pair_va, on a delta panel', () => {
		const panel = { pair_va: { AB: 1_000, BC: 2_000, CA: 3_000 } } as PhaseLoadSchedule;
		const columns = threePhaseCols(panel, 'three_phase_delta');
		const per_pair = columns.find((column) => column.header === 'VA PER LINE PAIR') as unknown as {
			columns: (ColumnDef<PhaseLoadSchedule> & { footer: () => number })[];
		};
		expect(per_pair.columns.map(keyOf)).toEqual(['phase_va_AB', 'phase_va_BC', 'phase_va_CA']);
		expect(per_pair.columns.map((column) => column.footer())).toEqual([1_000, 2_000, 3_000]);
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

	test('puts a line-to-line circuit on its pair only', () => {
		const row = { va: 2_300, phase: 'BC' } as PhaseLoadSchedule;
		expect(['AB', 'BC', 'CA'].map((p) => rowPhaseVa(row, p as 'AB'))).toEqual(['', 2_300, '']);
	});
});
