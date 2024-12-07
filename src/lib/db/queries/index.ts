import { databaseInstance } from '..';

export async function getCurrentProject(project_id?: string) {
	const db = await databaseInstance();

	try {
		const query = db.projects.find();
		const project = (await query.exec()).at(0)?._data;

		if (project) {
			return project;
		}

		return null;
	} catch (error) {
		console.log(error);
		return error;
	}
}

export async function getNodeById(id: string) {
	const db = await databaseInstance();

	try {
		const node = await db.nodes
			.findOne({
				selector: {
					id
				}
			})
			.exec();

		if (node) {
			return node;
		}

		return null;
	} catch (error) {
		console.log(error);
		return error;
	}
}

export async function getChildNodesByParentId(parent_id: string) {
	const db = await databaseInstance();
	const query = db.nodes.find({
		selector: {
			parent_id
		}
	});
	const children = (await query.exec()).map((doc) => doc._data);

	// sorts the circuit number of every load node
	const sortedChildren = children.sort((a, b) => {
		// Extract circuit numbers for easier reference
		const aLoadCircuit = a?.load_data?.circuit_number ?? Infinity; // Default to Infinity if not available
		const bLoadCircuit = b?.load_data?.circuit_number ?? Infinity;

		const aPanelCircuit = a?.panel_data?.circuit_number ?? Infinity; // Default to Infinity if not available
		const bPanelCircuit = b?.panel_data?.circuit_number ?? Infinity;

		// Sort primarily by load_data, then by panel_data
		if (aLoadCircuit !== bLoadCircuit) {
			return aLoadCircuit - bLoadCircuit;
		}

		// If load_data circuit numbers are equal or unavailable, sort by panel_data
		return aPanelCircuit - bPanelCircuit;
	});

	if (sortedChildren) {
		return sortedChildren;
	}

	return null;
}
