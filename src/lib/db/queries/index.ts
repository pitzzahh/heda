import { computeAmpereTrip, computeVoltAmpere } from '@/utils/computations';
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

	return {
		...data,
		load_description: data.load_data?.load_description || '',
		voltage,
		va,
		at,
		current: parseFloat(current.toFixed(2))
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
			const at = computeAmpereTrip(current, data.load_data?.load_type as LoadType);

			if (data.panel_data) {
				// Recursive fetch for panel's computed loads
				const panelLoads = await getComputedLoads(data.id);

				const totalLoads = panelLoads.reduce(
					(totals, load) => ({
						va: totals.va + (load.va || 0),
						current: totals.current + (load.current || 0)
					}),
					{ va: 0, current: 0 } // Default initial values
				);

				return {
					...data,
					load_description: data.panel_data.name || '',
					voltage,
					va: totalLoads.va,
					at: computeAmpereTrip(totalLoads.current),
					current: parseFloat(totalLoads.current.toFixed(2))
				};
			}

			return {
				...data,
				load_description: data.load_data?.load_description || '',
				voltage,
				va,
				at,
				current: parseFloat(current.toFixed(2))
			};
		})
	);

	// sorted loads by circuit_number
	return loadsWithComputedFields as LoadSchedule[];
}
