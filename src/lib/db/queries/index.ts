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

export async function getRootNode() {
	const db = await databaseInstance();

	try {
		const query = db.nodes.find({
			selector: {
				node_type: 'root'
			}
		});
		const node = (await query.exec()).at(0)?._data;

		if (node) {
			return node;
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
		return (a.circuit_number || 0) - (b.circuit_number || 0);
	});

	if (sortedChildren) {
		return sortedChildren;
	}

	return null;
}
