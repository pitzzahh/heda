import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { databaseInstance } from '@/db';
import { generic_phase_panel_schema } from '@/schema/panel';
import { getChildNodesByParentId, getCurrentProject } from '@/db/queries/index.js';

export const load = async ({ url: { searchParams } }) => {
	console.log('INIT DB');

	const database = await databaseInstance();

	console.log(database);

	// const query = database.projects.find();
	// const existingProject = await query.exec();

	// if (!existingProject.length) {
	// 	// Create nodes
	// 	await database.nodes.insert({
	// 		id: 'item1',
	// 		node_type: 'panel',
	// 		panel_data: {
	// 			name: 'Main Panel',
	// 			circuit_number: 1,
	// 			ambient_temperature: '25C',
	// 			phase: 'Single'
	// 		},
	// 		load_data: undefined,
	// 		parent_id: 'project1', // Root item
	// 		child_ids: ['item2', 'item3'] // Points to children
	// 	});

	// 	await database.nodes.insert({
	// 		id: 'item2',
	// 		node_type: 'load',
	// 		panel_data: undefined,
	// 		load_data: {
	// 			load_description: 'Light Load',
	// 			quantity: 10,
	// 			varies: 0,
	// 			continuous: 1,
	// 			special: 'N/A'
	// 		},
	// 		parent_id: 'item1',
	// 		child_ids: ['item4'] // Points to child
	// 	});

	// 	await database.nodes.insert({
	// 		id: 'item3',
	// 		node_type: 'panel',
	// 		panel_data: {
	// 			name: 'Sub Panel',
	// 			circuit_number: 2,
	// 			ambient_temperature: '30C',
	// 			phase: 'Three'
	// 		},
	// 		load_data: undefined,
	// 		parent_id: 'item1',
	// 		child_ids: []
	// 	});

	// 	await database.nodes.insert({
	// 		id: 'item12',
	// 		node_type: 'panel',
	// 		panel_data: {
	// 			name: 'Sub sub Panel',
	// 			circuit_number: 2,
	// 			ambient_temperature: '30C',
	// 			phase: 'Three'
	// 		},
	// 		load_data: undefined,
	// 		parent_id: 'item3',
	// 		child_ids: []
	// 	});

	// 	await database.nodes.insert({
	// 		id: 'item13',
	// 		node_type: 'load',
	// 		panel_data: undefined,
	// 		load_data: {
	// 			load_description: 'Light Loaded',
	// 			quantity: 10,
	// 			varies: 0,
	// 			continuous: 1,
	// 			special: 'N/A'
	// 		},
	// 		parent_id: 'item12',
	// 		child_ids: []
	// 	});

	// 	await database.nodes.insert({
	// 		id: 'item10',
	// 		node_type: 'load',
	// 		panel_data: undefined,
	// 		load_data: {
	// 			load_description: 'Light Loaded',
	// 			quantity: 10,
	// 			varies: 0,
	// 			continuous: 1,
	// 			special: 'N/A'
	// 		},
	// 		parent_id: 'item3',
	// 		child_ids: []
	// 	});

	// 	await database.nodes.insert({
	// 		id: 'item11',
	// 		node_type: 'load',
	// 		panel_data: undefined,
	// 		load_data: {
	// 			load_description: 'Light Loaded',
	// 			quantity: 10,
	// 			varies: 0,
	// 			continuous: 1,
	// 			special: 'N/A'
	// 		},
	// 		parent_id: 'item3',
	// 		child_ids: []
	// 	});

	// 	await database.nodes.insert({
	// 		id: 'item4',
	// 		node_type: 'load',
	// 		panel_data: undefined,
	// 		load_data: {
	// 			load_description: 'Fan Load',
	// 			quantity: 5,
	// 			varies: 1,
	// 			continuous: 1,
	// 			special: 'High Efficiency'
	// 		},
	// 		parent_id: 'item2',
	// 		child_ids: []
	// 	});

	// 	// Create a project
	// 	const project = await database.projects.insert({
	// 		id: 'project1',
	// 		highest_unit_form: {
	// 			distribution_unit: 'Transformer',
	// 			wire_length: 60,
	// 			ambient_temperature: '90',
	// 			phase: '1PWye'
	// 		},
	// 		tree: []
	// 	});

	// 	await project.patch({
	// 		tree: ['item1']
	// 	});
	// }

	const project = await getCurrentProject();
	const nodes = project ? await getChildNodesByParentId(project.id) : [];

	console.log('from layout nodes', nodes);

	return {
		is_new_file: searchParams.get('new_file') === 'true',
		is_load_file: searchParams.get('load_file') === 'true',
		highest_unit_form: await superValidate(zod(highest_unit_schema)),
		generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
		panels: [],
		project,
		nodes
	};
};
