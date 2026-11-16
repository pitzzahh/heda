import { computeNodeLoad, type LoadComputationContext } from './compute.js';
import { buildChildrenByParent } from './loads-core.js';
import { ALTERNATING_CURRENT_REACTANCE, SQRT_3, WYE_LINE_VOLTAGE } from '#lib/constants.js';
import type { Node } from '#lib/types/db.js';
import type { VoltageDrop } from '#lib/types/voltage-drop.js';

/**
 * Pure, DB-free voltage-drop computation. Safe to run in a worker or on the
 * main thread; callers own caching/snapshotting.
 */
export function computeVoltageDropsFromNodes(nodes: Node[], is_dynamic: boolean): VoltageDrop[] {
	return computeVoltageDrops(
		nodes.find((node) => node.node_type === 'root'),
		new Map(nodes.map((node) => [node.id, node])),
		{ children_by_parent: buildChildrenByParent(nodes), is_dynamic, memo: new Map() }
	);
}

/** Same walk over a prebuilt graph, so the live snapshot can share its load memo. */
export function computeVoltageDrops(
	root: Node | undefined,
	node_by_id: Map<string, Node>,
	context: LoadComputationContext
): VoltageDrop[] {
	return [...walkVoltageDrops(root, node_by_id, context)];
}

/**
 * Yields one row per node in preorder (each node, then its subtree), so a
 * caller can spread a large walk over several tasks instead of one long block.
 */
export function* walkVoltageDrops(
	root: Node | undefined,
	node_by_id: Map<string, Node>,
	context: LoadComputationContext
): Generator<VoltageDrop> {
	if (!root) return;
	const { children_by_parent } = context;
	// Drop at the end of each node's run, as a fraction of that run's nominal voltage,
	// so a 230 V branch can continue from a 400 V feeder.
	const end_fraction_by_node = new Map<string, number>();
	const stack = [...(children_by_parent.get(root.id) ?? [])].reverse();

	while (stack.length > 0) {
		const node = stack.pop() as Node;
		const computed = computeNodeLoad(node, context);
		const parent_node = node.parent_id ? node_by_id.get(node.parent_id) : undefined;
		const parent_end_fraction = node.parent_id
			? end_fraction_by_node.get(node.parent_id)
			: undefined;
		// PEC 2017 App. D Ex. D15: VD = k·I·Z, k = 1.732 for three-phase (line-to-line, 400 V)
		// and 2 for single-phase (230 V, here the circuit's conductor count).
		const is_three_phase = computed.phase === 'ABC';
		const nominal_voltage = is_three_phase ? WYE_LINE_VOLTAGE : 230;
		const k = is_three_phase ? SQRT_3 : (computed.conductor_qty as number);
		const conductor_size = computed.overrided_conductor_size || computed.conductor_size;
		const length = computed.overrided_length || (computed.length as number);
		const z = computed.overrided_z || ALTERNATING_CURRENT_REACTANCE[conductor_size];
		const actual_z = Number(((length * z) / 305).toFixed(4));
		const voltage_per_segment = Number((k * computed.current * actual_z).toFixed(4));
		// Parents come first in preorder; the root (and a feeder with no drop) adds nothing.
		const voltage_at_end_circuit = Number(
			((parent_end_fraction ?? 0) * nominal_voltage + voltage_per_segment).toFixed(4)
		);
		const voltage_at_receiving_end = nominal_voltage - voltage_at_end_circuit;
		const percent_voltage_drop = Number(
			((1 - voltage_at_receiving_end / nominal_voltage) * 100).toFixed(4)
		);
		const current = computed.is_at_used_as_currents_value ? computed.at : computed.current;

		end_fraction_by_node.set(node.id, voltage_at_end_circuit / nominal_voltage);
		yield {
			z,
			actual_z,
			voltage_per_segment,
			voltage_at_end_circuit,
			voltage_at_receiving_end,
			percent_voltage_drop,
			from_node_name:
				parent_node?.highest_unit_form?.distribution_unit || parent_node?.panel_data?.name || '',
			to_node_name: computed.panel_data?.name || computed.load_data?.load_description || '',
			...{ ...computed, current, length }
		};

		const children = children_by_parent.get(node.id) ?? [];
		for (let index = children.length - 1; index >= 0; index -= 1) {
			stack.push(children[index] as Node);
		}
	}
}
