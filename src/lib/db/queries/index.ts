import {
	computeAdjustedCurrent,
	computeAmpereTrip,
	computeConductorSize,
	computeVoltAmpere,
	getConduitSize,
	getEgcSize
} from '@/utils/computations';
import { databaseInstance } from '..';
import type { LoadType } from '@/types/load';
import type { Node, Project } from '@/db/schema';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import type { VoltageDrop } from '@/types/voltage-drop';
import { ALTERNATING_CURRENT_REACTANCE } from '@/constants';
import type { ComputeCommonProperties, NodeByIdResult } from '@/types/db';

export async function getCurrentProject(project_id?: string): Promise<Project | undefined> {
	const db = await databaseInstance();
	const query = db.projects.find({
		selector: project_id
			? {
				id: project_id
			}
			: undefined
	});
	return (await query.exec()).at(0)?._data as Project | undefined;
}

export async function getAllProjects(fields?: (keyof Project)[]): Promise<Project[] | undefined> {
	const db = await databaseInstance();
	const projects = await db.projects.find().exec();
	console.log('Getting all projects');
	if (fields?.length) {
		return projects.map((project) => {
			const data = project._data as Project;
			const filteredData = {} as Project;
			fields.forEach((field) => {
				if (data[field] !== undefined) {
					(filteredData as any)[field] = data[field];
				}
			});
			return filteredData;
		});
	}

	return projects.map((project) => project._data as Project);
}
export async function getRootNode(): Promise<Node | undefined> {
	const db = await databaseInstance();
	const query = db.nodes.find({
		selector: {
			node_type: 'root'
		}
	});
	return (await query.exec()).at(0)?._data as Node | undefined;
}

export async function checkNodeExists({
	circuit_number,
	parent_id,
	node_id
}: {
	circuit_number: number;
	parent_id: string;
	node_id?: string;
}) {
	const db = await databaseInstance();
	try {
		const node = await db.nodes
			.findOne({
				selector: {
					parent_id,
					circuit_number
				}
			})
			.exec();

		// prevent conflict check for the same node when editing
		if (node_id && node) {
			return node_id === node._data.id ? false : true;
		}

		return node ? true : false;
	} catch (error) {
		console.log(error);
		return false;
	}
}


export async function getNodeById(target_id: string): Promise<NodeByIdResult | null> {
	const db = await databaseInstance();

	const project = await getCurrentProject();
	const is_adjustment_factor_dynamic = project?.settings.is_adjustment_factor_dynamic;

	const node = await db.nodes
		.findOne({
			selector: {
				id: target_id
			}
		})
		.exec();

	if (!node) return null;

	const data: Node = node._data;
	if (!data) return null;

	const voltage = 230;

	const computeCommonProperties = ({
		va,
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

	if (data.node_type === 'panel') {
		// panel-specific logic
		const child_nodes = await db.nodes
			.find({
				selector: {
					parent_id: data.id
				}
			})
			.exec();

		const total_values = { va: 0, current: 0 };

		for (const child_node of child_nodes) {
			const child_data = await getNodeById(child_node._data.id);
			if (child_data) {
				total_values.va += child_data.va || 0;
				total_values.current += child_data.current || 0;
			}
		}

		const common = computeCommonProperties({
			va: total_values.va,
			current: total_values.current,
			conductor_set: data.conductor_sets as number,
			conductor_qty: data.conductor_qty as number,
			load_type: 'Main',
			ambient_temp: data.panel_data?.ambient_temperature || 30,
			overrided_at: data.overrided_at,
			overrided_conductor_size: data.overrided_conductor_size,
			overrided_egc_size: data.overrided_egc_size,
			overrided_conduit_size: data.overrided_conduit_size
		});

		return {
			...data,
			load_description: data.panel_data?.name || '',
			voltage,
			va: total_values.va,
			ampere_frames: data.overrided_ampere_frames || common.at,
			current: parseFloat(total_values.current.toFixed(2)),
			...common
		};
	}

	// load-specific logic
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
		ambient_temp: data.load_data?.ambient_temperature || data.panel_data?.ambient_temperature || 30,
		overrided_at: data.overrided_at,
		overrided_conductor_size: data.overrided_conductor_size,
		overrided_egc_size: data.overrided_egc_size,
		overrided_conduit_size: data.overrided_conduit_size
	});

	return {
		...data,
		load_description: data.load_data?.load_description || '',
		voltage,
		va,
		ampere_frames: data.overrided_ampere_frames || common.at,
		current: parseFloat(current.toFixed(2)),
		...common
	};
}

