import { databaseInstance } from '..';

export async function getCurrentProject() {
	const db = await databaseInstance();
	const query = db.projects.find();
	const project = (await query.exec()).at(0)?._data;

	if (project) {
		return project;
	}

	return null;
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
		if (!a?.load_data?.circuit_number) return 1;
		if (!b?.load_data?.circuit_number) return -1;

		return a?.load_data?.circuit_number - b?.load_data?.circuit_number;
	});

	if (sortedChildren) {
		return sortedChildren;
	}

	return null;
}
