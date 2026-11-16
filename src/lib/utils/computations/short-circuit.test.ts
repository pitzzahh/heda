import { describe, expect, it } from 'vitest';
import {
	conductorImpedanceOhm,
	motorImpedancePu,
	ohmsToPu,
	parallelImpedance,
	sourceImpedancePu,
	symmetricalFaultCurrent,
	transformerImpedancePu
} from './short-circuit.js';

describe('PEC 2017 App. D Ex. D13: available short-circuit current', () => {
	// Single-phase transformer, 100 kVA, 230 V, 2.5% impedance, infinite primary,
	// all other impedances neglected.
	it('gives 17,391 A at the secondary', () => {
		// I_sec = 100000 / 230 = 434.78 A
		const i_sec = 100_000 / 230;
		expect(i_sec).toBeCloseTo(434.78, 2);
		// I_sc(sym) = I_sec / Z = 434.78 / 0.025 = 17391 A
		const z_pu = transformerImpedancePu(2.5);
		expect(z_pu).toBe(0.025);
		const i_sc = symmetricalFaultCurrent({
			z_pu,
			base_kva: 100,
			voltage: 230,
			is_single_phase: true
		});
		expect(Math.round(i_sc)).toBe(17_391);
	});
});

describe('PEC 2017 App. D Ex. D14: simplified fault current calculation', () => {
	// 230 V, 3-phase, bank of 100 kVA transformers (300 kVA) at 5%, on a 34.5 kV
	// Meralco line with 1000 MVA short-circuit capacity. 3 × 250 mm² THW in steel
	// conduit, 30.4 m. Two 100 kVA motors.
	const base_kva = 300; // step 4
	const three_phase = { base_kva, voltage: 230, is_single_phase: false };

	it('step 5: pu Zs = 300 / 1000000 = 0.0003', () => {
		expect(sourceImpedancePu(base_kva, 1_000_000)).toBeCloseTo(0.0003, 10);
	});

	it('step 6: pu Zt = 5 / 100 = 0.05', () => {
		expect(transformerImpedancePu(5)).toBe(0.05);
	});

	it('step 7b: pu Zw = 0.00546 / (0.230 × 0.230) × 300 / 1000 = 0.031', () => {
		expect(ohmsToPu(0.00546, 230, base_kva)).toBeCloseTo(0.031, 3);
	});

	it('step 8: pu Zm = 300 / (100 / 0.25) = 0.75', () => {
		expect(motorImpedancePu(base_kva, 100)).toBe(0.75);
	});

	it('10.1, fault at "a": Zc = 0.0503 pu → 14,972 A, breaker A ≥ 15,000 AIC', () => {
		const zc = sourceImpedancePu(base_kva, 1_000_000) + transformerImpedancePu(5);
		expect(zc).toBeCloseTo(0.0503, 10);
		const i_sc = symmetricalFaultCurrent({ z_pu: zc, ...three_phase });
		expect(Math.round(i_sc)).toBe(14_972);
		expect(i_sc).toBeLessThanOrEqual(15_000);
	});

	// The 10.2 diagram uses Zm = 0.375 per motor (step 8 prints 0.75); the book's
	// 18,687 A follows from 0.375, so the fixture uses the diagram's values.
	it('10.2, fault at "b": 1/Zc = 1/0.0503 + 2/0.406 → Zc = 0.0403 pu → 18,687 A', () => {
		const zc = parallelImpedance(0.0503, 0.031 + 0.375, 0.031 + 0.375);
		expect(1 / 0.0503).toBeCloseTo(19.88, 2);
		expect(1 / 0.406).toBeCloseTo(2.46, 2);
		expect(zc).toBeCloseTo(0.0403, 4);
		const i_sc = symmetricalFaultCurrent({ z_pu: 0.0403, ...three_phase });
		expect(Math.round(i_sc)).toBe(18_687);
		expect(i_sc).toBeLessThanOrEqual(19_000);
	});

	// The book prints "1100 amperes"; its own formula gives 10,562 A, which
	// matches its "say 11 000 A" and breaker C ≥ 11,000 AIC.
	it('10.3, fault at "c": Zt = 0.0403 + 0.031 = 0.0713 pu → 10,562 A', () => {
		const zt = 0.0403 + 0.031;
		expect(zt).toBeCloseTo(0.0713, 10);
		const i_sc = symmetricalFaultCurrent({ z_pu: zt, ...three_phase });
		expect(Math.round(i_sc)).toBe(10_562);
		expect(i_sc).toBeLessThanOrEqual(11_000);
	});
});

describe('conductorImpedanceOhm (PEC 2017 Table 10.1.1.9)', () => {
	it('uses |R + jXL| for 250 mm² in steel conduit', () => {
		// R 0.029, XL 0.048 Ω/305 m → 0.05608 Ω/305 m; × 30.4 m / 305 m
		const ohms = conductorImpedanceOhm({
			size: 250,
			conduit_type: 'Steel',
			length: 30.4,
			sets: 1,
			is_single_phase: false
		});
		expect(ohms).toBeCloseTo((Math.hypot(0.029, 0.048) * 30.4) / 305, 12);
		expect(ohms).toBeCloseTo(0.00559, 5);
	});

	it('uses the PVC columns by default and the aluminum conduit resistance', () => {
		const run = { size: 80, length: 305, sets: 1, is_single_phase: false };
		expect(conductorImpedanceOhm({ ...run, conduit_type: 'PVC' })).toBeCloseTo(
			Math.hypot(0.077, 0.042),
			12
		);
		expect(conductorImpedanceOhm({ ...run, conduit_type: undefined })).toBeCloseTo(
			Math.hypot(0.077, 0.042),
			12
		);
		expect(conductorImpedanceOhm({ ...run, conduit_type: 'Aluminum' })).toBeCloseTo(
			Math.hypot(0.082, 0.042),
			12
		);
	});

	it('counts both conductors of a single-phase run and divides by parallel sets', () => {
		const run = { size: 14, conduit_type: 'PVC', length: 50 };
		const one = conductorImpedanceOhm({ ...run, sets: 1, is_single_phase: false })!;
		expect(conductorImpedanceOhm({ ...run, sets: 1, is_single_phase: true })).toBeCloseTo(
			one * 2,
			12
		);
		expect(conductorImpedanceOhm({ ...run, sets: 2, is_single_phase: false })).toBeCloseTo(
			one / 2,
			12
		);
		expect(conductorImpedanceOhm({ ...run, sets: 0, is_single_phase: false })).toBe(one);
	});

	it('is zero for zero length and null for a size the table does not list', () => {
		const run = { conduit_type: 'PVC', sets: 1, is_single_phase: true };
		expect(conductorImpedanceOhm({ ...run, size: 2, length: 0 })).toBe(0);
		expect(conductorImpedanceOhm({ ...run, size: 4, length: 10 })).toBeNull();
	});
});

describe('parallelImpedance', () => {
	it('drops infinite paths and is infinite with none left', () => {
		expect(parallelImpedance(0.05, Infinity)).toBe(0.05);
		expect(parallelImpedance()).toBe(Infinity);
		expect(parallelImpedance(2, 2)).toBe(1);
	});
});
