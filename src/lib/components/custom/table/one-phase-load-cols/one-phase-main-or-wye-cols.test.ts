import { describe, expect, test } from 'vitest';
import { onePhaseMainOrWyeCols } from './one-phase-main-or-wye-cols.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

describe('onePhaseMainOrWyeCols', () => {
	test('composes base columns around the conductor group', () => {
		const columns = onePhaseMainOrWyeCols({} as PhaseLoadSchedule);
		expect(columns[0]).toMatchObject({ accessorKey: 'circuit_number' });
		expect(columns.at(-1)).toMatchObject({ header: 'Actions' });
		expect(columns.some((column) => column.header === 'CONDUCTOR')).toBe(true);
	});
});
