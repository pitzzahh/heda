import { describe, expect, it } from 'vitest';
import { THREE_PHASE_MOTOR_FLC_400V, default_load_types, default_phases } from '#lib/constants.js';
import { computeVoltAmpere, horsepowerOfCurrent } from './index.js';
import {
	addToPhaseVa,
	balancedPhaseAssignments,
	defaultPhaseAssignment,
	emptyPhaseVa,
	isThreePhaseLoadType,
	phaseOf,
	phaseOverride,
	singlePhaseCurrent,
	supplyError,
	threePhaseCurrent,
	wyeFeederCurrent
} from './three-phase.js';

describe('PEC 2017 App. D Ex. D6: single-family dwelling, 400/230 V 3-phase 4-wire', () => {
	it('6.3 service current: [66 190 VA + 25% (6 000 VA)] ÷ (400 V)(1.732) = 98 A', () => {
		const current = threePhaseCurrent(66_190 + 0.25 * 6_000);
		expect(current).toBeCloseTo(97.7, 1);
		expect(Math.round(current)).toBe(98);
	});
});

describe('PEC 2017 App. D Ex. D8: multifamily dwelling, 400/230 V 3-phase 4-wire', () => {
	it('8.6 service current: 168 000 VA ÷ (400 V)(1.732) = 242 A', () => {
		expect(Math.round(threePhaseCurrent(168_000))).toBe(242);
	});
});

describe('PEC 2017 Table 4.30.14.4: three-phase motor full-load current, 400 V column', () => {
	it.each([
		['1/2', '1.3'],
		['1', '2.3'],
		['10', '18'],
		['25', '44'],
		['100', '165'],
		['500', '786']
	])('%s HP → %s A', (hp, amps) => {
		expect(THREE_PHASE_MOTOR_FLC_400V[hp as keyof typeof THREE_PHASE_MOTOR_FLC_400V]).toBe(amps);
	});

	it('round-trips a 25 HP motor: 44 A × 400 V × 1.732 = 30 483 VA → 44 A', () => {
		const va = computeVoltAmpere({
			load_type: default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER,
			quantity: 1,
			varies: 44
		})!;
		expect(va).toBeCloseTo(30_483.2, 6);
		expect(threePhaseCurrent(va)).toBeCloseTo(44, 10);
	});

	it('multiplies by quantity for rated-current motors', () => {
		const va = computeVoltAmpere({
			load_type: default_load_types.THREE_P_MOTOR__RATED_CURRENT,
			quantity: 2,
			varies: 10
		})!;
		expect(threePhaseCurrent(va)).toBeCloseTo(20, 10);
	});

	it('takes three-phase equipment as VA (D6 6-kVA package ACU)', () => {
		const va = computeVoltAmpere({
			load_type: default_load_types.THREE_P_EQUIPMENT,
			quantity: 1,
			varies: 6_000
		})!;
		expect(va).toBe(6_000);
		expect(threePhaseCurrent(va)).toBeCloseTo(8.66, 2);
	});

	it('leaves single-phase motors at 230 V', () => {
		const va = computeVoltAmpere({
			load_type: default_load_types.ONE_P_MOTOR__RATED_CURRENT,
			quantity: 1,
			varies: 8
		})!;
		expect(va).toBe(1_840); // D7: 1-Hp room acu, 8 A × 230 V
		expect(singlePhaseCurrent(va)).toBe(8);
	});
});

describe('isThreePhaseLoadType', () => {
	it('recognises only the three-phase load types', () => {
		expect(isThreePhaseLoadType(default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER)).toBe(true);
		expect(isThreePhaseLoadType(default_load_types.THREE_P_MOTOR__RATED_CURRENT)).toBe(true);
		expect(isThreePhaseLoadType(default_load_types.THREE_P_EQUIPMENT)).toBe(true);
		expect(isThreePhaseLoadType(default_load_types.ONE_P_MOTOR__RATED_CURRENT)).toBe(false);
		expect(isThreePhaseLoadType(undefined)).toBe(false);
	});
});

describe('phase assignment by circuit number', () => {
	it('rotates rows of two circuits A, B, C', () => {
		expect([1, 2, 3, 4, 5, 6, 7, 8, 12, 13].map(defaultPhaseAssignment)).toEqual([
			'A',
			'A',
			'B',
			'B',
			'C',
			'C',
			'A',
			'A',
			'C',
			'A'
		]);
	});

	it('stores an override only when it differs from the circuit-number phase', () => {
		expect(phaseOverride('B', 3)).toBeUndefined();
		expect(phaseOverride('C', 3)).toBe('C');
	});

	it('falls back to A without a circuit number and keeps an override', () => {
		expect(defaultPhaseAssignment(undefined)).toBe('A');
		expect(defaultPhaseAssignment(0)).toBe('A');
		expect(phaseOf({ circuit_number: 3 })).toBe('B');
		expect(phaseOf({ circuit_number: 3, phase_assignment: 'C' })).toBe('C');
	});
});

