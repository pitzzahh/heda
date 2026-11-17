import { describe, expect, it } from 'vitest';
import { default_hp_current_relationship, default_load_types } from '#lib/constants.js';
import {
	computeAdjustedCurrent,
	computeAmpereTrip,
	computeConductorSize,
	getConduitSize,
	getEgcSize,
	maxConductorsInArea
} from './index.js';

const { LIGHTING_LOAD, CONVENIENCE_OUTLET, ONE_P_MOTOR__RATED_HORSE_POWER, HEATING_EQUIPMENT } =
	default_load_types;

// A panel ("Main") sizes its conductor from the breaker rating, so `at` is the ampacity asked for.
const panel = (
	at: number,
	overrides: Partial<Parameters<typeof computeConductorSize>[0]> = {}
) => ({
	set: 1,
	qty: 2,
	ambient_temp: 30,
	load_type: 'Main' as const,
	at,
	current: 0,
	is_adjustment_factor_dynamic: false,
	...overrides
});

describe('breaker rating, PEC 2017 Table 2.40.1.6(A) and 2.10.2.3(A)', () => {
	it('20 A lighting: 20 × 1.25 = 25 A, a standard rating', () => {
		expect(computeAmpereTrip(20, LIGHTING_LOAD)).toBe(25);
	});

	it('17 A outlets: 17 × 1.25 = 21.25 A → next standard rating 25 A (not 30 A)', () => {
		expect(computeAmpereTrip(17, CONVENIENCE_OUTLET)).toBe(25);
	});

	it('3 hp 1P motor: Table 4.30.14.2 FLC 17 A × 2.5 (Table 4.30.4.2) = 42.5 A → 45 A', () => {
		expect(Number(default_hp_current_relationship['3'])).toBe(17);
		expect(computeAmpereTrip(17, ONE_P_MOTOR__RATED_HORSE_POWER)).toBe(45);
	});

	it('heating is continuous (4.24.1.3(B)): 20 A × 1.25 = 25 A', () => {
		expect(computeAmpereTrip(20, HEATING_EQUIPMENT)).toBe(25);
	});

	it('72 A panel: 72 × 1.25 = 90 A, and 350 A: × 1.25 = 437.5 A → 450 A', () => {
		expect(computeAmpereTrip(72)).toBe(90);
		expect(computeAmpereTrip(350)).toBe(450);
	});

	it('keeps the existing floors: 30 A for panels, 20 A for non-lighting loads', () => {
		expect(computeAmpereTrip(5)).toBe(30);
		expect(computeAmpereTrip(5, CONVENIENCE_OUTLET)).toBe(20);
		expect(computeAmpereTrip(5, LIGHTING_LOAD)).toBe(15);
	});
});

describe('conductor size, PEC 2017 Table 3.10.2.6(B)(16) with 1.10.1.14(C)(1)', () => {
	it('85 A → 30 mm² (60°C column)', () => {
		expect(computeConductorSize(panel(85))).toBe(30);
	});

	it('100 A → 38 mm², its 60°C ampacity', () => {
		expect(computeConductorSize(panel(100))).toBe(38);
	});

	it('110 A → 50 mm²: 38 mm² is limited to 100 A at 60°C, not its 75°C 115 A', () => {
		expect(computeConductorSize(panel(110))).toBe(50);
	});

	it('140 A → 50 mm² and 141 A → 60 mm² (75°C column)', () => {
		expect(computeConductorSize(panel(140))).toBe(50);
		expect(computeConductorSize(panel(141))).toBe(60);
	});

	it('ambient 33°C (factor 0.94) on a 100 A breaker: 100 / 0.94 = 106.4 A → 50 mm²', () => {
		const input = panel(100, { ambient_temp: 33 });
		expect(computeAdjustedCurrent(input)).toBeCloseTo(106.383, 3);
		expect(computeConductorSize(input)).toBe(50);
	});

	it('Table 3.10.2.6(B)(3)(a): 6 conductors × 80%, 30 A / 0.8 = 37.5 A → 8.0 mm²', () => {
		const input = panel(30, { qty: 6, is_adjustment_factor_dynamic: true });
		expect(computeAdjustedCurrent(input)).toBe(37.5);
		expect(computeConductorSize(input)).toBe(8);
	});
});

