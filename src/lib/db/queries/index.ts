import {
	computeAdjustedCurrent,
	computeAmpereTrip,
	computeConductorSize,
	computeVoltAmpere,
	getConduitSize,
	getEgcSize
} from '#lib/utils/computations/index.js';
import { getDatabase } from '../index.js';
import type { LoadType } from '#lib/types/load/index.js';
import type { Node, Project } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';
import { ALTERNATING_CURRENT_REACTANCE } from '#lib/constants/index.js';
import type { ComputeCommonProperties, NodeByIdResult } from '#lib/types/db/index.js';

type LoadSnapshot = {
	nodes: Node[];
	node_by_id: Map<string, Node>;
	children_by_parent: Map<string, Node[]>;
	is_dynamic: boolean;
};

type LoadComputationContext = {
	children_by_parent: Map<string, Node[]>;
	is_dynamic: boolean;
	memo: Map<string, PhaseLoadSchedule>;
};

const computed_load_reuse = new Map<string, { is_dynamic: boolean; value: PhaseLoadSchedule }>();
const computed_load_array_reuse = new Map<
	string,
	{ is_dynamic: boolean; value: PhaseLoadSchedule[] }
>();
const voltage_drop_reuse = new Map<string, { is_dynamic: boolean; value: VoltageDrop }>();
let voltage_drop_array_reuse: { is_dynamic: boolean; value: VoltageDrop[] } | null = null;

function isSameValue(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		for (let index = 0; index < a.length; index += 1) {
			if (!isSameValue(a[index], b[index])) return false;
		}
		return true;
	}

	const a_keys = Object.keys(a);
	const b_keys = Object.keys(b);
	if (a_keys.length !== b_keys.length) return false;
	for (const key of a_keys) {
		if (!isSameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
			return false;
	}
	return true;
}

function reuseIfEqual<T extends object>(previous: T | undefined, next: T): T {
	if (!previous) return next;
	if (Object.keys(previous).length !== Object.keys(next).length) return next;
	for (const key of Object.keys(next)) {
		if (!isSameValue(previous[key as keyof T], next[key as keyof T])) return next;
	}
	return previous;
}

function reuseArrayIfEqual<T>(previous: T[] | undefined, next: T[]): T[] {
	if (!previous || previous.length !== next.length) return next;
	for (let index = 0; index < next.length; index += 1) {
		if (!Object.is(previous[index], next[index])) return next;
	}
	return previous;
}

function buildChildrenByParent(nodes: Node[], sort_by_circuit = true): Map<string, Node[]> {
	const children_by_parent = new Map<string, Node[]>();

	for (const node of nodes) {
		if (!node.parent_id) continue;
		const children = children_by_parent.get(node.parent_id);
		if (children) children.push(node);
		else children_by_parent.set(node.parent_id, [node]);
	}

	if (sort_by_circuit) {
		for (const children of children_by_parent.values()) {
			children.sort((a, b) => (a.circuit_number ?? 0) - (b.circuit_number ?? 0));
		}
	}

	return children_by_parent;
}

function loadSnapshot(sort_by_circuit = true): LoadSnapshot {
	const database = getDatabase();
	const project = database.projects.findOne({});
	const nodes = database.nodes.find({}).fetch() as Node[];
	const node_by_id = new Map(nodes.map((node) => [node.id, node]));

	return {
		nodes,
		node_by_id,
		children_by_parent: buildChildrenByParent(nodes, sort_by_circuit),
		is_dynamic: project?.settings.is_adjustment_factor_dynamic ?? false
	};
}

