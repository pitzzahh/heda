import {
	computeAmpereTrip,
	computeConductorSize,
	computeVoltAmpere,
	getEgcSize
} from '@/utils/computations';
import { databaseInstance } from '..';
import type { LoadType } from '@/types/load';
import type { Node, Project } from '@/db/schema';

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

export async function getNodeById(target_id: string) {
	const db = await databaseInstance();
	const node = await db.nodes
		.findOne({
			selector: {
				id: target_id
			}
		})
		.exec();

	if (!node) return;

	// for panel
	if (node._data && node._data.node_type === 'panel') {
		const child_nodes = await db.nodes
			.find({
				selector: {
					parent_id: node._data.id
				}
			})
			.exec();

		const total_values = { va: 0, current: 0 };

		for (const child_node of child_nodes) {
			const node = await getNodeById(child_node._data.id);
			if (node) {
				total_values.va += node.va || 0;
				total_values.current += node.current || 0;
			}
		}

		const data = node._data;
		const voltage = 230;
		const va = total_values.va;
		const current = total_values.current;
		const at = data.overrided_at || computeAmpereTrip(current);
		const conductor_size = computeConductorSize({
			set: data.conductor_sets as number,
			qty: data.conductor_qty as number,
			current,
			load_type: 'Main',
			at,
			ambient_temp: data.panel_data?.ambient_temperature || 30
		});

		return {
			...data,
			load_description: data.panel_data?.name || '',
			voltage,
			va,
			at,
			current: parseFloat(current.toFixed(2)),
			conductor_size,
			egc_size: getEgcSize(at)
		};
	}

	// for load
	const data = node?._data;
	const voltage = 230; // this may change depending on phase
	const va =
		computeVoltAmpere({
			load_type: data.load_data?.load_type as LoadType,
			quantity: data.load_data?.quantity ?? 0,
			varies: Number(data.load_data?.varies) || 0
		}) || 0;
	const current = va / voltage;
	const at = computeAmpereTrip(current, data.load_data?.load_type as LoadType);
	const conductor_size = computeConductorSize({
		set: data.conductor_sets as number,
		qty: data.conductor_qty as number,
		current,
		load_type: data.load_data?.load_type as LoadType | 'Main',
		at: data?.overrided_at || at,
		ambient_temp: data.load_data?.ambient_temperature || data.panel_data?.ambient_temperature || 30
	});

	return {
		...data,
		load_description: data.load_data?.load_description || '',
		voltage,
		va,
		at,
		current: parseFloat(current.toFixed(2)),
		conductor_size,
		egc_size: getEgcSize(at)
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

type LoadSchedule = Node & {
	va: number;
	current: number;
	voltage: number;
	load_description: string;
	at: number;
};

export async function getComputedLoads(parent_id: string): Promise<LoadSchedule[]> {
	const db = await databaseInstance();
	const childNodes = await db.nodes
		.find({ selector: { parent_id } })
		.sort({ circuit_number: 'asc' })
		.exec();

	const loadsWithComputedFields = await Promise.all(
		childNodes.map(async (doc) => {
			const data = doc._data;
			const voltage = 230; // this may change depending on phase

			const va =
				computeVoltAmpere({
					load_type: data.load_data?.load_type as LoadType,
					quantity: data.load_data?.quantity ?? 0,
					varies: Number(data.load_data?.varies) || 0
				}) || 0;
			const current = va / voltage;
			const at =
				data?.overrided_at || computeAmpereTrip(current, data.load_data?.load_type as LoadType);
			const conductor_size = computeConductorSize({
				set: data.conductor_sets as number,
				qty: data.conductor_qty as number,
				current,
				load_type: data.load_data?.load_type as LoadType | 'Main',
				at,
				ambient_temp: data.load_data?.ambient_temperature || 30
			});

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
					set: data.conductor_sets as number,
					qty: data.conductor_qty as number,
					current: main_current,
					load_type: 'Main',
					at: main_at,
					ambient_temp: data.panel_data.ambient_temperature
				});

				return {
					...data,
					load_description: data.panel_data.name || '',
					voltage,
					va: total_loads.va,
					at: main_at,
					current: parseFloat(total_loads.current.toFixed(2)),
					conductor_size,
					egc_size: getEgcSize(main_at)
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
				egc_size: getEgcSize(at)
			};
		})
	);

	// sorted loads by circuit_number
	return loadsWithComputedFields as LoadSchedule[];
}
