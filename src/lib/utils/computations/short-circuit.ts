import { CONDUCTOR_RESISTANCE_REACTANCE, MOTOR_IMPEDANCE_PU } from '#lib/constants.js';

// Per-unit fault calculation per PEC 2017 Appendix D, Examples D13 and D14.
// Every impedance is on one kVA base (D14 step 4: the transformer kVA).

/** PEC 2017 App. D Ex. D14 step 5: pu Zs = kVA base / utility SC kVA. */
export function sourceImpedancePu(base_kva: number, utility_sc_kva: number): number {
	return base_kva / utility_sc_kva;
}

/** PEC 2017 App. D Ex. D14 step 6: pu Zt = impedance in percent / 100. */
export function transformerImpedancePu(z_percent: number): number {
	return z_percent / 100;
}

/**
 * Impedance of one conductor run in ohms, from PEC 2017 Table 10.1.1.9
 * (R and XL per 305 m, by conduit) as |R + jXL|. Parallel sets divide it. A
 * single-phase fault flows out on one conductor and back on the other, and the
 * table is ohms to neutral (one conductor), so single-phase runs count twice.
 * Returns null for a size the table does not list.
 */
export function conductorImpedanceOhm({
	size,
	conduit_type,
	length,
	sets,
	is_single_phase
}: {
	size: number;
	conduit_type: string | undefined;
	length: number;
	sets: number;
	is_single_phase: boolean;
}): number | null {
	const row = CONDUCTOR_RESISTANCE_REACTANCE[size];
	if (!row) return null;
	const conduit = conduit_type?.toLowerCase() ?? '';
	const is_steel = conduit.includes('steel');
	const r = is_steel ? row.r_steel : conduit.includes('alum') ? row.r_aluminum : row.r_pvc;
	const x = is_steel ? row.xl_steel : row.xl;
	const per_305_m = Math.hypot(r, x);
	return ((per_305_m * length) / 305 / Math.max(sets, 1)) * (is_single_phase ? 2 : 1);
}

/** PEC 2017 App. D Ex. D14 step 7b: pu Zw = (ohm / kV²) × (kVA base / 1000). */
export function ohmsToPu(ohms: number, voltage: number, base_kva: number): number {
	const kv = voltage / 1000;
	return (ohms / (kv * kv)) * (base_kva / 1000);
}

/** PEC 2017 App. D Ex. D14 step 8: pu Zm = kVA base / (motor kVA / motor impedance). */
export function motorImpedancePu(base_kva: number, motor_kva: number): number {
	return base_kva / (motor_kva / MOTOR_IMPEDANCE_PU);
}

/** Impedances in parallel (D14 step 10.2b): 1/Zc = Σ 1/Zi. Infinite paths drop out. */
export function parallelImpedance(...impedances: number[]): number {
	const admittance = impedances.reduce((total, z) => total + 1 / z, 0);
	return admittance === 0 ? Infinity : 1 / admittance;
}

/**
 * Symmetrical fault current in amperes for a per-unit impedance up to the fault
 * (pu voltage 1.0).
 * - Three-phase, PEC 2017 App. D Ex. D14 step 9.4: (1 / pu Zc) × base kVA × 1000 / (1.732 × V).
 * - Single-phase, PEC 2017 App. D Ex. D13: I_sec / Z, with I_sec = VA / V.
 */
export function symmetricalFaultCurrent({
	z_pu,
	base_kva,
	voltage,
	is_single_phase
}: {
	z_pu: number;
	base_kva: number;
	voltage: number;
	is_single_phase: boolean;
}): number {
	const base_current = (base_kva * 1000) / (is_single_phase ? voltage : 1.732 * voltage);
	return base_current / z_pu;
}