function computeNodeLoad(node: Node, context: LoadComputationContext): PhaseLoadSchedule {
	const memoized = context.memo.get(node.id);
	if (memoized) return memoized;

	const voltage = 230;
	const conductor_set = node.conductor_sets as number;
	const conductor_qty = node.conductor_qty as number;
	const load_data = node.load_data;
	const panel_data = node.panel_data;
	const ambient_temp = load_data?.ambient_temperature || 30;

	const va =
		computeVoltAmpere({
			load_type: load_data?.load_type as LoadType,
			quantity: load_data?.quantity ?? 0,
			varies: Number(load_data?.varies) || 0
		}) || 0;
	const current = va / voltage;
	const at = node.overrided_at || computeAmpereTrip(current, load_data?.load_type as LoadType);
	const conductor_size =
		node.overrided_conductor_size ||
		computeConductorSize({
			set: conductor_set,
			qty: conductor_qty,
			current,
			load_type: load_data?.load_type as LoadType | 'Main',
			at,
			ambient_temp,
			is_adjustment_factor_dynamic: context.is_dynamic
		});
	const adjusted_current = computeAdjustedCurrent({
		set: conductor_set,
		qty: conductor_qty,
		current,
		load_type: load_data?.load_type as LoadType | 'Main',
		at,
		ambient_temp,
		is_adjustment_factor_dynamic: context.is_dynamic
	});
	const conduit_size =
		node.overrided_conduit_size ||
		getConduitSize(conductor_size, conductor_set * conductor_qty + 1);

	let computed: PhaseLoadSchedule;

	if (panel_data) {
		const panel_loads = (context.children_by_parent.get(node.id) ?? []).map((child) =>
			computeNodeLoad(child, context)
		);
		const total_va = panel_loads.reduce((total, load) => total + (load.va || 0), 0);
		const total_current = panel_loads.reduce((total, load) => total + (load.current || 0), 0);
		const main_at = node.overrided_at || computeAmpereTrip(total_current);
		const main_current = parseFloat(total_current.toFixed(2));
		const main_conductor_size =
			node.overrided_conductor_size ||
			computeConductorSize({
				set: conductor_set,
				qty: conductor_qty,
				current: main_current,
				load_type: 'Main',
				at: main_at,
				ambient_temp: panel_data.ambient_temperature,
				is_adjustment_factor_dynamic: context.is_dynamic
			});
		const main_adjusted_current = computeAdjustedCurrent({
			set: conductor_set,
			qty: conductor_qty,
			current: main_current,
			load_type: 'Main',
			at: main_at,
			ambient_temp: panel_data.ambient_temperature,
			is_adjustment_factor_dynamic: context.is_dynamic
		});
		const main_conduit_size =
			node.overrided_conduit_size ||
			getConduitSize(main_conductor_size, conductor_set * conductor_qty + 1);

		computed = {
			...node,
			load_description: panel_data.name || '',
			voltage,
			va: total_va,
			at: main_at,
			current: main_current,
			conductor_size: main_conductor_size,
			egc_size: node.overrided_egc_size || getEgcSize(at),
			adjusted_current: main_adjusted_current,
			conduit_size: main_conduit_size,
			ampere_frames: node.overrided_ampere_frames || main_at
		} as PhaseLoadSchedule;
	} else {
		computed = {
			...node,
			load_description: load_data?.load_description || '',
			voltage,
			va,
			at,
			current: parseFloat(current.toFixed(2)),
			conductor_size,
			egc_size: node.overrided_egc_size || getEgcSize(at),
			adjusted_current,
			conduit_size,
			ampere_frames: node.overrided_ampere_frames || at
		} as PhaseLoadSchedule;
	}

	const previous = computed_load_reuse.get(node.id);
	const value =
		previous && previous.is_dynamic === context.is_dynamic
			? reuseIfEqual(previous.value, computed)
			: computed;
	computed_load_reuse.set(node.id, { is_dynamic: context.is_dynamic, value });
	context.memo.set(node.id, value);
	return value;
}

export function clearQueryCache(): void {
	computed_load_reuse.clear();
	computed_load_array_reuse.clear();
	voltage_drop_reuse.clear();
	voltage_drop_array_reuse = null;
}

export function getCurrentProject(project_id?: string): Project | undefined {
	return getDatabase().projects.findOne(project_id ? { id: project_id } : {}) as
		Project | undefined;
}

export function getAllProjects(fields?: (keyof Project)[]): Project[] {
	const projects = getDatabase().projects.find().fetch() as Project[];

	if (!fields?.length) return projects;

	return projects.map((project) => {
		const filtered_data = {} as Project;
		fields.forEach((field) => {
			if (project[field] !== undefined) {
				(filtered_data as Record<typeof field, unknown>)[field] = project[field];
			}
		});
		return filtered_data;
	});
}

