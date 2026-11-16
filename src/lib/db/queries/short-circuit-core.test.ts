import { describe, expect, it } from 'vitest';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants.js';
import {
	conductorImpedanceOhm,
	motorImpedancePu,
	ohmsToPu,
	parallelImpedance,
	sourceImpedancePu,
	symmetricalFaultCurrent,
	transformerImpedancePu
} from '#lib/utils/computations/index.js';
import { withNodeDefaults } from '../mutations/defaults.js';
import { computeShortCircuitsFromNodes, interruptingRatingStatus } from './short-circuit-core.js';
import type { Node } from '#lib/types/db.js';
import type { ShortCircuitSource } from '#lib/types/short-circuit.js';

// 100 kVA, 2.5% (PEC 2017 App. D Ex. D13) on the Metro Manila grid level (D14 step 3).
const SOURCE: ShortCircuitSource = {
	utility_sc_kva: 1_000_000,
	transformer_kva: 100,
	transformer_z_percent: 2.5
};
const BASE = { base_kva: 100, voltage: 230, is_single_phase: true };
const Z_SOURCE = sourceImpedancePu(100, 1_000_000) + transformerImpedancePu(2.5); // 0.0001 + 0.025

function root(source?: ShortCircuitSource): Node {
	return withNodeDefaults({
		id: 'root',
		node_type: 'root',
		child_ids: [],
		highest_unit_form: {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE,
			...source
		}
	});
}

function panel(id: string, parent_id: string, circuit: number, extra: Partial<Node> = {}): Node {
	return withNodeDefaults({
		id,
		node_type: 'panel',
		parent_id,
		child_ids: [],
		circuit_number: circuit,
		overrided_conductor_size: 14,
		overrided_length: 20,
		panel_data: {
			name: id,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			ambient_temperature: 30,
			phase: default_phases.ONE_PHASE
		},
		...extra
	});
}

function load(
	id: string,
	parent_id: string,
	circuit: number,
	load_type: string,
	varies: string,
	extra: Partial<Node> = {}
): Node {
	return withNodeDefaults({
		id,
		node_type: 'load',
		parent_id,
		child_ids: [],
		circuit_number: circuit,
		overrided_conductor_size: 3.5,
		overrided_length: 15,
		load_data: {
			load_description: id,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			ambient_temperature: 30,
			quantity: 1,
			varies,
			continuous: false,
			load_type,
			config_preference: 'DEFAULT'
		},
		...extra
	});
}

/** Single-phase run impedance on the 100 kVA base, as the walk computes it. */
function runPu(size: number, length: number, sets = 1, conduit_type = 'PVC'): number {
	const ohms = conductorImpedanceOhm({ size, conduit_type, length, sets, is_single_phase: true })!;
	return ohmsToPu(ohms, 230, 100);
}

const amps = (z_pu: number) => symmetricalFaultCurrent({ z_pu, ...BASE });

function byName(nodes: Node[]) {
	return new Map(computeShortCircuitsFromNodes(nodes, false).map((row) => [row.to_node_name, row]));
}

