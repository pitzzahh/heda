import { describe, expect, it } from 'vitest';
import { default_load_types, default_phases } from '#lib/constants.js';
import { currentOfHorsepower, horsepowerOfCurrent } from './index.js';
import { defaultPhaseAssignment, isThreePhaseLoadType, phaseOverride } from './three-phase.js';

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

	it('falls back to A without a circuit number', () => {
		expect(defaultPhaseAssignment(undefined)).toBe('A');
		expect(defaultPhaseAssignment(0)).toBe('A');
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