export function getRootNode(): Node | undefined {
	return getDatabase().nodes.findOne({ node_type: 'root' }) as Node | undefined;
}

export function getNode(node_id: string): Node | undefined {
	return getDatabase().nodes.findOne({ id: node_id }) as Node | undefined;
}

export function checkNodeExists({
	circuit_number,
	parent_id,
	node_id
}: {
	circuit_number: number;
	parent_id: string;
	node_id?: string;
}) {
	const node = getDatabase().nodes.findOne({ parent_id, circuit_number });

	if (node_id && node) return node_id !== node.id;

	return !!node;
}

export function getNodeById(target_id: string): NodeByIdResult | null {
	const snapshot = loadSnapshot(false);
	const is_adjustment_factor_dynamic = snapshot.is_dynamic;
	const node_by_id = snapshot.node_by_id;
	const children_by_parent = snapshot.children_by_parent;
	const memo = new Map<string, NodeByIdResult | null>();

	const computeCommonProperties = ({
		current,
		conductor_set,
		conductor_qty,
		load_type,
		ambient_temp,
		overrided_at,
		overrided_conductor_size,
		overrided_egc_size,
		overrided_conduit_size
	}: ComputeCommonProperties) => {
		const at = overrided_at || computeAmpereTrip(current);
		const conductor_size =
			overrided_conductor_size ||
			computeConductorSize({
				set: conductor_set,
				qty: conductor_qty,
				current,
				load_type,
				at,
				ambient_temp,
				is_adjustment_factor_dynamic: is_adjustment_factor_dynamic || false
			});
		const adjusted_current = computeAdjustedCurrent({
			set: conductor_set,
			qty: conductor_qty,
			current,
			load_type,
			at,
			ambient_temp,
			is_adjustment_factor_dynamic: is_adjustment_factor_dynamic || false
		});
		const conduit_size =
			overrided_conduit_size || getConduitSize(conductor_size, conductor_set * conductor_qty + 1);
		const egc_size = overrided_egc_size || getEgcSize(at);

		return {
			at,
			conductor_size,
			adjusted_current,
			conduit_size,
			egc_size
		};
	};

	const resolve = (node: Node): NodeByIdResult | null => {
		if (memo.has(node.id)) return memo.get(node.id) ?? null;

		const data = node_by_id.get(node.id);
		if (!data) {
			memo.set(node.id, null);
			return null;
		}

		const voltage = 230;

		if (data.node_type === 'panel') {
			const child_nodes = children_by_parent.get(data.id) ?? [];
			let total_va = 0;
			let total_current = 0;

			for (const child_node of child_nodes) {
				const child_data = resolve(child_node);
				if (child_data) {
					total_va += child_data.va || 0;
					total_current += child_data.current || 0;
				}
			}

			const common = computeCommonProperties({
				va: total_va,
				current: total_current,
				conductor_set: data.conductor_sets as number,
				conductor_qty: data.conductor_qty as number,
				load_type: 'Main',
				ambient_temp: data.panel_data?.ambient_temperature || 30,
				overrided_at: data.overrided_at,
				overrided_conductor_size: data.overrided_conductor_size,
				overrided_egc_size: data.overrided_egc_size,
				overrided_conduit_size: data.overrided_conduit_size
			});

			const result = {
				...data,
				load_description: data.panel_data?.name || '',
				voltage,
				va: total_va,
				ampere_frames: data.overrided_ampere_frames || common.at,
				current: parseFloat(total_current.toFixed(2)),
				...common
			};

			memo.set(data.id, result);
			return result;
		}

		const va =
			computeVoltAmpere({
				load_type: data.load_data?.load_type as LoadType,
				quantity: data.load_data?.quantity ?? 0,
				varies: Number(data.load_data?.varies) || 0
			}) || 0;
		const current = va / voltage;

		const common = computeCommonProperties({
			va,
			current,
			conductor_set: data.conductor_sets as number,
			conductor_qty: data.conductor_qty as number,
			load_type: data.load_data?.load_type as LoadType | 'Main',
			ambient_temp:
				data.load_data?.ambient_temperature || data.panel_data?.ambient_temperature || 30,
			overrided_at: data.overrided_at,
			overrided_conductor_size: data.overrided_conductor_size,
			overrided_egc_size: data.overrided_egc_size,
			overrided_conduit_size: data.overrided_conduit_size
		});

		const result = {
			...data,
			load_description: data.load_data?.load_description || '',
			voltage,
			va,
			ampere_frames: data.overrided_ampere_frames || common.at,
			current: parseFloat(current.toFixed(2)),
			...common
		};

		memo.set(data.id, result);
		return result;
	};

	const target = node_by_id.get(target_id);
	return target ? resolve(target) : null;
}