describe('computeShortCircuits', () => {
	it('flags every row when the source data is missing, but still sizes the runs', () => {
		const rows = byName([root(), panel('LP-1', 'root', 1)]);
		const row = rows.get('LP-1')!;
		expect(row.status).toBe('no_source');
		expect(row.supply_fault_current).toBeNull();
		expect(row.node_fault_current).toBeNull();
		expect(row.conductor_z_ohm).toBeCloseTo((2 * Math.hypot(0.49, 0.051) * 20) / 305, 12);
	});

	it('gives D13 at the transformer bus and adds the feeder for the panel end', () => {
		const rows = byName([root(SOURCE), panel('LP-1', 'root', 1)]);
		const row = rows.get('LP-1')!;
		// Breaker on the transformer bus: Zs + Zt = 0.0251 pu → 434.78 / 0.0251 ≈ 17,322 A.
		expect(row.supply_z_pu).toBeCloseTo(Z_SOURCE, 12);
		expect(row.supply_fault_current).toBeCloseTo(amps(0.0251), 6);
		expect(Math.round(row.supply_fault_current!)).toBe(17_322);
		// Panel bus: series 14 mm² × 20 m, both conductors.
		expect(row.conductor_z_pu).toBeCloseTo(runPu(14, 20), 12);
		expect(row.node_fault_current).toBeCloseTo(amps(Z_SOURCE + runPu(14, 20)), 6);
		expect(row.motor_z_pu).toBeNull();
		expect(row.interrupting_rating_ka).toBe(5); // PEC 2.40.7.4(C) default
		expect(row.status).toBe('under_rated');
	});

	it('adds motor contribution in parallel at every bus above the motor (D14 step 10.2)', () => {
		// root ─ LP-1 (14 mm², 20 m) ─┬─ M (3.5 mm², 15 m, 10 A × 230 V = 2.3 kVA)
		//                             └─ L (3.5 mm², 15 m, lighting)
		const rows = byName([
			root(SOURCE),
			panel('LP-1', 'root', 1, { kaic: '25' }),
			load('M', 'LP-1', 1, default_load_types.ONE_P_MOTOR__RATED_CURRENT, '10'),
			load('L', 'LP-1', 2, default_load_types.LIGHTING_LOAD, '100')
		]);
		const z_feeder = runPu(14, 20);
		const z_branch = runPu(3.5, 15);
		const z_motor = motorImpedancePu(100, 2.3); // 100 / (2.3 / 0.25) = 10.87 pu
		expect(rows.get('M')!.motor_z_pu).toBeCloseTo(z_motor, 12);

		// Transformer bus: source ∥ (feeder + branch + motor).
		const z_root_bus = parallelImpedance(Z_SOURCE, z_feeder + z_branch + z_motor);
		expect(rows.get('LP-1')!.supply_z_pu).toBeCloseTo(z_root_bus, 12);
		expect(rows.get('LP-1')!.supply_fault_current).toBeGreaterThan(amps(Z_SOURCE));
		expect(rows.get('LP-1')!.status).toBe('ok');

		// LP-1 bus: (source + feeder) ∥ (branch + motor). Both branch breakers see it.
		const z_panel_bus = parallelImpedance(Z_SOURCE + z_feeder, z_branch + z_motor);
		expect(rows.get('LP-1')!.node_fault_current).toBeCloseTo(amps(z_panel_bus), 6);
		expect(rows.get('L')!.supply_fault_current).toBeCloseTo(amps(z_panel_bus), 6);
		expect(rows.get('M')!.supply_fault_current).toBeCloseTo(amps(z_panel_bus), 6);

		// Lighting end: everything above in series with its own branch.
		expect(rows.get('L')!.node_fault_current).toBeCloseTo(amps(z_panel_bus + z_branch), 6);
		// Motor end: the motor itself in parallel with the rest of the network.
		expect(rows.get('M')!.node_fault_current).toBeCloseTo(
			amps(parallelImpedance(Z_SOURCE + z_feeder + z_branch, z_motor)),
			6
		);
	});

	it('includes motors on other branches at a sibling panel bus', () => {
		const rows = byName([
			root(SOURCE),
			panel('LP-1', 'root', 1),
			load('M', 'LP-1', 1, default_load_types.ONE_P_MOTOR__RATED_CURRENT, '10'),
			panel('LP-2', 'root', 2)
		]);
		const z_motor_path = runPu(14, 20) + runPu(3.5, 15) + motorImpedancePu(100, 2.3);
		const z_root_bus = parallelImpedance(Z_SOURCE, z_motor_path);
		expect(rows.get('LP-2')!.supply_z_pu).toBeCloseTo(z_root_bus, 12);
		expect(rows.get('LP-2')!.node_fault_current).toBeCloseTo(amps(z_root_bus + runPu(14, 20)), 6);
	});

	it('halves the run for two parallel sets and reads steel conduit columns', () => {
		const rows = byName([
			root(SOURCE),
			panel('LP-1', 'root', 1, { conductor_sets: 2, conduit_type: 'Steel' })
		]);
		expect(rows.get('LP-1')!.conductor_z_pu).toBeCloseTo(runPu(14, 20, 2, 'Steel'), 12);
		expect(rows.get('LP-1')!.conductor_z_pu).toBeCloseTo(runPu(14, 20, 1, 'Steel') / 2, 12);
	});

	it('treats an unlisted size and zero length as no impedance (the safe side)', () => {
		const rows = byName([
			root(SOURCE),
			panel('LP-1', 'root', 1, { overrided_conductor_size: 4 }),
			panel('LP-2', 'root', 2, { overrided_length: undefined, length: 0 })
		]);
		for (const name of ['LP-1', 'LP-2']) {
			expect(rows.get(name)!.conductor_z_pu).toBe(0);
			expect(rows.get(name)!.node_fault_current).toBeCloseTo(amps(Z_SOURCE), 6);
		}
	});

	it('studies a 400Y/230 V system as a three-phase fault at 400 V (D14 step 9.4)', () => {
		const three_phase_root = root(SOURCE);
		three_phase_root.highest_unit_form!.phase = default_phases.THREE_PHASE_WYE;
		const rows = byName([
			three_phase_root,
			panel('LP-1', 'root', 1, {
				panel_data: {
					name: 'LP-1',
					terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
					ambient_temperature: 30,
					phase: default_phases.THREE_PHASE_WYE
				}
			})
		]);
		// One conductor per phase (no ×2 loop), on a 400 V base.
		const z_run = ohmsToPu(
			conductorImpedanceOhm({
				size: 14,
				conduit_type: 'PVC',
				length: 20,
				sets: 1,
				is_single_phase: false
			})!,
			400,
			100
		);
		expect(rows.get('LP-1')!.conductor_z_pu).toBeCloseTo(z_run, 12);
		// 100 kVA at 400 V: 100000 / (1.732 × 400) = 144.34 A base; ÷ 0.0251 pu ≈ 5,751 A.
		const expected = symmetricalFaultCurrent({
			z_pu: Z_SOURCE,
			base_kva: 100,
			voltage: 400,
			is_single_phase: false
		});
		expect(rows.get('LP-1')!.supply_fault_current).toBeCloseTo(expected, 6);
		expect(Math.round(expected)).toBe(5_751);
	});

	it('faults a 230 V branch of a 400Y/230 V system line to neutral (D13 loop on D14 per unit)', () => {
		const three_phase_root = root(SOURCE);
		three_phase_root.highest_unit_form!.phase = default_phases.THREE_PHASE_WYE;
		const rows = byName([
			three_phase_root,
			load('L1', 'root', 1, default_load_types.LIGHTING_LOAD, '100', {
				overrided_conductor_size: 14,
				overrided_length: 20
			})
		]);
		// Phase out and neutral back: twice the 14 mm² run, on the 400 V base.
		const loop = ohmsToPu(
			conductorImpedanceOhm({
				size: 14,
				conduit_type: 'PVC',
				length: 20,
				sets: 1,
				is_single_phase: true
			})!,
			400,
			100
		);
		const row = rows.get('L1')!;
		expect(row.conductor_z_pu).toBeCloseTo(loop, 12);
		// At the bus a line-to-neutral fault equals the three-phase one (Z0 = Z1).
		expect(row.supply_fault_current).toBeCloseTo(
			symmetricalFaultCurrent({
				z_pu: Z_SOURCE,
				base_kva: 100,
				voltage: 400,
				is_single_phase: false
			}),
			6
		);
		// At the load: 230 V ÷ (per-phase path + loop) in ohms is the same as base ÷ pu.
		const z_ohm = ((Z_SOURCE + loop) * 400 * 400) / 100_000;
		expect(row.node_fault_current).toBeCloseTo(230.94 / z_ohm, 0);
	});

	it('counts three-phase motors toward the fault (D14 step 8)', () => {
		const three_phase_root = root(SOURCE);
		three_phase_root.highest_unit_form!.phase = default_phases.THREE_PHASE_WYE;
		const rows = byName([
			three_phase_root,
			load('M3', 'root', 1, default_load_types.THREE_P_MOTOR__RATED_CURRENT, '44')
		]);
		// 44 A × 400 V × 1.732 = 30.48 kVA → Zm = 100 / (30.48 / 0.25) pu.
		expect(rows.get('M3')!.motor_z_pu).toBeCloseTo(motorImpedancePu(100, 30.4832), 10);
		expect(rows.get('M3')!.supply_fault_current).toBeGreaterThan(
			symmetricalFaultCurrent({
				z_pu: Z_SOURCE,
				base_kva: 100,
				voltage: 400,
				is_single_phase: false
			})
		);
	});

	it('takes the plain motor rating × quantity as motor kVA, with no 125% sizing (D14 step 8)', () => {
		const three_phase_root = root(SOURCE);
		three_phase_root.highest_unit_form!.phase = default_phases.THREE_PHASE_WYE;
		// Two 25 HP motors; the horsepower picker stores the Table 4.30.14.4 400 V FLC, 44 A.
		const motors = load('M3', 'root', 1, default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER, '44');
		motors.load_data!.quantity = 2;
		const row = byName([three_phase_root, motors]).get('M3')!;
		// VA = 2 × 1.732 × 400 V × 44 A = 60,966.4 VA = 60.9664 kVA.
		expect(row.va).toBeCloseTo(60_966.4, 6);
		// Zm = 100 kVA / (60.9664 kVA / 0.25) = 100 / 243.8656 = 0.41006 pu.
		expect(row.motor_z_pu).toBeCloseTo(0.4100619357547764, 12);
	});

	it('puts a 230 V motor on a 3P-Y system at its real line-to-neutral ohms (safe side)', () => {
		const three_phase_root = root(SOURCE);
		three_phase_root.highest_unit_form!.phase = default_phases.THREE_PHASE_WYE;
		const rows = byName([
			three_phase_root,
			load('M1', 'root', 1, default_load_types.ONE_P_MOTOR__RATED_CURRENT, '10')
		]);
		const row = rows.get('M1')!;
		// Motor: 230 V × 10 A = 2.3 kVA → 0.25 × 230² / 2300 = 5.75 Ω line to neutral.
		// On the 400 V, 100 kVA base (Zbase = 0.4² / 0.1 = 1.6 Ω): 5.75 / 1.6 = 3.59375 pu,
		// i.e. D14 step 8 on 2.3 × (400/230)² = 6.9565 kVA.
		expect(row.motor_z_pu).toBeCloseTo(3.59375, 12);
		// Branch loop: 2 × |2.0 + j0.054| × 15 / 305 = 0.19679 Ω → / 1.6 = 0.122996 pu.
		expect(row.conductor_z_pu).toBeCloseTo(0.12299562708123907, 12);
		// Transformer bus: 0.0251 ∥ (0.122996 + 3.59375) = 0.0249316 pu → 144.34 A / 0.0249316 ≈ 5,790 A,
		// against 5,751 A from the source alone.
		expect(row.supply_z_pu).toBeCloseTo(0.02493163121550489, 12);
		expect(Math.round(row.supply_fault_current!)).toBe(5_790);
	});

	it('returns rows in preorder, like the voltage-drop table', () => {
		const rows = computeShortCircuitsFromNodes(
			[
				root(SOURCE),
				panel('LP-1', 'root', 1),
				load('A', 'LP-1', 1, default_load_types.LIGHTING_LOAD, '100'),
				panel('LP-2', 'root', 2)
			],
			false
		);
		expect(rows.map((row) => row.to_node_name)).toEqual(['LP-1', 'A', 'LP-2']);
		expect(rows.map((row) => row.from_node_name)).toEqual(['Transformer', 'LP-1', 'Transformer']);
	});

	it('returns nothing without a root', () => {
		expect(computeShortCircuitsFromNodes([], false)).toEqual([]);
	});
});

describe('interruptingRatingStatus (PEC 2017 1.10.1.9)', () => {
	it('passes a rating exactly equal to the available current', () => {
		expect(interruptingRatingStatus(5000, 5)).toBe('ok');
		expect(interruptingRatingStatus(5000.01, 5)).toBe('under_rated');
		expect(interruptingRatingStatus(null, 5)).toBe('no_source');
	});
});
