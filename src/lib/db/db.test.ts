import { beforeAll, describe, expect, it } from 'vitest';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants/index.js';
import { StrongholdTimeoutError, getDatabase, initializeDatabase, withTimeout } from './index.js';
import { addNode, createProject, loadCurrentProject, resetData } from './mutations/index.js';
import {
	checkNodeExists,
	getChildNodesByParentId,
	getComputedLoads,
	getComputedVoltageDrops,
	getNodeById
} from './queries/index.js';

beforeAll(async () => {
	await initializeDatabase();
});

describe('db (signaldb)', () => {
	it('creates a project with a root node', async () => {
		resetData();
		const created = await createProject('Test Project', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		expect(created?.project.project_name).toBe('Test Project');
		expect(created?.root_node_id).toBeTruthy();
		const db = getDatabase();
		expect(db.projects.find().fetch()).toHaveLength(1);
		expect(db.nodes.find().fetch()).toHaveLength(1);
	});

	it('applies insert defaults to nodes', async () => {
		resetData();
		const created = await createProject('Defaults', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const node = addNode({
			parent_id: created!.root_node_id,
			panel_data: {
				name: 'LP-1',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
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
		resetData();
		const created = await createProject('Exists', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const first = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-1',
				circuit_number: 3,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		expect(checkNodeExists({ circuit_number: 3, parent_id: root })).toBe(true);
		expect(checkNodeExists({ circuit_number: 3, parent_id: root, node_id: first!.id })).toBe(false);
		expect(checkNodeExists({ circuit_number: 4, parent_id: root })).toBe(false);
	});

	it('loads a project export and sorts children by circuit number', async () => {
		resetData();
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
						terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
						phase: default_phases.ONE_PHASE
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
						terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
						phase: default_phases.ONE_PHASE
					}
				}
			]
		});
		expect(project.project_name).toBe('Imported');
		const children = getChildNodesByParentId('root');
		expect(children.map((c) => c.circuit_number)).toEqual([1, 2]);
		const fetched = getNodeById('a');
		expect(fetched?.panel_data?.name).toBe('LP-A');
		expect(fetched?.panel_data?.phase).toBe(default_phases.ONE_PHASE);
	});

	it('keeps computed rows stable until their inputs change', async () => {
		resetData();
		const created = await createProject('Stable', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		addNode({
			parent_id: root,
			load_data: {
				load_type: default_load_types.GENERAL_LIGHTING,
				quantity: 10,
				varies: '0',
				load_description: '10 - Lighting',
				continuous: false,
				circuit_number: 1,
				length: 10,
				ambient_temperature: 30,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				config_preference: 'CUSTOM'
			}
		});

		const first_loads = getComputedLoads(root);
		const second_loads = getComputedLoads(root);
		expect(second_loads).toBe(first_loads);
		expect(second_loads[0]).toBe(first_loads[0]);

		const voltage_drops = getComputedVoltageDrops();
		expect(getComputedVoltageDrops()).toBe(voltage_drops);
		expect(voltage_drops).toHaveLength(1);
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
