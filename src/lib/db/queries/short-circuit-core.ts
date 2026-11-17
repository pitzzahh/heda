import { computeNodeLoad, type LoadComputationContext } from './compute.js';
import { buildChildrenByParent } from './loads-core.js';
import {
	MOTOR_LOAD_TYPES,
	UNMARKED_BREAKER_INTERRUPTING_RATING_KA,
	WYE_LINE_VOLTAGE,
	WYE_PHASE_VOLTAGE,
	default_phases
} from '#lib/constants.js';
import {
	conductorImpedanceOhm,
	isThreePhaseCircuit,
	motorImpedancePu,
	ohmsToPu,
	sourceImpedancePu,
	symmetricalFaultCurrent,
	transformerImpedancePu
} from '#lib/utils/computations/index.js';
import type { Node } from '#lib/types/db.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
import type {
	InterruptingRatingStatus,
	ShortCircuit,
	ShortCircuitSource
} from '#lib/types/short-circuit.js';

/** Pure, DB-free short-circuit computation; callers own caching. */
export function computeShortCircuitsFromNodes(nodes: Node[], is_dynamic: boolean): ShortCircuit[] {
	return computeShortCircuits(
		nodes.find((node) => node.node_type === 'root'),
		new Map(nodes.map((node) => [node.id, node])),
		{ children_by_parent: buildChildrenByParent(nodes), is_dynamic, memo: new Map() }
	);
}

/**
 * Available fault current at every node, per unit on the transformer kVA
 * (PEC 2017 App. D Ex. D14). At each bus the Thevenin impedance combines the
 * path back to the source with every motor below it in parallel, as D14 step
 * 10.2 does. A node's breaker sits on its supply bus, so its interrupting
 * rating is checked against that bus (PEC 2017 1.10.1.9: the current available
 * at the line terminals). Rows come in preorder, like the voltage-drop table.
 */
export function computeShortCircuits(
	root: Node | undefined,
	node_by_id: Map<string, Node>,
	context: LoadComputationContext
): ShortCircuit[] {
	if (!root) return [];
	const { children_by_parent } = context;
	const source = readSource(root);
	const is_single_phase = isSinglePhase(root.highest_unit_form?.phase);
	// A 3P-Y system is per unit at 400 V (PEC 2017 App. D Ex. D14 step 9.4, 2.20.1.5(A)).
	// Buses and three-phase circuits take the bolted three-phase fault. A 230 V
	// single-phase circuit can only fault line to neutral: its run counts out on the
	// phase and back on the neutral, as in D13, and the rest of the path is the
	// three-phase impedance per phase (heda takes the transformer's zero-sequence
	// impedance equal to its positive one, as for the usual delta-wye unit).
	const system_voltage =
		root.highest_unit_form?.phase === default_phases.THREE_PHASE_WYE ? WYE_LINE_VOLTAGE : 230;
	const base_kva = source?.transformer_kva ?? 0;

	const order = preorder(root, children_by_parent);
	const computed_by_id = new Map<string, PhaseLoadSchedule>();
	const conductor_ohm_by_id = new Map<string, number>();
	const conductor_pu_by_id = new Map<string, number>();
	const motor_pu_by_id = new Map<string, number>();

	for (const node of order) {
		const computed = computeNodeLoad(node, context);
		computed_by_id.set(node.id, computed);
		// Unlisted sizes count as zero impedance: that overstates fault current, the safe side.
		const ohms =
			conductorImpedanceOhm({
				size: computed.overrided_conductor_size || computed.conductor_size,
				conduit_type: computed.conduit_type,
				length: computed.overrided_length || computed.length || 0,
				sets: computed.conductor_sets || 1,
				is_single_phase: is_single_phase || !isThreePhaseCircuit(computed)
			}) ?? 0;
		conductor_ohm_by_id.set(node.id, ohms);
		if (!source) continue;
		conductor_pu_by_id.set(node.id, ohmsToPu(ohms, system_voltage, base_kva));
		// A 230 V motor on a 3P-Y system feeds one phase at its own 230 V impedance. PEC only works
		// three-phase motors (D14), so this follows IEEE practice: low-voltage breakers are rated on
		// first-cycle current, where every motor counts at 4 × rated current (IEEE C37.13, the
		// 0.25 pu of D14 step 8). Dropping single-phase motors belongs to the later interrupting
		// duty of medium-voltage breakers (IEEE C37.010), not to this check. The kVA is scaled by
		// (400/230)² to put the motor's real ohms on the 400 V base, and every phase is charged
		// with it (exact if all sit on one phase, over otherwise: the safe side).
		const line_to_neutral_scale =
			!is_single_phase && !isThreePhaseCircuit(computed)
				? (WYE_LINE_VOLTAGE / WYE_PHASE_VOLTAGE) ** 2
				: 1;
		const motor_kva = MOTOR_LOAD_TYPES.includes(computed.load_data?.load_type ?? '')
			? (computed.va / 1000) * line_to_neutral_scale
			: 0;
		if (motor_kva > 0) motor_pu_by_id.set(node.id, motorImpedancePu(base_kva, motor_kva));
	}

	if (!source) {
		return order.map((node) => toRow(node, node_by_id, computed_by_id, conductor_ohm_by_id));
	}

	// Pass 1, leaves up: admittance of the motors below each bus, seen from that bus.
	const branch_admittance = (node: Node) => {
		const below = down_admittance.get(node.id) ?? 0;
		return below === 0 ? 0 : 1 / ((conductor_pu_by_id.get(node.id) ?? 0) + 1 / below);
	};
	const down_admittance = new Map<string, number>();
	for (let index = order.length - 1; index >= -1; index -= 1) {
		const node = index === -1 ? root : (order[index] as Node);
		const motor_pu = motor_pu_by_id.get(node.id);
		const children = children_by_parent.get(node.id) ?? [];
		down_admittance.set(
			node.id,
			(motor_pu ? 1 / motor_pu : 0) +
				children.reduce((total, child) => total + branch_admittance(child), 0)
		);
	}

	// Pass 2, root down: impedance back to the source, and the Thevenin impedance at each bus.
	const up_pu = new Map<string, number>([
		[
			root.id,
			sourceImpedancePu(base_kva, source.utility_sc_kva) +
				transformerImpedancePu(source.transformer_z_percent)
		]
	]);
	const bus_pu = (node: Node) =>
		1 / (1 / (up_pu.get(node.id) as number) + (down_admittance.get(node.id) ?? 0));

	const current = (z_pu: number) =>
		symmetricalFaultCurrent({ z_pu, base_kva, voltage: system_voltage, is_single_phase });

	return order.map((node) => {
		const parent = node_by_id.get(node.parent_id ?? '') ?? root;
		const supply_admittance =
			1 / (up_pu.get(parent.id) as number) +
			(down_admittance.get(parent.id) ?? 0) -
			branch_admittance(node);
		up_pu.set(node.id, (conductor_pu_by_id.get(node.id) ?? 0) + 1 / supply_admittance);
		const supply_z_pu = bus_pu(parent);
		return toRow(node, node_by_id, computed_by_id, conductor_ohm_by_id, {
			conductor_z_pu: conductor_pu_by_id.get(node.id) ?? 0,
			motor_z_pu: motor_pu_by_id.get(node.id) ?? null,
			supply_z_pu,
			supply_fault_current: current(supply_z_pu),
			node_fault_current: current(bus_pu(node))
		});
	});
}