describe('equipment grounding conductor, PEC 2017 Table 2.50.6.13 (copper)', () => {
	it.each([
		[15, 2],
		[20, 3.5],
		[30, 5.5],
		[60, 5.5],
		[100, 8],
		[200, 14],
		[300, 22],
		[400, 30],
		[500, 30],
		[600, 38],
		[800, 50],
		[1000, 60],
		[1200, 80],
		[1600, 100],
		[2000, 125],
		[2500, 175],
		[3000, 200],
		[4000, 250],
		[5000, 375],
		[6000, 400]
	])('%i A → %s mm²', (at, size) => {
		expect(getEgcSize(at)).toBe(size);
	});

	it('above 6000 A is outside the table', () => {
		expect(getEgcSize(6001)).toBe('error');
	});
});

describe('conduit size, PEC 2017 Ch. 10 Tables 10.1.1.1, 10.1.1.4 (PVC Sch 80) and 10.1.1.5 (THHN)', () => {
	it('Note 7: 0.8 or more of a conductor rounds up, less rounds down', () => {
		// 56 / 6.2 = 9.03 → 9; 105 / 13.9 = 7.55 → 7; 178 / 23.8 = 7.48 → 7; 82 / 8.6 = 9.53 → 9
		expect(maxConductorsInArea(56, 6.2)).toBe(9);
		expect(maxConductorsInArea(105, 13.9)).toBe(7);
		expect(maxConductorsInArea(48, 10)).toBe(5);
		expect(maxConductorsInArea(47.9, 10)).toBe(4);
	});

	it('3 × 2.0 mm² (2 + EGC): 3 × 6.2 = 18.6 mm² ≤ 56 mm² (40% of 15 mm) → 15 mm', () => {
		expect(getConduitSize(2.0, 3)).toBe(15);
	});

	it('2 × 3.5 mm² uses the 31% column: 2 × 8.6 = 17.2 ≤ 44 → 15 mm', () => {
		expect(getConduitSize(3.5, 2)).toBe(15);
	});

	it('1 × 125 mm² uses the 53% column: 236 / 254.5 = 0.93 ≥ 0.8, so Note 7 permits it in 25 mm', () => {
		expect(getConduitSize(125, 1)).toBe(25);
		// 1 × 150 mm²: 236 / 298.6 = 0.79 < 0.8 in 25 mm, so 32 mm
		expect(getConduitSize(150, 1)).toBe(32);
	});

	it('5 × 14 mm² (4 + EGC): 742 / 33.2 = 22.3, 442 / 33.2 = 13.3, 320 / 33.2 = 9.6, 178 / 33.2 = 5.36 → 25 mm', () => {
		expect(getConduitSize(14, 5)).toBe(25);
		expect(getConduitSize(14, 6)).toBe(32);
	});

	it('4 × 100 mm² (3 + EGC): 4 × 208.7 = 834.8; 742 / 208.7 = 3.56 → 3 (50 mm too small), 1064 / 208.7 = 5.1 → 65 mm', () => {
		expect(getConduitSize(100, 4)).toBe(65);
	});

	it('175 and 400 mm² take the next larger THHN area listed (200, 500 mm²)', () => {
		expect(getConduitSize(175, 4)).toBe(getConduitSize(200, 4));
		expect(getConduitSize(400, 4)).toBe(getConduitSize(500, 4));
	});

	it('returns -1 when even 150 mm is too small, and flags unknown sizes', () => {
		// 6605 / 870.9 = 7.58 → 7 conductors of 500 mm² at most
		expect(getConduitSize(500, 7)).toBe(150);
		expect(getConduitSize(500, 8)).toBe(-1);
		expect(getConduitSize(300, 4)).toBe('Invalid conductor size');
	});
});