export async function getChildNodesByParentId(parent_id: string): Promise<Node[]> {
	const db = await databaseInstance();
	const query = db.nodes.find({
		selector: {
			parent_id
		}
	});
	return (await query.sort({ circuit_number: 'asc' }).exec()).map((doc) => doc._data) as Node[];
}

export async function getParentNodes(excluded_id?: string) {
	const db = await databaseInstance();
	const query = db.nodes.find({
		selector: {
			node_type: { $in: ['panel', 'root'] },
			...(excluded_id && { id: { $ne: excluded_id } })
		}
	});

	const parent_nodes = (await query.exec())
		.map((doc) => {
			const data = doc._data;
			if (data.panel_data) {
				return { name: data.panel_data.name || '', id: data.id };
			}

			if (data.highest_unit_form) {
				return { name: data.highest_unit_form.distribution_unit || '', id: data.id };
			}
		})
		.filter(Boolean);

	return parent_nodes;
}

export async function getComputedLoads(parent_id: string): Promise<PhaseLoadSchedule[]> {
	const project = await getCurrentProject();
	const is_adjustment_factor_dynamic = project?.settings.is_adjustment_factor_dynamic;

	const db = await databaseInstance();
	const child_nodes = (
		await db.nodes.find({ selector: { parent_id } }).sort({ circuit_number: 'asc' }).exec()
	).map((doc) => doc._data);

	const loadsWithComputedFields = await Promise.all(
		child_nodes.map(async (doc) => {
			const data = doc;
			const voltage = 230; // this may change depending on phase
			const conductor_set = data.conductor_sets as number;
			const conductor_qty = data.conductor_qty as number;

			const va =
				computeVoltAmpere({
					load_type: data.load_data?.load_type as LoadType,
					quantity: data.load_data?.quantity ?? 0,
					varies: Number(data.load_data?.varies) || 0
				}) || 0;
			const current = va / voltage;
			const at =
				data?.overrided_at || computeAmpereTrip(current, data.load_data?.load_type as LoadType);
			const conductor_size =
				data.overrided_conductor_size ||
				computeConductorSize({
					set: conductor_set,
					qty: conductor_qty,
					current,
					load_type: data.load_data?.load_type as LoadType | 'Main',
					at,
					ambient_temp: data.load_data?.ambient_temperature || 30,
					is_adjustment_factor_dynamic: is_adjustment_factor_dynamic || false
				});
			const adjusted_current = computeAdjustedCurrent({
				set: conductor_set,
				qty: conductor_qty,
				current,
				load_type: data.load_data?.load_type as LoadType | 'Main',
				at,
				ambient_temp: data.load_data?.ambient_temperature || 30,
				is_adjustment_factor_dynamic: is_adjustment_factor_dynamic || false
			});
			const conduit_size =
				data.overrided_conduit_size ||
				getConduitSize(conductor_size, conductor_set * conductor_qty + 1);

			if (data.panel_data) {
				// Recursive fetch for panel's computed loads
				const panel_loads = await getComputedLoads(data.id);

				const total_loads = panel_loads.reduce(
					(totals, load) => ({
						va: totals.va + (load.va || 0),
						current: totals.current + (load.current || 0)
					}),
					{ va: 0, current: 0 } // Default initial values
				);
				const main_at = data.overrided_at || computeAmpereTrip(total_loads.current);
				const main_current = parseFloat(total_loads.current.toFixed(2));
				const conductor_size = computeConductorSize({
					set: conductor_set,
					qty: conductor_qty,
					current: main_current,
					load_type: 'Main',
					at: main_at,
					ambient_temp: data.panel_data.ambient_temperature,
					is_adjustment_factor_dynamic: is_adjustment_factor_dynamic || false
				});
				const adjusted_current = computeAdjustedCurrent({
					set: conductor_set as number,
					qty: conductor_qty as number,
					current: main_current,
					load_type: 'Main',
					at: main_at,
					ambient_temp: data.panel_data.ambient_temperature,
					is_adjustment_factor_dynamic: is_adjustment_factor_dynamic || false
				});
				const conduit_size =
					data.overrided_conduit_size ||
					getConduitSize(conductor_size, conductor_set * conductor_qty + 1);

				return {
					...data,
					load_description: data.panel_data.name || '',
					voltage,
					va: total_loads.va,
					at: main_at,
					current: parseFloat(total_loads.current.toFixed(2)),
					conductor_size,
					egc_size: data.overrided_egc_size || getEgcSize(at),
					adjusted_current,
					conduit_size,
					ampere_frames: data.overrided_ampere_frames || main_at
				};
			}

			return {
				...data,
				load_description: data.load_data?.load_description || '',
				voltage,
				va,
				at,
				current: parseFloat(current.toFixed(2)),
				conductor_size,
				egc_size: data.overrided_egc_size || getEgcSize(at),
				adjusted_current,
				conduit_size,
				ampere_frames: data.overrided_ampere_frames || at
			};
		})
	);

	// sorted loads by circuit_number
	return loadsWithComputedFields as PhaseLoadSchedule[];
}

