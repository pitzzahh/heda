import { databaseInstance } from '..';

export async function getCurrentProject(project_id?: string) {
	const db = await databaseInstance();

	try {
		const query = db.projects.find({
			selector: project_id ? {
				id: project_id
			} : undefined
		});
		const project = (await query.exec()).at(0)?._data;

		if (project) {
			return project;
		}

		return null;
	} catch (error) {
		console.log(error);
		throw error;
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
		throw error;
	}
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
			return node._data;
		}

		return null;
	} catch (error) {
		console.log(error);
		throw error;
	}
}

export async function getChildNodesByParentId(parent_id: string) {
	const db = await databaseInstance();

	try {
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
	} catch (error) {
		console.log(error);
		throw error;
	}
}
