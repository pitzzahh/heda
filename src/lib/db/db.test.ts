import { describe, expect, it } from 'vitest';
import { StrongholdTimeoutError, databaseInstance, withTimeout } from './index';
import { addNode, createProject, loadCurrentProject, resetData } from './mutations/index';
import { checkNodeExists, getChildNodesByParentId, getNodeById } from './queries/index';

describe('db (signaldb)', () => {
	it('creates a project with a root node', async () => {
		await resetData();
		const created = await createProject('Test Project', {
			distribution_unit: 'Transformer',
			phase: '1P'
		});
		expect(created?.project.project_name).toBe('Test Project');
		expect(created?.root_node_id).toBeTruthy();
		const db = await databaseInstance();
		expect(db.projects.find().fetch()).toHaveLength(1);
		expect(db.nodes.find().fetch()).toHaveLength(1);
	});

	it('applies insert defaults to nodes', async () => {
		await resetData();
		const created = await createProject('Defaults', {
			distribution_unit: 'Transformer',
			phase: '1P'
		});
		const node = await addNode({
			parent_id: created!.root_node_id,
			panel_data: {
				name: 'LP-1',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: 'Standard Temperature',
				phase: '1P'
			}
		});
		expect(node?.conductor_sets).toBe(1);
		expect(node?.conductor_qty).toBe(2);
		expect(node?.conductor_insulation).toBe('THHN-Cu');
		expect(node?.egc_insulation).toBe('TW-Cu');
		expect(node?.conduit_type).toBe('PVC');
		expect(node?.pole).toBe('2');
		expect(node?.kaic).toBe('5');
		expect(node?.is_at_used_as_currents_value).toBe(false);
	});

	it('checks circuit existence excluding the node being edited', async () => {
		await resetData();
		const created = await createProject('Exists', {
			distribution_unit: 'Transformer',
			phase: '1P'
		});
		const root = created!.root_node_id;
		const first = await addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-1',
				circuit_number: 3,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: 'Standard Temperature',
				phase: '1P'
			}
		});
		expect(await checkNodeExists({ circuit_number: 3, parent_id: root })).toBe(true);
		expect(await checkNodeExists({ circuit_number: 3, parent_id: root, node_id: first!.id })).toBe(
			false
		);
		expect(await checkNodeExists({ circuit_number: 4, parent_id: root })).toBe(false);
	});

	it('loads a project export and sorts children by circuit number', async () => {
		await resetData();
		const project = await loadCurrentProject({
			project: {
				id: 'p1',
				project_name: 'Imported',
				settings: { is_adjustment_factor_dynamic: false },
				root_node_id: 'root'
			},
			nodes: [
				{ id: 'root', node_type: 'root', child_ids: ['b', 'a'] },
				{
					id: 'b',
					node_type: 'panel',
					circuit_number: 2,
					parent_id: 'root',
					child_ids: [],
					length: 5,
					panel_data: {
						name: 'LP-B',
						ambient_temperature: 30,
						terminal_temperature: 'Standard Temperature',
						phase: '1P'
					}
				},
				{
					id: 'a',
					node_type: 'panel',
					circuit_number: 1,
					parent_id: 'root',
					child_ids: [],
					length: 5,
					panel_data: {
						name: 'LP-A',
						ambient_temperature: 30,
						terminal_temperature: 'Standard Temperature',
						phase: '1P'
					}
				}
			]
		});
		expect(project.project_name).toBe('Imported');
		const children = await getChildNodesByParentId('root');
		expect(children.map((c) => c.circuit_number)).toEqual([1, 2]);
		const fetched = await getNodeById('a');
		expect(fetched?.panel_data?.name).toBe('LP-A');
	});

	it('passes fast promises through the Stronghold timeout', async () => {
		await expect(withTimeout(Promise.resolve('key'), 50)).resolves.toBe('key');
	});

	it('rejects hung promises with StrongholdTimeoutError', async () => {
		const hung = new Promise<string>(() => {});
		const err = await withTimeout(hung, 20).catch((e) => e);
		expect(err).toBeInstanceOf(StrongholdTimeoutError);
	});
});