// Utility function to calculate the actual depth of the node in the hierarchy
export async function getNodeDepth(nodeId: string): Promise<number> {
	let depth = 1;
	let currentNode = await getNodeById(nodeId);

	// Traverse up the node tree to calculate depth
	while (currentNode && currentNode.parent_id) {
		depth++;
		currentNode = await getNodeById(currentNode.parent_id);
	}

	return depth;
}

export async function getNumberOfChildren(nodeId: string): Promise<number> {
	const db = await databaseInstance();
	let count = 0;

	async function countChildren(parentId: string) {
		const childNodes = await db.nodes.find({ selector: { parent_id: parentId } }).exec();
		count += childNodes.length;

		for (const childNode of childNodes) {
			if (childNode._data.node_type === 'panel') {
				await countChildren(childNode._data.id);
			}
		}
	}

	await countChildren(nodeId);
	return count;
}

export async function getComputedVoltageDrops() {
	const db = await databaseInstance();
	let nodes = [] as PhaseLoadSchedule[];

	const root_node = await db.nodes
		.findOne({
			selector: {
				node_type: 'root'
			}
		})
		.exec();

	if (root_node) {
		async function fetchChildNodes(parentId: string) {
			const child_nodes = await getComputedLoads(parentId);
			nodes = [...nodes, ...child_nodes];

			for (const child_node of child_nodes) {
				await fetchChildNodes(child_node.id);
			}
		}

		await fetchChildNodes(root_node._data.id);
	}

	const nodes_with_additional_fields: VoltageDrop[] = [];

	for (const node of nodes) {
		const parent_node = await getNodeById(node.parent_id as string);

		const parent_voltage_at_end_circuit = nodes_with_additional_fields.find(
			(n) => n.id === node.parent_id
		)?.voltage_at_end_circuit;

		const conductor_size = node.overrided_conductor_size || node.conductor_size;
		const length = node.overrided_length || (node.length as number);
		const z = node.overrided_z || ALTERNATING_CURRENT_REACTANCE[conductor_size];
		const actual_z = Number(((length * z) / 305).toFixed(4));
		const voltage_per_segment = Number((node.conductor_qty as number * node.current * actual_z).toFixed(4));
		const voltage_at_end_circuit =
			parent_node?.node_type === 'root'
				? voltage_per_segment
				: parent_voltage_at_end_circuit
					? Number((parent_voltage_at_end_circuit + voltage_per_segment).toFixed(4))
					: 0;
		const voltage_at_receiving_end = 230 - voltage_at_end_circuit;
		const percent_voltage_drop = Number(((1 - voltage_at_receiving_end / 230) * 100).toFixed(4));
		const current = node.is_at_used_as_currents_value ? node.at : node.current;

		nodes_with_additional_fields.push({
			z,
			actual_z,
			voltage_per_segment,
			voltage_at_end_circuit,
			voltage_at_receiving_end,
			percent_voltage_drop,
			from_node_name:
				parent_node?.highest_unit_form?.distribution_unit || parent_node?.panel_data?.name || '',
			to_node_name: node.panel_data?.name || node.load_data?.load_description || '',
			...{ ...node, current, length }
		});
	}

	return nodes_with_additional_fields;
}

