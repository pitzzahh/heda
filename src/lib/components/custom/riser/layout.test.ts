import { describe, expect, it } from 'vitest';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
import type { RiserTree } from '#lib/types/riser.js';
import { default_phases } from '#lib/constants.js';
import { BOX_WIDTH, COLUMN, branchSummary, feederLines, layoutRiser } from './layout.js';

const row = (fields: Partial<PhaseLoadSchedule>) => ({ id: 'x', ...fields }) as PhaseLoadSchedule;

const panel = (id: string, panels: RiserTree[] = [], branch_ats: number[] = []): RiserTree => ({
	row: row({ id, panel_data: { name: id, phase: default_phases.ONE_PHASE } as never, at: 60 }),
	panels,
	branch_ats
});

describe('feederLines (PEC 2017 1.3.2.1(G)(3))', () => {
	it('labels wire size and type, raceway, breaker and ampacity over load current', () => {
		const lines = feederLines(
			row({
				circuit_number: 2,
				at: 225,
				ampere_frames: 250,
				pole: '3',
				conductor_sets: 2,
				conductor_qty: 4,
				conductor_size: 60,
				conductor_insulation: 'THHN-Cu',
				egc_size: 30,
				egc_insulation: 'TW-Cu',
				conduit_size: 63,
				conduit_type: 'PVC',
				ampacity: 261.12,
				current: 180
			})
		);
		expect(lines).toEqual([
			'CKT 2: 225 AT / 250 AF, 3P',
			'2 sets × 4 × 60 mm² THHN-Cu',
			'+ 1 × 30 mm² TW-Cu EGC',
			'in 63 mm ø PVC',
			// (G)(3)(d): 261.12 / 180 = 1.4507 → 1.45.
			'Ampacity/load: 261.12 A / 180 A = 1.45'
		]);
	});

	it('prints "-" where the code gives no value, like the Excel export', () => {
		const lines = feederLines(row({ conductor_size: -1, conduit_size: -1, current: 0 }));
		expect(lines[1]).toBe('- × - mm²');
		expect(lines[3]).toBe('in - mm ø');
		expect(lines[4]).toBe('Ampacity/load: -');
	});
});

describe('branchSummary (PEC 2017 1.3.2.1(G)(1)(a))', () => {
	it('counts branch breakers by rating, largest first', () => {
		expect(branchSummary([20, 20, 30, 20, 15])).toEqual([
			'Branch CBs:',
			'1 × 30 AT, 3 × 20 AT, 1 × 15 AT'
		]);
		expect(branchSummary([])).toEqual(['No branch circuits']);
	});
});

describe('layoutRiser', () => {
	it('centres each panel over the panels it feeds, one column per leaf', () => {
		const tree = panel('MDP', [panel('LP-1'), panel('PP-1', [panel('LP-2'), panel('LP-3')])]);
		const { boxes, labels, width } = layoutRiser(tree);
		const centre = (id: string) => {
			const box = boxes.find((b) => b.id === id)!;
			return box.x + box.width / 2;
		};
		// Plus room for the last column's feeder label.
		expect(width).toBe(3 * COLUMN + 48 + 100);
		expect(centre('LP-2')).toBe(24 + COLUMN * 1.5);
		expect(centre('PP-1')).toBe((centre('LP-2') + centre('LP-3')) / 2);
		expect(centre('MDP')).toBe(24 + (3 * COLUMN) / 2);
		expect(boxes.every((b) => b.width === BOX_WIDTH)).toBe(true);
		// Every panel's feeder is labelled, the start panel's included.
		expect(labels.map((l) => l.id).sort()).toEqual(['LP-1', 'LP-2', 'LP-3', 'MDP', 'PP-1']);
		// Children sit below their feeder.
		const mdp = boxes.find((b) => b.id === 'MDP')!;
		expect(boxes.find((b) => b.id === 'LP-1')!.y).toBeGreaterThan(mdp.y + mdp.height);
	});

	it('draws the service supply, meter and ground above the main panels', () => {
		const root: RiserTree = { row: row({ id: 'root' }), panels: [panel('MDP')], branch_ats: [] };
		const layout = layoutRiser(root, {
			distribution_unit: 'Bldg A',
			phase: default_phases.THREE_PHASE_WYE,
			transformer_kva: 150
		} as never);
		expect(layout.boxes[0]).toMatchObject({
			id: 'root',
			title: 'Bldg A',
			lines: ['3P-Y · 400Y/230 V', 'Transformer: 150 kVA']
		});
		expect(layout.meter).toBeDefined();
		expect(layout.ground).toBeDefined();
		// The service has no feeder of its own; only MDP's is labelled.
		expect(layout.labels.map((l) => l.id)).toEqual(['MDP']);
	});
});
