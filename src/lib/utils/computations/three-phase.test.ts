import { describe, expect, it } from 'vitest';
import { default_load_types, default_phases } from '#lib/constants.js';
import { currentOfHorsepower, horsepowerOfCurrent } from './index.js';
import {
	balanceSplit,
	defaultPhaseAssignment,
	isThreePhaseLoadType,
	phaseOf,
	phaseOverride,
	supplyError
} from './three-phase.js';

// The calculations and PEC tables are tested in crates/heda-core; these are the UI's helpers.
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
		expect([1, 2, 3, 4, 5, 6, 7, 8, 12, 13].map((n) => defaultPhaseAssignment(n))).toEqual([
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

	it('rotates line pairs AB, BC, CA on a delta panel', () => {
		const delta = default_phases.THREE_PHASE_DELTA;
		expect([1, 3, 5, 7].map((n) => defaultPhaseAssignment(n, delta))).toEqual([
			'AB',
			'BC',
			'CA',
			'AB'
		]);
		expect(phaseOverride('BC', 3, delta)).toBeUndefined();
		expect(phaseOverride('CA', 3, delta)).toBe('CA');
		// A wye phase left on a circuit moved under delta falls back to its pair, and back.
		expect(phaseOf({ circuit_number: 3, phase_assignment: 'C' }, delta)).toBe('BC');
		expect(phaseOf({ circuit_number: 3, phase_assignment: 'CA' })).toBe('B');
	});
});

describe('supplyError', () => {
	const wye = { node_type: 'panel', panel_data: { phase: default_phases.THREE_PHASE_WYE } };
	const one = { node_type: 'panel', panel_data: { phase: default_phases.ONE_PHASE } };
	const motor = { load_data: { load_type: default_load_types.THREE_P_MOTOR__RATED_CURRENT } };
	const lights = { load_data: { load_type: default_load_types.LIGHTING_LOAD } };

	const delta = { node_type: 'panel', panel_data: { phase: default_phases.THREE_PHASE_DELTA } };

	it('needs a three-phase supply for a three-phase circuit (D6, D14)', () => {
		expect(supplyError({ node: motor, parent: wye })).toBeNull();
		expect(supplyError({ node: motor, parent: delta })).toBeNull();
		expect(supplyError({ node: motor, parent: one })).toMatch(/three-phase supply/);
		expect(supplyError({ node: wye, parent: one })).toMatch(/3P-Y/);
		expect(
			supplyError({
				node: motor,
				parent: { node_type: 'root', highest_unit_form: { phase: default_phases.THREE_PHASE_WYE } }
			})
		).toBeNull();
	});

	it('keeps wye and delta panels on their own system', () => {
		expect(supplyError({ node: delta, parent: delta })).toBeNull();
		expect(supplyError({ node: delta, parent: wye })).toMatch(/3P-Δ/);
		expect(supplyError({ node: wye, parent: delta })).toMatch(/3P-Y/);
		expect(supplyError({ node: one, parent: delta })).toBeNull();
	});

	it('takes single-phase circuits anywhere', () => {
		expect(supplyError({ node: lights, parent: one })).toBeNull();
		expect(supplyError({ node: one, parent: wye })).toBeNull();
	});

	it('keeps a panel three-phase while it feeds three-phase circuits', () => {
		expect(supplyError({ node: one, parent: wye, children: [motor] })).toMatch(/stay three-phase/);
		expect(supplyError({ node: delta, parent: delta, children: [motor] })).toBeNull();
		expect(supplyError({ node: one, parent: wye, children: [lights] })).toBeNull();
	});
});

describe('currentOfHorsepower', () => {
	it('stores a motor picked by horsepower as its full-load current (PEC 2017 Tables 4.30.14.2, 4.30.14.4)', () => {
		expect(currentOfHorsepower(default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER, '1')).toBe('8');
		expect(currentOfHorsepower(default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER, '1/6')).toBe(
			'2.2'
		);
		// 400 V on 400Y/230 V, 230 V on delta.
		expect(currentOfHorsepower(default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER, '25')).toBe(
			'44'
		);
		expect(
			currentOfHorsepower(
				default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER,
				'25',
				default_phases.THREE_PHASE_DELTA
			)
		).toBe('68');
	});

	it('has no current for a horsepower the column leaves out, or for other load types', () => {
		// Table 4.30.14.4 prints no 400 V current for 450 HP.
		expect(
			currentOfHorsepower(default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER, '450')
		).toBeUndefined();
		expect(currentOfHorsepower(default_load_types.LIGHTING_LOAD, '1')).toBeUndefined();
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
		// On delta the same 25 HP motor is stored as its 230 V current.
		expect(
			horsepowerOfCurrent(
				default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER,
				'68',
				default_phases.THREE_PHASE_DELTA
			)
		).toBe('25');
	});

	it('passes other load types through and drops currents off the table', () => {
		expect(horsepowerOfCurrent(default_load_types.LIGHTING_LOAD, '1000')).toBe('1000');
		expect(horsepowerOfCurrent(default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER, '9')).toBe(
			undefined
		);
	});
});

describe('balanceSplit', () => {
	it("hands over a three-phase sub-panel's own VA per phase or line pair", () => {
		const phase_va = { A: 3000, B: 0, C: 500 };
		expect(balanceSplit({ phase: 'ABC', phase_va }, default_phases.THREE_PHASE_WYE)).toEqual([
			3000, 0, 500
		]);
		const pair_va = { AB: 1, BC: 2, CA: 3 };
		expect(balanceSplit({ phase: 'ABC', pair_va }, default_phases.THREE_PHASE_DELTA)).toEqual([
			1, 2, 3
		]);
	});

	it('leaves single-phase circuits, plain three-phase loads and mismatched supplies alone', () => {
		expect(balanceSplit({ phase: 'A' }, default_phases.THREE_PHASE_WYE)).toBeUndefined();
		expect(balanceSplit({ phase: 'ABC' }, default_phases.THREE_PHASE_WYE)).toBeUndefined();
		const pair_va = { AB: 1, BC: 2, CA: 3 };
		expect(balanceSplit({ phase: 'ABC', pair_va }, default_phases.THREE_PHASE_WYE)).toBeUndefined();
	});
});