describe('wyeFeederCurrent', () => {
	it('equals the PEC D6 formula when the phases are balanced', () => {
		// D8: 168 000 VA spread evenly.
		const balanced = wyeFeederCurrent({ A: 56_000, B: 56_000, C: 56_000 });
		expect(balanced.balanced).toBeCloseTo(threePhaseCurrent(168_000), 10);
		// 56 000 / 230 = 243.5 A vs 242.5 A: 3 × 230 V is 690 V, not 692.8 V.
		expect(balanced.highest_phase).toBeCloseTo(243.48, 2);
		expect(balanced.design).toBe(balanced.highest_phase);
	});

	it('sizes an unbalanced feeder on its most loaded phase', () => {
		const result = wyeFeederCurrent({ A: 9_200, B: 2_300, C: 0 });
		expect(result.balanced).toBeCloseTo(11_500 / 692.8, 10);
		expect(result.highest_phase).toBe(40);
		expect(result.design).toBe(40);
	});

	it('is zero for an empty panel', () => {
		expect(wyeFeederCurrent(emptyPhaseVa())).toEqual({ balanced: 0, highest_phase: 0, design: 0 });
	});
});

describe('addToPhaseVa', () => {
	it('puts single-phase VA on its phase and splits three-phase VA evenly', () => {
		let total = emptyPhaseVa();
		total = addToPhaseVa(total, { va: 1_840, phase: 'A' });
		total = addToPhaseVa(total, { va: 1_500, phase: 'B' });
		total = addToPhaseVa(total, { va: 6_000, phase: 'ABC' });
		expect(total).toEqual({ A: 3_840, B: 3_500, C: 2_000 });
	});
});

describe('supplyError', () => {
	const wye = { node_type: 'panel', panel_data: { phase: default_phases.THREE_PHASE_WYE } };
	const one = { node_type: 'panel', panel_data: { phase: default_phases.ONE_PHASE } };
	const motor = { load_data: { load_type: default_load_types.THREE_P_MOTOR__RATED_CURRENT } };
	const lights = { load_data: { load_type: default_load_types.LIGHTING_LOAD } };

	it('needs a 3P-Y supply for a three-phase circuit (D6)', () => {
		expect(supplyError({ node: motor, parent: wye })).toBeNull();
		expect(supplyError({ node: motor, parent: one })).toMatch(/3P-Y/);
		expect(supplyError({ node: wye, parent: one })).toMatch(/3P-Y/);
		expect(
			supplyError({
				node: motor,
				parent: { node_type: 'root', highest_unit_form: { phase: default_phases.THREE_PHASE_WYE } }
			})
		).toBeNull();
	});

	it('takes single-phase circuits anywhere', () => {
		expect(supplyError({ node: lights, parent: one })).toBeNull();
		expect(supplyError({ node: one, parent: wye })).toBeNull();
	});

	it('keeps a panel 3P-Y while it feeds three-phase circuits', () => {
		expect(supplyError({ node: one, parent: wye, children: [motor] })).toMatch(/stay 3P-Y/);
		expect(supplyError({ node: one, parent: wye, children: [lights] })).toBeNull();
	});
});

describe('balancedPhaseAssignments', () => {
	it('puts the largest load first on the lightest phase, after three-phase shares', () => {
		const result = balancedPhaseAssignments([
			{ id: 'm', va: 3_000, phase: 'ABC' }, // 1 000 VA on each phase
			{ id: 'a', va: 1_000, phase: 'A' },
			{ id: 'b', va: 4_000, phase: 'A' },
			{ id: 'c', va: 2_000, phase: 'A' },
			{ id: 'd', va: 1_500, phase: 'B' }
		]);
		// 4 000 → A (tie, A first); 2 000 → B; 1 500 → C; 1 000 → C (2 500 < 3 000 < 5 000).
		expect(Object.fromEntries(result)).toEqual({ b: 'A', c: 'B', d: 'C', a: 'C' });
		expect(result.has('m')).toBe(false);
	});

	it('leaves an empty panel alone', () => {
		expect(balancedPhaseAssignments([]).size).toBe(0);
	});
});

describe('horsepowerOfCurrent', () => {
	it('maps stored full-load current back to horsepower for the picker', () => {
		expect(horsepowerOfCurrent(default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER, '8')).toBe('1');
		expect(horsepowerOfCurrent(default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER, '44')).toBe(
			'25'
		);
		expect(horsepowerOfCurrent(default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER, '1.3')).toBe(
			'1/2'
		);
	});

	it('passes other load types through and drops currents off the table', () => {
		expect(horsepowerOfCurrent(default_load_types.LIGHTING_LOAD, '1000')).toBe('1000');
		expect(horsepowerOfCurrent(default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER, '9')).toBe(
			undefined
		);
	});
});
