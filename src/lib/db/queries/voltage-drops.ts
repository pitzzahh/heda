import { reuseIfEqual, reuseVoltageDropArray, voltage_drop_reuse } from './cache.js';
import { loadSnapshot } from './snapshot.js';
import { computeNodeLoad, type LoadComputationContext } from './compute.js';
import { ALTERNATING_CURRENT_REACTANCE } from '#lib/constants/index.js';
import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';

export function getComputedVoltageDrops(): VoltageDrop[] {
	const snapshot = loadSnapshot();
	const context: LoadComputationContext = {
		children_by_parent: snapshot.children_by_parent,
		is_dynamic: snapshot.is_dynamic,
		memo: new Map()
	};
	const root = snapshot.nodes.find((node) => node.node_type === 'root');
	const voltage_end_by_node = new Map<string, number>();
	const voltage_drops: VoltageDrop[] = [];

	const walk = (parent_id: string) => {
		for (const node of snapshot.children_by_parent.get(parent_id) ?? []) {
			const computed = computeNodeLoad(node, context);
			const parent_node = node.parent_id ? snapshot.node_by_id.get(node.parent_id) : undefined;
			const parent_voltage_at_end_circuit = node.parent_id
				? voltage_end_by_node.get(node.parent_id)
				: undefined;
			const conductor_size = computed.overrided_conductor_size || computed.conductor_size;
			const length = computed.overrided_length || (computed.length as number);
			const z = computed.overrided_z || ALTERNATING_CURRENT_REACTANCE[conductor_size];
			const actual_z = Number(((length * z) / 305).toFixed(4));
			const voltage_per_segment = Number(
				((computed.conductor_qty as number) * computed.current * actual_z).toFixed(4)
			);
			const voltage_at_end_circuit =
				parent_node?.node_type === 'root'
					? voltage_per_segment
					: parent_voltage_at_end_circuit
						? Number((parent_voltage_at_end_circuit + voltage_per_segment).toFixed(4))
						: 0;
			const voltage_at_receiving_end = 230 - voltage_at_end_circuit;
			const percent_voltage_drop = Number(((1 - voltage_at_receiving_end / 230) * 100).toFixed(4));
			const current = computed.is_at_used_as_currents_value ? computed.at : computed.current;

			voltage_end_by_node.set(node.id, voltage_at_end_circuit);
			const row = {
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
			const previous_row = voltage_drop_reuse.get(node.id);
			const value =
				previous_row && previous_row.is_dynamic === snapshot.is_dynamic
					? reuseIfEqual(previous_row.value, row)
					: row;
			voltage_drop_reuse.set(node.id, { is_dynamic: snapshot.is_dynamic, value });
			voltage_drops.push(value);

			walk(node.id);
		}
	};

	if (root) walk(root.id);

	return reuseVoltageDropArray(snapshot.is_dynamic, voltage_drops);
}
