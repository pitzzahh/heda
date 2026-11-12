import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants/index.js';
import { Collection } from '@signaldb/core';
import {
	StrongholdTimeoutError,
	clearCollection,
	coalesceSaves,
	getDatabase,
	initializeDatabase,
	insertIntoCollection,
	replaceInCollection,
	withTimeout
} from './index.js';
import {
	addNode,
	copyAndAddNodeById,
	copyAndAddNodesById,
	MAX_COPY_NODES,
	createProject,
	loadCurrentProject,
	overrideField,
	removeNode,
	removeNodesById,
	resetData,
	restoreNodes,
	updateLoadDescription,
	updateNode
} from './mutations/index.js';
import {
	checkNodeExists,
	getChildNodesByParentId,
	getComputedLoads,
	getComputedVoltageDrops,
	getComputedVoltageDropsAsync,
	getNode,
	getNodeDepth,
	getNodeById,
	getParentNodes,
	getSnapshotRevision
} from './queries/index.js';
import { computeNodeLoad } from './queries/compute.js';
import { computed_loads } from './queries/cache.js';
import { computeVoltageDropsFromNodes } from './queries/voltage-drop-core.js';
import { loadSnapshot } from './queries/snapshot.js';
import type { GenericPhaseMainLoadSchema } from '#lib/types/load/index.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel/index.js';

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

	it('lists parent nodes with indexed lookups', async () => {
		resetData();
		const created = await createProject('Parents', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-1',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		const parents = getParentNodes();
		expect(parents.map((p) => p.name).sort()).toEqual(['LP-1', 'Transformer'].sort());
		const excluded = getParentNodes(root);
		expect(excluded).toHaveLength(1);
		expect(excluded[0]?.name).toBe('LP-1');
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
		const load_data = {
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
		} as const;
		const node = addNode({
			parent_id: root,
			load_data
		});

		const first_loads = getComputedLoads(root);
		const second_loads = getComputedLoads(root);
		expect(second_loads).toBe(first_loads);
		expect(second_loads[0]).toBe(first_loads[0]);

		const voltage_drops = getComputedVoltageDrops();
		expect(getComputedVoltageDrops()).toBe(voltage_drops);
		expect(voltage_drops).toHaveLength(1);

		// The revision-keyed memo must not survive a write.
		updateNode({
			id: node!.id,
			parent_id: root,
			load_data: { ...load_data, length: 20 }
		});
		const updated_drops = getComputedVoltageDrops();
		expect(updated_drops).not.toBe(voltage_drops);
		expect(updated_drops[0]?.length).toBe(20);
	});

	it('keeps single-node reads stable across unrelated edits', async () => {
		resetData();
		const created = await createProject('NodeById', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel_data = (name: string, circuit_number: number): GenericPhasePanelSchema => ({
			name,
			circuit_number,
			ambient_temperature: 30,
			length: 10,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			phase: default_phases.ONE_PHASE
		});
		const panel_a = addNode({ parent_id: root, panel_data: panel_data('LP-A', 1) });
		const panel_b = addNode({ parent_id: root, panel_data: panel_data('LP-B', 2) });

		const first = getNodeById(panel_a!.id);
		expect(getNodeById(panel_a!.id)).toBe(first);

		updateNode({
			id: panel_b!.id,
			parent_id: root,
			panel_data: panel_data('LP-B2', 2)
		});
		expect(getNodeById(panel_a!.id)).toBe(first);

		updateNode({
			id: panel_a!.id,
			parent_id: root,
			panel_data: panel_data('LP-A2', 1)
		});
		const edited = getNodeById(panel_a!.id);
		expect(edited).not.toBe(first);
		expect(edited?.panel_data?.name).toBe('LP-A2');
	});

	it('does not alias panel data on whole-node updates', async () => {
		resetData();
		const created = await createProject('WholeData', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		const whole_data = getNode(panel!.id)!;
		updateNode({ id: panel!.id, parent_id: root, whole_data });
		const stored = getNode(panel!.id)!;
		expect(stored.panel_data).toEqual(whole_data.panel_data);
		expect(stored.panel_data).not.toBe(whole_data.panel_data);
	});

	it('returns fresh data when a node id is reused after removal', async () => {
		resetData();
		const created = await createProject('ReusedId', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		expect(getNodeById(panel!.id)?.panel_data?.name).toBe('LP-A');

		removeNode(panel!.id);
		addNode({
			existing_id: panel!.id,
			parent_id: root,
			panel_data: {
				name: 'LP-A-new',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		expect(getNodeById(panel!.id)?.panel_data?.name).toBe('LP-A-new');
	});

	it('documents where the two load-computation paths agree and differ', async () => {
		resetData();
		const created = await createProject('TwoPaths', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		const load_data = (
			circuit_number: number
		): GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' } => ({
			load_type: default_load_types.GENERAL_LIGHTING,
			quantity: 50,
			varies: '1000',
			load_description: `Load ${circuit_number}`,
			continuous: false,
			circuit_number,
			length: 10,
			ambient_temperature: 30,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			config_preference: 'CUSTOM' as const
		});
		addNode({ parent_id: panel!.id, load_data: load_data(1) });
		addNode({ parent_id: panel!.id, load_data: load_data(2) });

		const children = getChildNodesByParentId(panel!.id);
		const panel_context = {
			children_by_parent: new Map([[panel!.id, children]]),
			is_dynamic: false,
			memo: new Map()
		};
		const via_id = getNodeById(panel!.id)!;
		const via_compute = computeNodeLoad(getNode(panel!.id)!, panel_context);
		for (const field of [
			'va',
			'current',
			'at',
			'conductor_size',
			'adjusted_current',
			'conduit_size',
			'ampere_frames'
		] as const) {
			expect(via_id[field]).toBe(via_compute[field]);
		}
		// Known divergence, pending a domain decision: the header path sizes the
		// panel ground from the summed load while the table path sizes it from a
		// fixed 30A trip. Merging the paths changes either table or export numbers.
		expect(via_id.egc_size).not.toBe(via_compute.egc_size);

		const load_context = { children_by_parent: new Map(), is_dynamic: false, memo: new Map() };
		expect(getNodeById(children[0].id)).toEqual(computeNodeLoad(children[0], load_context));
	});

	it('shares one snapshot across reads until the next write', async () => {
		resetData();
		const created = await createProject('Snapshot', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;

		const sorted = loadSnapshot();
		expect(loadSnapshot()).toBe(sorted);

		addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		expect(loadSnapshot()).not.toBe(sorted);
	});

	it('returns the same child array until the next write', async () => {
		resetData();
		const created = await createProject('Children', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		const first = getChildNodesByParentId(root);
		expect(getChildNodesByParentId(root)).toBe(first);
		addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-B',
				circuit_number: 2,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		expect(getChildNodesByParentId(root)).toHaveLength(2);
		expect(getChildNodesByParentId(root)).not.toBe(first);
	});

	it('copies a panel subtree with new ids in one batch', async () => {
		resetData();
		const created = await createProject('Copy', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		const load_data = (circuit_number: number) =>
			({
				load_type: default_load_types.GENERAL_LIGHTING,
				quantity: 10,
				varies: '0',
				load_description: `Load ${circuit_number}`,
				continuous: false,
				circuit_number,
				length: 10,
				ambient_temperature: 30,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				config_preference: 'CUSTOM'
			}) as const;
		addNode({ parent_id: panel!.id, load_data: load_data(1) });
		addNode({ parent_id: panel!.id, load_data: load_data(2) });

		const copied = await copyAndAddNodeById(panel!.id);
		expect(copied?.id).not.toBe(panel!.id);
		expect(copied?.parent_id).toBe(root);
		expect(copied?.circuit_number).toBe(2);
		const copied_children = getChildNodesByParentId(copied!.id);
		const original_children = getChildNodesByParentId(panel!.id);
		expect(copied_children).toHaveLength(2);
		copied_children.forEach((child, index) => {
			expect(child.parent_id).toBe(copied!.id);
			expect(child.load_data).toEqual(original_children[index]?.load_data);
			expect(child.load_data).not.toBe(original_children[index]?.load_data);
		});
		expect(getNode(root)?.child_ids).toEqual([panel!.id, copied!.id]);
		expect(getChildNodesByParentId(panel!.id)).toHaveLength(2);
	});

	it('copies many panels with one insert and one parent update', async () => {
		resetData();
		const created = await createProject('Batch Copy', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		})!;
		for (let circuit_number = 1; circuit_number <= 30; circuit_number += 1) {
			addNode({
				parent_id: panel.id,
				load_data: {
					load_type: default_load_types.GENERAL_LIGHTING,
					quantity: 10,
					varies: '0',
					load_description: `Load ${circuit_number}`,
					continuous: false,
					circuit_number,
					length: 10,
					ambient_temperature: 30,
					terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
					config_preference: 'CUSTOM'
				} as never
			});
		}

		const database = getDatabase();
		const batch = vi.spyOn(database.nodes, 'batch');

		const copies = await copyAndAddNodesById(panel.id, 100);

		expect(copies).toHaveLength(100);
		// One index rebuild for the insert and one for the parent update,
		// instead of one per copied node.
		expect(batch).toHaveBeenCalledTimes(2);
		expect(database.nodes.find({}).count()).toBe(2 + 30 + 100 * 31);
		expect(getChildNodesByParentId(root)).toHaveLength(101);
		expect(new Set(copies.map((copy) => copy.circuit_number)).size).toBe(100);
		for (const copy of copies) {
			expect(copy.parent_id).toBe(root);
			expect(getChildNodesByParentId(copy.id)).toHaveLength(30);
		}

		batch.mockRestore();
	});

	it('removes many subtrees with one bulk delete', async () => {
		resetData();
		const created = await createProject('Batch Remove', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		})!;
		addNode({
			parent_id: panel.id,
			load_data: {
				load_type: default_load_types.GENERAL_LIGHTING,
				quantity: 10,
				varies: '0',
				load_description: 'Load 1',
				continuous: false,
				circuit_number: 1,
				length: 10,
				ambient_temperature: 30,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				config_preference: 'CUSTOM'
			} as never
		});
		const copies = await copyAndAddNodesById(panel.id, 10);

		const database = getDatabase();
		const remove_many = vi.spyOn(database.nodes, 'removeMany');
		const removed_events = vi.fn();
		database.nodes.on('removed', removed_events);
		const removed = removeNodesById([panel.id, ...copies.map((copy) => copy.id)]);
		database.nodes.off('removed', removed_events);

		// One pass and one event, not removeMany's per-item rebuild and requery.
		expect(remove_many).not.toHaveBeenCalled();
		expect(removed_events).toHaveBeenCalledTimes(1);
		expect(removed).toHaveLength(11);
		expect(removed.every((entry) => entry.children_nodes.length === 1)).toBe(true);
		expect(getChildNodesByParentId(root)).toHaveLength(0);
		expect(getChildNodesByParentId(panel.id)).toHaveLength(0);
		// The rebuilt indices still resolve the nodes that stayed.
		expect(getNode(root)?.id).toBe(root);

		remove_many.mockRestore();
	});

	it('removes a panel subtree in one batch', async () => {
		resetData();
		const created = await createProject('Remove', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		const load_data = {
			load_type: default_load_types.GENERAL_LIGHTING,
			quantity: 10,
			varies: '0',
			load_description: 'Load 1',
			continuous: false,
			circuit_number: 1,
			length: 10,
			ambient_temperature: 30,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			config_preference: 'CUSTOM'
		} as const;
		addNode({ parent_id: panel!.id, load_data });

		const removed = removeNode(panel!.id);
		expect(removed?.removed_node.id).toBe(panel!.id);
		expect(removed?.children_nodes).toHaveLength(1);
		expect(getChildNodesByParentId(root)).toHaveLength(0);
		expect(getChildNodesByParentId(panel!.id)).toHaveLength(0);
	});

	it('clears a collection in one pass and keeps indices usable', async () => {
		resetData();
		const created = await createProject('Clear', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		expect(loadSnapshot().nodes).toHaveLength(2);

		const revision = getSnapshotRevision();
		clearCollection(getDatabase().nodes, getDatabase().nodes_memory);
		expect(getDatabase().nodes.find().fetch()).toHaveLength(0);
		expect(loadSnapshot().nodes).toHaveLength(0);
		// The snapshot cache is invalidated, not left serving the old nodes.
		expect(getSnapshotRevision()).toBeGreaterThan(revision);

		// Clearing an already-empty collection is a no-op.
		const empty_revision = getSnapshotRevision();
		clearCollection(getDatabase().nodes, getDatabase().nodes_memory);
		expect(getSnapshotRevision()).toBe(empty_revision);

		// The rebuilt id index still resolves fresh inserts.
		const next = await createProject('AfterClear', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		expect(getNode(next!.root_node_id)?.id).toBe(next!.root_node_id);
	});

	it('writes a burst of mutations to the session file once', async () => {
		type Item = { id: string; value: number };
		const memory: Item[] = [];
		const save = vi.fn<(items: Item[]) => Promise<void>>(async () => {});
		const collection = new Collection<Item>({
			memory,
			persistence: coalesceSaves<Item>(
				{ register: async () => {}, load: async () => ({ items: [] }), save },
				memory,
				5
			)
		});
		await collection.isReady();

		collection.insert({ id: 'a', value: 1 });
		collection.insert({ id: 'b', value: 2 });
		collection.updateOne({ id: 'a' }, { $set: { value: 3 } });
		await vi.waitFor(() => expect(save).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0][0]).toEqual([
			{ id: 'a', value: 3 },
			{ id: 'b', value: 2 }
		]);

		// A change after the write still reaches the file.
		collection.removeOne({ id: 'b' });
		await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
		expect(save.mock.calls[1][0]).toEqual([{ id: 'a', value: 3 }]);
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

describe('incremental writes and reads', () => {
	const panelData = (name: string, circuit_number: number): GenericPhasePanelSchema => ({
		name,
		circuit_number,
		ambient_temperature: 30,
		length: 10,
		terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
		phase: default_phases.ONE_PHASE
	});
	const loadData = (circuit_number: number, quantity = 1000) =>
		({
			load_type: default_load_types.GENERAL_LIGHTING,
			quantity,
			varies: '1',
			load_description: `${quantity} - Lighting ${circuit_number}`,
			continuous: false,
			circuit_number,
			length: 10,
			ambient_temperature: 30,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			config_preference: 'CUSTOM'
		}) as never;

	// root → A → A1 → load ; root → B → load
	async function buildTree() {
		resetData();
		const created = await createProject('Incremental', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const a = addNode({ parent_id: root, panel_data: panelData('A', 1) })!;
		const a1 = addNode({ parent_id: a.id, panel_data: panelData('A1', 1) })!;
		const deep = addNode({ parent_id: a1.id, load_data: loadData(1) })!;
		const b = addNode({ parent_id: root, panel_data: panelData('B', 2) })!;
		const b_load = addNode({ parent_id: b.id, load_data: loadData(1) })!;
		return { root, a, a1, deep, b, b_load };
	}

	it('recomputes only the edited branch and its ancestors', async () => {
		const { root, a, deep, b } = await buildTree();
		const [before_a, before_b] = getComputedLoads(root);
		const before_b_loads = getComputedLoads(b.id);

		updateLoadDescription({
			node_id: deep.id,
			load_description: '1000 - Renamed',
			node_type: 'load'
		});
		overrideField({ node_id: deep.id, field_data: 100, field_type: 'at' });

		const [after_a, after_b] = getComputedLoads(root);
		expect(after_a).not.toBe(before_a);
		// An untouched branch keeps its identity, so its rows never re-render.
		expect(after_b).toBe(before_b);
		expect(getComputedLoads(b.id)).toBe(before_b_loads);
		const a1_row = getComputedLoads(a.id)[0]!;
		expect(getComputedLoads(a1_row.id)[0]).toMatchObject({
			at: 100,
			load_description: '1000 - Renamed'
		});
		// Same numbers as a cold computation of the whole tree.
		const cold = {
			children_by_parent: loadSnapshot().children_by_parent,
			is_dynamic: false,
			memo: new Map()
		};
		expect(after_a).toEqual(computeNodeLoad(getNode(a.id)!, cold));
	});

	it('sees a moved subtree under its new parent in both totals', async () => {
		const { root, a, a1, b } = await buildTree();
		const before = getComputedLoads(root);
		expect(before[0]!.va).toBe(1000);
		expect(before[1]!.va).toBe(1000);

		updateNode({ id: a1.id, parent_id: b.id, whole_data: { ...getNode(a1.id)!, parent_id: b.id } });

		const [after_a, after_b] = getComputedLoads(root);
		expect(after_a!.va).toBe(0);
		expect(after_b!.va).toBe(2000);
		expect(getNode(a.id)?.child_ids).toEqual([]);
		expect(getNode(b.id)?.child_ids).toContain(a1.id);
	});

	it('keeps the parent child list in sync on remove and restore', async () => {
		const { a, a1, deep } = await buildTree();
		overrideField({ node_id: deep.id, field_data: 50, field_type: 'at' });
		const stored_deep = getNode(deep.id)!;

		const removed = removeNode(a1.id)!;
		expect(getNode(a.id)?.child_ids).toEqual([]);

		// History rows carry computed fields; only stored fields come back.
		const [restored] = restoreNodes([
			{
				data: { ...removed.removed_node, at: 999, va: 1 },
				children_nodes: removed.children_nodes
			}
		]);
		expect(restored?.id).toBe(a1.id);
		expect(getNode(a.id)?.child_ids).toEqual([a1.id]);
		expect(getNode(a1.id)?.child_ids).toEqual([deep.id]);
		expect(getNode(a1.id)).not.toHaveProperty('at');
		expect(getNode(a1.id)).not.toHaveProperty('va');
		// Overrides survive the round trip instead of being reset to defaults.
		expect(getNode(deep.id)).toEqual(stored_deep);
		// A second restore of the same nodes is a no-op.
		expect(restoreNodes([{ data: removed.removed_node }])).toEqual([]);
	});

	it('undoes a field edit without dropping children added since', async () => {
		const { a, a1 } = await buildTree();
		const previous = getNode(a.id)!;
		updateNode({
			id: a.id,
			parent_id: previous.parent_id!,
			panel_data: { ...panelData('A renamed', 1) }
		});
		const extra = addNode({ parent_id: a.id, panel_data: panelData('A2', 2) })!;

		updateNode({ id: a.id, parent_id: previous.parent_id!, whole_data: previous });

		expect(getNode(a.id)?.panel_data?.name).toBe('A');
		expect(getNode(a.id)?.child_ids).toEqual([a1.id, extra.id]);
	});

	it('lets other tasks run while a large copy is in progress', async () => {
		const { a } = await buildTree();
		let ran_during_copy = false;
		let copy_done = false;
		const copying = copyAndAddNodesById(a.id, 1000).then((roots) => {
			copy_done = true;
			return roots;
		});
		setTimeout(() => (ran_during_copy = !copy_done), 0);

		const roots = await copying;
		expect(roots).toHaveLength(1000);
		expect(ran_during_copy).toBe(true);
		expect(
			new Set(getChildNodesByParentId(getNode(a.id)!.parent_id!).map((n) => n.circuit_number)).size
		).toBe(1002);
	});

	it('computes the same voltage drops in slices as in one pass', async () => {
		await buildTree();
		const sliced = await getComputedVoltageDropsAsync();
		expect(sliced).toEqual(computeVoltageDropsFromNodes(loadSnapshot().nodes, false));
		expect(getComputedVoltageDrops()).toBe(sliced);
	});

	it('rejects duplicate ids without writing anything', async () => {
		const { a } = await buildTree();
		const database = getDatabase();
		const before = database.nodes_memory.length;
		const clash = { ...getNode(a.id)! };
		expect(() =>
			insertIntoCollection(database.nodes, database.nodes_memory, [
				{ ...clash, id: crypto.randomUUID() },
				clash
			])
		).toThrow('same id');
		expect(database.nodes_memory).toHaveLength(before);
	});

	it('rejects a tampered file with duplicate ids and keeps the session empty', async () => {
		const { root } = await buildTree();
		const project = getDatabase().projects_memory[0]!;
		const nodes = getDatabase().nodes_memory.slice();
		await expect(
			loadCurrentProject({ project, nodes: [...nodes, nodes[1]!] } as never)
		).rejects.toThrow('same id');
		expect(getDatabase().projects_memory).toHaveLength(0);
		expect(getDatabase().nodes_memory).toHaveLength(0);
		expect(getNode(root)).toBeUndefined();
	});

	it('terminates on a looping parent chain from a tampered file', async () => {
		const { a } = await buildTree();
		const database = getDatabase();
		replaceInCollection(database.nodes, database.nodes_memory, [
			{ ...getNode(a.id)!, parent_id: a.id }
		]);
		expect(getNodeDepth(a.id)).toBeGreaterThan(0);
	});

	it('refuses a copy that would exhaust memory', async () => {
		const { a } = await buildTree();
		const count = Math.floor(MAX_COPY_NODES / 3) + 1;
		const before = getDatabase().nodes_memory.length;
		expect(await copyAndAddNodesById(a.id, count)).toEqual([]);
		expect(getDatabase().nodes_memory).toHaveLength(before);
	});

	it('leaves nothing cached when the session ends during a copy', async () => {
		const { a } = await buildTree();
		const copying = copyAndAddNodesById(a.id, 50);
		resetData();
		expect(await copying).toEqual([]);
		expect(getDatabase().nodes_memory).toHaveLength(0);
		expect(computed_loads.size).toBe(0);
	});
});

describe('bulk writes and the session file', () => {
	it('persists bulk inserts and in-place replacements', async () => {
		type Item = { id: string; value: number };
		const memory: Item[] = [];
		const save = vi.fn<(items: Item[]) => Promise<void>>(async () => {});
		const collection = new Collection<Item>({
			memory,
			persistence: coalesceSaves<Item>(
				{ register: async () => {}, load: async () => ({ items: [] }), save },
				memory,
				5
			)
		});
		await collection.isReady();

		insertIntoCollection(collection, memory, [
			{ id: 'a', value: 1 },
			{ id: 'b', value: 2 }
		]);
		replaceInCollection(collection, memory, [{ id: 'a', value: 3 }]);
		await vi.waitFor(() => expect(save).toHaveBeenCalled());
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(save.mock.calls.at(-1)?.[0]).toEqual([
			{ id: 'a', value: 3 },
			{ id: 'b', value: 2 }
		]);
		// The id index still resolves replaced items.
		expect(collection.findOne({ id: 'a' })?.value).toBe(3);
	});
});
