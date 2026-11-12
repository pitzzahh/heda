import { node_by_id_reuse, node_results, reuseIfEqual } from './cache.js';
import { getChildren, loadSnapshot } from './snapshot.js';
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
import type {
	ComputeCommonProperties,
	Node,
	NodeByIdResult,
	Project
} from '#lib/types/db/index.js';

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
	return loadSnapshot().root;
}

export function getNode(node_id: string): Node | undefined {
	return loadSnapshot().node_by_id.get(node_id);
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
	const node = getChildren(loadSnapshot(), parent_id).find(
		(child) => child.circuit_number === circuit_number
	);

	if (node_id && node) return node_id !== node.id;

	return !!node;
}

export function getNodeById(target_id: string): NodeByIdResult | null {
	const snapshot = loadSnapshot();
	const is_adjustment_factor_dynamic = snapshot.is_dynamic;
	const node_by_id = snapshot.node_by_id;
	const children_by_parent = snapshot.children_by_parent;
	// Survives across revisions; the snapshot evicts changed branches.
	const memo = node_results;

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
		const memoized = memo.get(node.id);
		if (memoized) return memoized;

		const data = node_by_id.get(node.id);
		if (!data) return null;

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
	if (!target) return null;
	const computed = resolve(target);
	if (!computed) return null;
	const value = reuseIfEqual(node_by_id_reuse.get(target_id), computed);
	node_by_id_reuse.set(target_id, value);
	return value;
}