export function getChildNodesByParentId(parent_id: string): Node[] {
	return getDatabase()
		.nodes.find({ parent_id }, { sort: { circuit_number: 1 } })
		.fetch() as Node[];
}

export function getParentNodes(excluded_id?: string): { name: string; id: string }[] {
	return getDatabase()
		.nodes.find({
			node_type: { $in: ['panel', 'root'] },
			...(excluded_id && { id: { $ne: excluded_id } })
		})
		.fetch()
		.flatMap((doc) => {
			const data = doc as Node;
			if (data.panel_data) {
				return [{ name: data.panel_data.name || '', id: data.id }];
			}

			if (data.highest_unit_form) {
				return [{ name: data.highest_unit_form.distribution_unit || '', id: data.id }];
			}

			return [];
		});
}

export function getComputedLoads(parent_id: string): PhaseLoadSchedule[] {
	const snapshot = loadSnapshot();
	const context: LoadComputationContext = {
		children_by_parent: snapshot.children_by_parent,
		is_dynamic: snapshot.is_dynamic,
		memo: new Map()
	};

	const loads = (snapshot.children_by_parent.get(parent_id) ?? []).map((child) =>
		computeNodeLoad(child, context)
	);
	const previous = computed_load_array_reuse.get(parent_id);
	const value =
		previous && previous.is_dynamic === snapshot.is_dynamic
			? reuseArrayIfEqual(previous.value, loads)
			: loads;
	computed_load_array_reuse.set(parent_id, { is_dynamic: snapshot.is_dynamic, value });
	return value;
}

export function getNodeDepth(node_id: string): number {
	const snapshot = loadSnapshot();
	let depth = 1;
	let current = snapshot.node_by_id.get(node_id);

	while (current?.parent_id) {
		depth += 1;
		current = snapshot.node_by_id.get(current.parent_id);
	}

	return depth;
}

export function getNumberOfChildren(node_id: string): number {
	const snapshot = loadSnapshot();
	let count = 0;
	const stack = [node_id];

	while (stack.length > 0) {
		const parent_id = stack.pop() as string;
		for (const child of snapshot.children_by_parent.get(parent_id) ?? []) {
			count += 1;
			if (child.node_type === 'panel') stack.push(child.id);
		}
	}

	return count;
}

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

	const value =
		voltage_drop_array_reuse && voltage_drop_array_reuse.is_dynamic === snapshot.is_dynamic
			? reuseArrayIfEqual(voltage_drop_array_reuse.value, voltage_drops)
			: voltage_drops;
	voltage_drop_array_reuse = { is_dynamic: snapshot.is_dynamic, value };
	return value;
}

export function getAllChildNodes(root_node_id: string, include_parent?: boolean): Node[] {
	const snapshot = loadSnapshot();
	const all_nodes: Node[] = [];

	const collect = (parent_id: string) => {
		const children = snapshot.children_by_parent.get(parent_id) ?? [];
		all_nodes.push(...children);
		for (const child of children) collect(child.id);
	};

	collect(root_node_id);

	if (include_parent) {
		const parent_node = snapshot.node_by_id.get(root_node_id);
		if (parent_node) all_nodes.unshift(parent_node);
	}

	return all_nodes;
}