/** PEC 2017 1.10.1.9 against the breaker's rating; unmarked breakers are 5 kA (2.40.7.4(C)). */
export function interruptingRatingStatus(
	fault_current: number | null,
	rating_ka: number
): InterruptingRatingStatus {
	if (fault_current === null) return 'no_source';
	return fault_current > rating_ka * 1000 ? 'under_rated' : 'ok';
}

function toRow(
	node: Node,
	node_by_id: Map<string, Node>,
	computed_by_id: Map<string, PhaseLoadSchedule>,
	conductor_ohm_by_id: Map<string, number>,
	result?: Pick<
		ShortCircuit,
		'conductor_z_pu' | 'motor_z_pu' | 'supply_z_pu' | 'supply_fault_current' | 'node_fault_current'
	>
): ShortCircuit {
	const computed = computed_by_id.get(node.id) as PhaseLoadSchedule;
	const parent = node_by_id.get(node.parent_id ?? '');
	const interrupting_rating_ka = Number(node.kaic) || UNMARKED_BREAKER_INTERRUPTING_RATING_KA;
	const supply_fault_current = result?.supply_fault_current ?? null;
	return {
		...computed,
		from_node_name: parent?.highest_unit_form?.distribution_unit || parent?.panel_data?.name || '',
		to_node_name: computed.panel_data?.name || computed.load_data?.load_description || '',
		length: computed.overrided_length || computed.length || 0,
		conductor_z_ohm: conductor_ohm_by_id.get(node.id) ?? 0,
		conductor_z_pu: result?.conductor_z_pu ?? 0,
		motor_z_pu: result?.motor_z_pu ?? null,
		supply_z_pu: result?.supply_z_pu ?? null,
		supply_fault_current,
		node_fault_current: result?.node_fault_current ?? null,
		interrupting_rating_ka,
		status: interruptingRatingStatus(supply_fault_current, interrupting_rating_ka)
	};
}

function readSource(root: Node): ShortCircuitSource | null {
	const { utility_sc_kva, transformer_kva, transformer_z_percent } = root.highest_unit_form ?? {};
	if (!utility_sc_kva || !transformer_kva || !transformer_z_percent) return null;
	return { utility_sc_kva, transformer_kva, transformer_z_percent };
}

function isSinglePhase(phase: string | undefined): boolean {
	return !phase || phase === default_phases.ONE_PHASE;
}

function preorder(root: Node, children_by_parent: Map<string, Node[]>): Node[] {
	const order: Node[] = [];
	const stack = [...(children_by_parent.get(root.id) ?? [])].reverse();
	while (stack.length > 0) {
		const node = stack.pop() as Node;
		order.push(node);
		const children = children_by_parent.get(node.id) ?? [];
		for (let index = children.length - 1; index >= 0; index -= 1) {
			stack.push(children[index] as Node);
		}
	}
	return order;
}
