import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { databaseInstance } from '@/db';
import { generic_phase_panel_schema } from '@/schema/panel';

export const load = async ({ url: { searchParams } }) => {
	console.log('INIT DB');

	const database = await databaseInstance();

	console.log(database);

	const query = database.projects.find();
	const existingProject = await query.exec();

	if (!existingProject.length) {
		// Create items
		await database.items.insert({
			id: 'item1',
			node_type: 'panel',
			panel_data: {
				name: 'Main Panel',
				circuit_number: 1,
				ambient_temperature: '25C',
				phase: 'Single'
			},
			load_data: undefined,
			parent_id: 'project1', // Root item
			child_ids: ['item2', 'item3'] // Points to children
		});

		await database.items.insert({
			id: 'item2',
			node_type: 'load',
			panel_data: undefined,
			load_data: {
				load_description: 'Light Load',
				quantity: 10,
				varies: 0,
				continuous: 1,
				special: 'N/A'
			},
			parent_id: 'item1',
			child_ids: ['item4'] // Points to child
		});

		await database.items.insert({
			id: 'item3',
			node_type: 'panel',
			panel_data: {
				name: 'Sub Panel',
				circuit_number: 2,
				ambient_temperature: '30C',
				phase: 'Three'
			},
			load_data: undefined,
			parent_id: 'item1',
			child_ids: []
		});

		await database.items.insert({
			id: 'item4',
			node_type: 'load',
			panel_data: undefined,
			load_data: {
				load_description: 'Fan Load',
				quantity: 5,
				varies: 1,

				continuous: 1,
				special: 'High Efficiency'
			},
			parent_id: 'item2',
			child_ids: []
		});

		// Create a project
		const project = await database.projects.insert({
			id: 'project1',
			highest_unit_form: {
				distribution_unit: 'Transformer',
				wire_length: 60,
				ambient_temperature: '90',
				phase: '1PWye'
			},
			tree: []
		});

		await project.patch({
			tree: ['item1']
		});
	}

	const projs = database.projects.find();
	const project = (await projs.exec()).at(0);

	console.log('project', project);

	const items = database.items.find({
		selector: {
			parent_id: project?._data.id
		}
	});
	console.log('items', await items.exec());

	return {
		is_new_file: searchParams.get('new_file') === 'true',
		is_load_file: searchParams.get('load_file') === 'true',
		highest_unit_form: await superValidate(zod(highest_unit_schema)),
		generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
		panels: [],
		// project: 
	};
};
