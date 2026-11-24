import { beforeAll, describe, expect, it } from 'vitest';
import {
	DEFAULT_LOADS,
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants.js';
import { getNodes, getProject, initializeDatabase, settled } from './index.js';
import {
	addNode,
	copyAndAddNodeById,
	copyAndAddNodesById,
	createProject,
	loadCurrentProject,
	overrideField,
	removeNode,
	redoEdit,
	removeNodesById,
	resetData,
	undoEdit,
	updateLoadDescription,
	updateNode,
	updateShortCircuitSource,
	updateInterruptingRating,
	setServiceEntrance,
	setSingleCircuitDwelling,
	setGeneratorKva,
	setStandbyPanels,
	changePhaseAssignment,
	changePhaseAssignments,
	updateNodeParentById,
	updateTitleBlock
} from './mutations/index.js';
import {
	checkNodeExists,
	getChildNodesByParentId,
	getComputedLoads,
	getComputedShortCircuitsAsync,
	getComputedVoltageDropsAsync,
	getNode,
	getNodeDepth,
	getNodeById,
	getParentNodes,
	getRiserAsync,
	getCoordinationAsync,
	getSnapshotRevision
} from './queries/index.js';
import { patchNode } from './mutations/nodes.js';
import { getCatalog } from '#lib/core/catalog.js';
import { loadSnapshot } from './queries/snapshot.js';
import { engine } from '#lib/core/api.js';
import type { EngineComputed, Node } from '#lib/types/db.js';
import type { GenericPhaseMainLoadSchema } from '#lib/types/load.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel.js';

beforeAll(async () => {
	await initializeDatabase();
});

/** The node an edit created, as the mirror holds it once the engine answered. */
async function add(...args: Parameters<typeof addNode>): Promise<Node> {
	const { node, error } = await addNode(...args);
	if (!node) throw new Error(error);
	return node;
}

async function update(...args: Parameters<typeof updateNode>): Promise<Node> {
	const { node, error } = await updateNode(...args);
	if (!node) throw new Error(error);
	return node;
}

/** Every row as a cold engine computes it: the same documents opened again from scratch. */
async function coldRows(): Promise<EngineComputed['rows']> {
	await settled();
	const reopened = await engine<EngineComputed>('open', {
		project: getProject() ?? null,
		nodes: getNodes()
	});
	return reopened.rows;
}

describe('db', () => {
	it('creates a project with a root node', async () => {
		resetData();
		const created = await createProject('Test Project', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		expect(created?.project.project_name).toBe('Test Project');
		expect(created?.root_node_id).toBeTruthy();
		expect(getProject()?.id).toBe(created?.project.id);
		expect(getNodes()).toHaveLength(1);
	});

	it('starts a new project at the current PEC 2017 revision, with 400Y/230 V defaults on 3P-Y', async () => {
		resetData();
		const single = await createProject('Single', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = getNode(single!.root_node_id)!;
		expect(root.highest_unit_form).toMatchObject({ pec_2017_sizing: true, pec_2017_revision: 2 });
		expect(root.highest_unit_form?.wye_circuit_defaults).toBeUndefined();
		// The engine completes a root with the defaults every inserted node gets.
		expect(root).toMatchObject({
			conductor_sets: 1,
			conductor_qty: 2,
			conductor_insulation: 'THHN-Cu',
			egc_insulation: 'TW-Cu',
			conduit_type: 'PVC',
			pole: '2',
			kaic: '5',
			is_at_used_as_currents_value: false
		});
		expect(getProject()?.settings).toEqual({});

		const wye = await createProject('Wye', {
			distribution_unit: 'Transformer',
			phase: default_phases.THREE_PHASE_WYE
		});
		// The previous project is gone: a new project is a session of its own.
		expect(getNodes().map((node) => node.id)).toEqual([wye!.root_node_id]);
		expect(getNode(wye!.root_node_id)?.highest_unit_form?.wye_circuit_defaults).toBe(true);
	});

	it('migrates an opened file in the engine and tells whether its sizes may change', async () => {
		resetData();
		const presets = DEFAULT_LOADS.filter((preset) => preset.dwelling_circuit);
		const { project, pec_2017_migrated } = await loadCurrentProject({
			project: { id: 'old', project_name: 'Old', root_node_id: 'root' } as never,
			nodes: [
				{
					id: 'root',
					node_type: 'root',
					child_ids: presets.map((_, index) => `load-${index}`),
					highest_unit_form: { distribution_unit: 'Transformer', phase: '1P' }
				},
				...presets.map((preset, index) => ({
					id: `load-${index}`,
					node_type: 'load',
					parent_id: 'root',
					circuit_number: index + 1,
					child_ids: [],
					load_data: {
						load_description: `1 - ${preset.description}`,
						ambient_temperature: 30,
						terminal_temperature: 'Standard Temperature',
						quantity: 1,
						varies: '1500',
						load_type: 'Convenience Outlet',
						config_preference: 'DEFAULT'
					}
				}))
			]
		} as never);
		expect(pec_2017_migrated).toBe(true);
		expect(project.settings).toEqual({});
		expect(getNode('root')?.highest_unit_form?.phase).toBe(default_phases.ONE_PHASE);
		// The engine's dwelling presets are the ones the load form offers (PEC 2017 2.10.1.11(C)).
		presets.forEach((preset, index) => {
			expect(getNode(`load-${index}`)?.load_data).toMatchObject({
				dwelling_circuit: preset.dwelling_circuit,
				varies: preset.varies,
				load_type: default_load_types.CONVENIENCE_OUTLET,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE
			});
		});
		// The mirror holds what the engine stored, so a save writes the migrated file.
		await settled();
		const snapshot = await engine<{ nodes: unknown[] }>('snapshot');
		expect(snapshot.nodes).toEqual(getNodes());
	});

	it('remembers the title block on the project (PEC 2017 1.3.2.2)', async () => {
		resetData();
		const created = await createProject('Titled', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const title_block = { engineer_name: 'Juan Dela Cruz', sheet_size: 'A3' as const };
		expect(updateTitleBlock(created!.project.id, title_block)?.title_block).toEqual(title_block);
		expect(getProject()?.title_block).toEqual(title_block);
		expect(getProject()?.project_name).toBe('Titled');
		expect(updateTitleBlock('other', {})).toBeUndefined();
	});

	it('lays out the riser diagram in the engine, from the service down', async () => {
		resetData();
		const created = await createProject('Riser', {
			distribution_unit: 'Bldg A',
			phase: default_phases.ONE_PHASE
		});
		const panel = await add({
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
		const layout = await getRiserAsync(created!.root_node_id);
		expect(layout?.boxes.map((box) => box.title)).toEqual(['Bldg A', 'LP-1']);
		expect(layout?.labels.map((label) => label.id)).toEqual([panel!.id]);
		expect(layout?.meter).toBeDefined();
		expect(await getRiserAsync('missing')).toBeNull();
	});

	it('applies insert defaults to nodes', async () => {
		resetData();
		const created = await createProject('Defaults', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const node = await add({
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
		const first = await add({
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
		await add({
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
		const parents = await getParentNodes();
		expect(parents.map((p) => p.name).sort()).toEqual(['LP-1', 'Transformer'].sort());
		// LP-1 sits under the root, so it is never offered as the root's own parent.
		expect(await getParentNodes(root)).toEqual([]);
	});

	it('loads a project export and sorts children by circuit number', async () => {
		resetData();
		const { project } = await loadCurrentProject({
			project: {
				id: 'p1',
				project_name: 'Imported',
				settings: {},
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
		await settled();
		expect(project.project_name).toBe('Imported');
		const children = getChildNodesByParentId('root');
		expect(children.map((c) => c.circuit_number)).toEqual([1, 2]);
		const fetched = getNodeById('a');
		expect(fetched?.panel_data?.name).toBe('LP-A');
		expect(fetched?.panel_data?.phase).toBe(default_phases.ONE_PHASE);
	});

	it('derates parallel sets whatever an older file says (PEC 2017 3.10.2.6(B)(3)(a))', async () => {
		resetData();
		await loadCurrentProject({
			project: {
				id: 'p1',
				// Files from before the adjustment became mandatory could switch it off here.
				settings: { is_adjustment_factor_dynamic: false } as never,
				root_node_id: 'root'
			},
			nodes: [
				{ id: 'root', node_type: 'root', child_ids: ['f'] },
				{
					id: 'f',
					node_type: 'panel',
					circuit_number: 1,
					parent_id: 'root',
					child_ids: [],
					length: 5,
					conductor_sets: 2,
					conductor_qty: 2,
					overrided_at: 200,
					panel_data: {
						name: 'LP-F',
						ambient_temperature: 30,
						terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
						phase: default_phases.ONE_PHASE
					}
				}
			]
		});
		await settled();
		// 200 A on 2 sets × 2 wires: 4 current-carrying conductors at 80 %, 100 A a set;
		// 30 mm² THHN is 115 A × 0.8 = 92 A, 38 mm² 104 A (and 115 A at its 75 °C terminations).
		expect(getNodeById('f')?.conductor_size).toBe(38);
	});

	it('rates branch breakers by duty and dwelling circuit (PEC 2017 2.10.2.3(A), 2.10.1.11(C))', async () => {
		resetData();
		const created = await createProject('Branches', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const outlet = async (circuit_number: number, varies: string, extra: object) =>
			(await add({
				parent_id: root,
				load_data: {
					load_type: default_load_types.CONVENIENCE_OUTLET,
					quantity: 1,
					varies,
					load_description: `1 - Outlet ${circuit_number}`,
					continuous: true,
					circuit_number,
					length: 10,
					ambient_temperature: 30,
					terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
					config_preference: 'CUSTOM',
					...extra
				}
			}))!.id;
		// 3910 VA / 230 V = 17 A: 21.25 A continuous → 25 A; 17 A noncontinuous → 20 A.
		const continuous = await outlet(1, '3910', {});
		const noncontinuous = await outlet(2, '3910', { continuous: false });
		// 180 VA (2.20.2.5(I)) is 0.98 A at 125 %: 15 A, the smallest rating, on 2.0 mm².
		const plain = await outlet(3, '180', {});
		// The same outlet on a dwelling's bathroom circuit is 20 A, on 3.5 mm² (2.40.1.4(D)).
		const bathroom = await outlet(4, '0', { dwelling_circuit: 'bathroom' });
		await settled();
		const at = (id: string) => getNodeById(id)?.at;
		expect([at(continuous), at(noncontinuous), at(plain), at(bathroom)]).toEqual([25, 20, 15, 20]);
		expect(getNodeById(plain)?.conductor_size).toBe(2);
		expect(getNodeById(bathroom)?.conductor_size).toBe(3.5);
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
		const node = await add({
			parent_id: root,
			load_data
		});
		await settled();

		const first_loads = getComputedLoads(root);
		const second_loads = getComputedLoads(root);
		expect(second_loads).toBe(first_loads);
		expect(second_loads[0]).toBe(first_loads[0]);

		const voltage_drops = await getComputedVoltageDropsAsync();
		expect(await getComputedVoltageDropsAsync()).toBe(voltage_drops);
		expect(voltage_drops).toHaveLength(1);

		// The revision-keyed memo must not survive a write.
		await update({
			id: node!.id,
			parent_id: root,
			load_data: { ...load_data, length: 20 }
		});
		const updated_drops = await getComputedVoltageDropsAsync();
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
		const panel_a = await add({ parent_id: root, panel_data: panel_data('LP-A', 1) });
		const panel_b = await add({ parent_id: root, panel_data: panel_data('LP-B', 2) });

		await settled();
		const first = getNodeById(panel_a!.id);
		expect(getNodeById(panel_a!.id)).toBe(first);

		await update({
			id: panel_b!.id,
			parent_id: root,
			panel_data: panel_data('LP-B2', 2)
		});
		await settled();
		expect(getNodeById(panel_a!.id)).toBe(first);

		await update({
			id: panel_a!.id,
			parent_id: root,
			panel_data: panel_data('LP-A2', 1)
		});
		await settled();
		const edited = getNodeById(panel_a!.id);
		expect(edited).not.toBe(first);
		expect(edited?.panel_data?.name).toBe('LP-A2');
	});

	it('returns fresh data when a node id is reused after removal', async () => {
		resetData();
		const created = await createProject('ReusedId', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = await add({
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
		await settled();
		expect(getNodeById(panel!.id)?.panel_data?.name).toBe('LP-A');

		// Undo brings the node back under its old id.
		await removeNode(panel!.id);
		await undoEdit();
		await updateLoadDescription({
			node_id: panel!.id,
			load_description: 'LP-A-new',
			node_type: 'panel'
		});
		await settled();
		expect(getNodeById(panel!.id)?.panel_data?.name).toBe('LP-A-new');
	});

	it('gives the table and the header the same panel and load results', async () => {
		resetData();
		const created = await createProject('TwoPaths', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = await add({
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
		await add({ parent_id: panel!.id, load_data: load_data(1) });
		await add({ parent_id: panel!.id, load_data: load_data(2) });

		await settled();
		const children = getChildNodesByParentId(panel!.id);
		const via_id = getNodeById(panel!.id)!;
		const via_compute = getComputedLoads(root).find((row) => row.id === panel!.id)!;
		for (const field of [
			'va',
			'current',
			'at',
			'conductor_size',
			'conduit_size',
			'ampere_frames',
			// PEC 2017 Table 2.50.6.13: both size the panel's EGC on its main breaker.
			'egc_size'
		] as const) {
			expect(via_id[field]).toBe(via_compute[field]);
		}

		expect(getNodeById(children[0].id)).toEqual(getComputedLoads(panel!.id)[0]);
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

		await add({
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
		await add({
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
		await add({
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
		const panel = await add({
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
		await add({ parent_id: panel!.id, load_data: load_data(1) });
		await add({ parent_id: panel!.id, load_data: load_data(2) });

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
		const panel = await add({
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
			await add({
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

		await settled();
		const revision = getSnapshotRevision();

		const { nodes: copies } = await copyAndAddNodesById(panel.id, 100);

		expect(copies).toHaveLength(100);
		// One edit, applied to the mirror once, instead of one write per copied node.
		expect(getSnapshotRevision() - revision).toBe(1);
		expect(countNodes()).toBe(2 + 30 + 100 * 31);
		expect(getChildNodesByParentId(root)).toHaveLength(101);
		expect(new Set(copies.map((copy) => copy.circuit_number)).size).toBe(100);
		for (const copy of copies) {
			expect(copy.parent_id).toBe(root);
			expect(getChildNodesByParentId(copy.id)).toHaveLength(30);
		}
	});

	it('removes many subtrees with one bulk delete', async () => {
		resetData();
		const created = await createProject('Batch Remove', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = await add({
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
		await add({
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
		const { nodes: copies } = await copyAndAddNodesById(panel.id, 10);

		const revision = getSnapshotRevision();
		const removed = await removeNodesById([panel.id, ...copies.map((copy) => copy.id)]);

		// One edit invalidates the snapshot once.
		expect(getSnapshotRevision() - revision).toBe(1);
		// Eleven panels, each with its load.
		expect(removed).toBe(22);
		expect(getChildNodesByParentId(root)).toHaveLength(0);
		expect(getChildNodesByParentId(panel.id)).toHaveLength(0);
		// The rebuilt indices still resolve the nodes that stayed.
		expect(getNode(root)?.id).toBe(root);
	});

	it('removes a panel subtree in one batch', async () => {
		resetData();
		const created = await createProject('Remove', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = await add({
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
		await add({ parent_id: panel!.id, load_data });

		expect(await removeNode(panel!.id)).toBe(2);
		expect(getChildNodesByParentId(root)).toHaveLength(0);
		expect(getChildNodesByParentId(panel!.id)).toHaveLength(0);
	});

	it('ends the session in one pass and accepts a new project after', async () => {
		resetData();
		const created = await createProject('Clear', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		await add({
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
		resetData();
		expect(countNodes()).toBe(0);
		expect(getProject()).toBeUndefined();
		expect(loadSnapshot().nodes).toHaveLength(0);
		// The snapshot cache is invalidated, not left serving the old nodes.
		expect(getSnapshotRevision()).toBeGreaterThan(revision);

		const next = await createProject('AfterClear', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		await settled();
		expect(getNode(next!.root_node_id)?.id).toBe(next!.root_node_id);
		expect(getNodeById(next!.root_node_id)?.id).toBe(next!.root_node_id);
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
		const a = await add({ parent_id: root, panel_data: panelData('A', 1) })!;
		const a1 = await add({ parent_id: a.id, panel_data: panelData('A1', 1) })!;
		const deep = await add({ parent_id: a1.id, load_data: loadData(1) })!;
		const b = await add({ parent_id: root, panel_data: panelData('B', 2) })!;
		const b_load = await add({ parent_id: b.id, load_data: loadData(1) })!;
		await settled();
		return { root, a, a1, deep, b, b_load };
	}

	it('recomputes only the edited branch and its ancestors', async () => {
		const { root, a, deep, b } = await buildTree();
		const [before_a, before_b] = getComputedLoads(root);
		const before_b_loads = getComputedLoads(b.id);

		await updateLoadDescription({
			node_id: deep.id,
			load_description: '1000 - Renamed',
			node_type: 'load'
		});
		await overrideField({ node_id: deep.id, field_data: 100, field_type: 'at' });

		await settled();
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
		expect(after_a).toMatchObject((await coldRows())[a.id]!);
	});

	it('sees a moved subtree under its new parent in both totals', async () => {
		const { root, a, a1, b } = await buildTree();
		const before = getComputedLoads(root);
		expect(before[0]!.va).toBe(1000);
		expect(before[1]!.va).toBe(1000);

		await updateNodeParentById(a1.id, b.id);

		await settled();
		const [after_a, after_b] = getComputedLoads(root);
		expect(after_a!.va).toBe(0);
		expect(after_b!.va).toBe(2000);
		expect(getNode(a.id)?.child_ids).toEqual([]);
		expect(getNode(b.id)?.child_ids).toContain(a1.id);
	});

	it('brings a removed subtree back exactly on undo', async () => {
		const { a, a1, deep } = await buildTree();
		await overrideField({ node_id: deep.id, field_data: 50, field_type: 'at' });
		const stored_deep = getNode(deep.id)!;

		await removeNode(a1.id);
		expect(getNode(a.id)?.child_ids).toEqual([]);
		expect(getNode(deep.id)).toBeUndefined();

		await undoEdit();
		expect(getNode(a.id)?.child_ids).toEqual([a1.id]);
		expect(getNode(a1.id)?.child_ids).toEqual([deep.id]);
		// Overrides survive the round trip instead of being reset to defaults.
		expect(getNode(deep.id)).toEqual(stored_deep);
	});

	it('answers false, not a rejection, when the session is replaced mid-undo', async () => {
		await buildTree();
		const undone = undoEdit();
		const redone = redoEdit();
		resetData();
		await expect(undone).resolves.toBe(false);
		await expect(redone).resolves.toBe(false);
	});

	it('undoes edits newest first and redoes them in order', async () => {
		const { a, a1 } = await buildTree();
		await update({
			id: a.id,
			parent_id: getNode(a.id)!.parent_id!,
			panel_data: panelData('A renamed', 1)
		});
		const extra = await add({ parent_id: a.id, panel_data: panelData('A2', 2) });

		await undoEdit();
		expect(getNode(a.id)?.child_ids).toEqual([a1.id]);
		expect(getNode(a.id)?.panel_data?.name).toBe('A renamed');
		await undoEdit();
		expect(getNode(a.id)?.panel_data?.name).toBe('A');

		await redoEdit();
		await redoEdit();
		expect(getNode(a.id)?.panel_data?.name).toBe('A renamed');
		expect(getNode(a.id)?.child_ids).toEqual([a1.id, extra.id]);
	});

	it('copies a subtree a thousand times with distinct circuit numbers', async () => {
		const { a } = await buildTree();
		const { nodes: roots } = await copyAndAddNodesById(a.id, 1000);
		expect(roots).toHaveLength(1000);
		expect(
			new Set(getChildNodesByParentId(getNode(a.id)!.parent_id!).map((n) => n.circuit_number)).size
		).toBe(1002);
	});

	it('keeps the single-phase voltage drop formula: 2·I·Z over 230 V', async () => {
		await buildTree();
		for (const drop of await getComputedVoltageDropsAsync()) {
			const current = getComputedLoads(drop.parent_id!).find((l) => l.id === drop.id)!.current;
			// On the run's own ohms (Ω/305 m × length), not the 0.0001 Ω shown as actual_z.
			const run_z = (drop.length! * drop.z!) / 305;
			expect(drop.voltage_per_segment).toBeCloseTo(2 * current * run_z, 4);
			expect(drop.actual_z).toBeCloseTo(run_z, 4);
			expect(drop.voltage_at_receiving_end).toBeCloseTo(230 - drop.voltage_at_end_circuit, 10);
		}
	});

	it('reuses the voltage drops until the next write', async () => {
		await buildTree();
		const drops = await getComputedVoltageDropsAsync();
		expect(await getComputedVoltageDropsAsync()).toBe(drops);
	});

	it('stores the short-circuit source on the root and recomputes fault currents', async () => {
		const { root, a } = await buildTree();
		const before = await getComputedShortCircuitsAsync();
		expect(before.every((row) => row.status === 'no_source')).toBe(true);
		expect(await getComputedShortCircuitsAsync()).toBe(before);

		const source = { utility_sc_kva: 1_000_000, transformer_kva: 100, transformer_z_percent: 2.5 };
		const updated = await updateShortCircuitSource(root, source);
		expect(updated?.highest_unit_form).toEqual({
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE,
			pec_2017_sizing: true,
			pec_2017_revision: 2,
			...source
		});
		expect(await updateShortCircuitSource(a.id, source)).toBeUndefined();
		expect(getNode(a.id)?.highest_unit_form).toBeUndefined();

		const after = await getComputedShortCircuitsAsync();
		expect(after).not.toBe(before);
		// PEC 2017 App. D Ex. D13 transformer on the 1000 MVA grid: 434.78 A / 0.0251 pu.
		const first = after.find((row) => row.id === a.id)!;
		expect(Math.round(first.supply_fault_current!)).toBe(17_322);
	});

	it('checks each breaker against the interrupting rating typed for it (PEC 2017 1.10.1.9)', async () => {
		const { root, a } = await buildTree();
		await updateShortCircuitSource(root, {
			utility_sc_kva: 1_000_000,
			transformer_kva: 100,
			transformer_z_percent: 2.5
		});
		// 17,322 A available (App. D Ex. D13) is over an unmarked 5 kA breaker.
		const unmarked = (await getComputedShortCircuitsAsync()).find((row) => row.id === a.id)!;
		expect(unmarked.interrupting_rating_ka).toBe(5);
		expect(unmarked.status).toBe('under_rated');

		await updateInterruptingRating({ node_id: a.id, kaic: 18 });
		expect(getNode(a.id)?.kaic).toBe('18');
		const rated = (await getComputedShortCircuitsAsync()).find((row) => row.id === a.id)!;
		expect(rated.interrupting_rating_ka).toBe(18);
		expect(rated.status).toBe('ok');

		await updateInterruptingRating({ node_id: a.id, kaic: 17 });
		const short = (await getComputedShortCircuitsAsync()).find((row) => row.id === a.id)!;
		expect(short.status).toBe('under_rated');
	});

	it('rejects a tampered file with duplicate ids and keeps the session empty', async () => {
		const { root } = await buildTree();
		const project = getProject()!;
		const nodes = getNodes();
		await expect(
			loadCurrentProject({ project, nodes: [...nodes, nodes[1]!] } as never)
		).rejects.toThrow('same id');
		expect(getProject()).toBeUndefined();
		expect(countNodes()).toBe(0);
		expect(getNode(root)).toBeUndefined();
	});

	it('terminates on a looping parent chain from a tampered file', async () => {
		const { a } = await buildTree();
		await patchNode(a.id, { parent_id: a.id });
		expect(getNodeDepth(a.id)).toBeGreaterThan(0);
	});

	it('refuses a copy that would exhaust memory', async () => {
		const { a } = await buildTree();
		const count = Math.floor(getCatalog().max_copy_nodes / 3) + 1;
		const before = countNodes();
		const refused = await copyAndAddNodesById(a.id, count);
		expect(refused.nodes).toEqual([]);
		expect(refused.error).toMatch(/more than/);
		expect(countNodes()).toBe(before);
	});

	it('writes nothing when the session ends during a copy', async () => {
		const { a } = await buildTree();
		const copying = copyAndAddNodesById(a.id, 50);
		resetData();
		expect((await copying).nodes).toEqual([]);
		expect(countNodes()).toBe(0);
	});
});

describe('service disconnecting means, PEC 2017 2.30.6.10', () => {
	const lighting = (circuit_number: number) =>
		({
			load_type: default_load_types.LIGHTING_LOAD,
			quantity: 1,
			varies: '400',
			load_description: `Light ${circuit_number}`,
			continuous: false,
			circuit_number,
			length: 10,
			ambient_temperature: 30,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			config_preference: 'CUSTOM'
		}) as never;

	it('gives the service panel 60 A for three circuits, and a feeder-supplied one its own rating', async () => {
		resetData();
		const created = await createProject('Service', {
			distribution_unit: 'Utility Meter',
			phase: default_phases.ONE_PHASE,
			is_service: true
		});
		const root = created!.root_node_id;
		const panel = await add({
			parent_id: root,
			panel_data: {
				name: 'SP',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		})!;
		for (const n of [1, 2, 3]) await add({ parent_id: panel.id, load_data: lighting(n) });
		await settled();
		// (E): 3 × 400 VA is 5.2 A, but the service disconnect is at least 60 A.
		expect(getComputedLoads(root)[0]?.at).toBe(60);

		expect((await setServiceEntrance(root, false))?.highest_unit_form?.is_service).toBe(false);
		await settled();
		// As a feeder: 5.2 A of noncontinuous load (2.15.1.3) takes the smallest rating, 15 A.
		expect(getComputedLoads(root)[0]?.at).toBe(15);
		expect(await setServiceEntrance(panel.id, true)).toBeUndefined();
	});

	it('gives a one-circuit service 15 A, or 20 A for a single-circuit dwelling (PEC 2017 2.30.6.10(A), (B))', async () => {
		resetData();
		const created = await createProject('One circuit', {
			distribution_unit: 'Utility Meter',
			phase: default_phases.ONE_PHASE,
			is_service: true
		});
		const root = created!.root_node_id;
		const panel = await add({
			parent_id: root,
			panel_data: {
				name: 'SP',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		})!;
		await add({ parent_id: panel.id, load_data: lighting(1) });
		await settled();
		expect(getComputedLoads(root)[0]?.at).toBe(15);

		const unit = (await setSingleCircuitDwelling(root, true))?.highest_unit_form;
		expect(unit).toMatchObject({ single_circuit_dwelling: true, is_service: true });
		await settled();
		expect(getComputedLoads(root)[0]?.at).toBe(20);
		expect(await setSingleCircuitDwelling(panel.id, true)).toBeUndefined();
	});

	it('stores the standby generator and its panels on the supply (PEC 2017 7.2.1.4)', async () => {
		resetData();
		const created = await createProject('Standby', {
			distribution_unit: 'Utility Meter',
			phase: default_phases.ONE_PHASE,
			is_service: true
		});
		const root = created!.root_node_id;
		const panel = await add({
			parent_id: root,
			panel_data: {
				name: 'EP',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		})!;
		await setStandbyPanels(root, [panel.id]);
		const unit = (await setGeneratorKva(root, 25))?.highest_unit_form;
		expect(unit).toMatchObject({ generator_kva: 25, standby_panels: [panel.id], is_service: true });
		const lines = (await getRiserAsync(root))?.boxes[0]?.lines;
		// 25 kVA at 230 V is 108.7 A; its conductors carry 115 % of it (4.45.1.13(A)).
		expect(lines).toContain('Gen. conductors ≥ 125 A');
		expect(
			(await setGeneratorKva(root, undefined))?.highest_unit_form?.generator_kva
		).toBeUndefined();
	});
});

describe('three-phase delta, 230 V (PEC 2017 2.20.1.5(A), App. D Ex. D14/D15)', () => {
	const panel = (name: string, circuit_number: number, phase: string): GenericPhasePanelSchema => ({
		name,
		circuit_number,
		ambient_temperature: 30,
		length: 10,
		terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
		phase: phase as GenericPhasePanelSchema['phase']
	});
	const load = (circuit_number: number, load_type: string, varies: string) =>
		({
			load_type,
			quantity: 1,
			varies,
			load_description: `Load ${circuit_number}`,
			continuous: false,
			circuit_number,
			length: 10,
			ambient_temperature: 30,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			config_preference: 'CUSTOM'
		}) as never;

	// root (3P-Δ) ─ MDP (3P-Δ) ─┬─ 1: 23 000 VA lighting → AB
	//                           ├─ 3: 20 700 VA lighting → BC
	//                           ├─ 5: 14 400 VA lighting → CA
	//                           └─ 7: 20 A 3P motor (D15) → ABC at 230 V
	async function buildDeltaTree() {
		resetData();
		const created = await createProject('Delta', {
			distribution_unit: 'Transformer',
			phase: default_phases.THREE_PHASE_DELTA
		});
		const root = created!.root_node_id;
		const mdp = await add({
			parent_id: root,
			panel_data: panel('MDP', 1, default_phases.THREE_PHASE_DELTA)
		})!;
		const lighting = (n: number, va: string) =>
			add({ parent_id: mdp.id, load_data: load(n, default_load_types.LIGHTING_LOAD, va) });
		const ab = await lighting(1, '23000');
		const bc = await lighting(3, '20700');
		const ca = await lighting(5, '14400');
		const motor = await add({
			parent_id: mdp.id,
			load_data: load(7, default_load_types.THREE_P_MOTOR__RATED_CURRENT, '20')
		})!;
		await settled();
		return { root, mdp, ab, bc, ca, motor };
	}

	it('wires circuits line to line: 3-pole 3-wire three-phase, 2-pole 2-wire single-phase', async () => {
		const { mdp, ab, motor } = await buildDeltaTree();
		expect([mdp.pole, mdp.conductor_qty]).toEqual(['3', 3]);
		expect([motor.pole, motor.conductor_qty]).toEqual(['3', 3]);
		expect([ab.pole, ab.conductor_qty]).toEqual(['2', 2]);
	});

	it('puts single-phase loads on line pairs and sizes on the most loaded line', async () => {
		const { root, mdp } = await buildDeltaTree();
		const loads = new Map(getComputedLoads(mdp.id).map((l) => [l.circuit_number, l]));
		expect(loads.get(1)).toMatchObject({ phase: 'AB', voltage: 230, current: 100 });
		expect(loads.get(3)?.phase).toBe('BC');
		expect(loads.get(5)?.phase).toBe('CA');
		expect(loads.get(7)).toMatchObject({ phase: 'ABC', voltage: 230, current: 20 });

		const [row] = getComputedLoads(root);
		const share = (20 * 230 * 1.732) / 3;
		expect(row?.voltage).toBe(230);
		expect(row?.pair_va?.AB).toBeCloseTo(23_000 + share, 6);
		expect(row?.phase_va).toBeUndefined();
		// I_B = √(I_BC² + I_AB² + I_BC·I_AB), the heaviest line here.
		const [i_ab, i_bc] = [(23_000 + share) / 230, (20_700 + share) / 230];
		expect(row?.line_current?.B).toBeCloseTo(Math.sqrt(i_bc ** 2 + i_ab ** 2 + i_bc * i_ab), 2);
		expect(row?.current).toBe(row?.line_current?.B);
		expect(row!.current).toBeGreaterThan(row!.balanced_current!);
	});

	it('feeds a single-phase sub-panel line to line', async () => {
		const { mdp, ab } = await buildDeltaTree();
		const lp = await add({
			parent_id: mdp.id,
			panel_data: panel('LP', 9, default_phases.ONE_PHASE)
		})!;
		await add({ parent_id: lp.id, load_data: load(1, default_load_types.LIGHTING_LOAD, '100') });
		await settled();
		// A single-phase panel on delta takes the pair of its circuit number (9–10 → BC).
		const row = getComputedLoads(mdp.id).find((l) => l.id === lp.id);
		expect(row).toMatchObject({ phase: 'BC', voltage: 230, pole: '2', conductor_qty: 2 });
		expect(getComputedLoads(mdp.id).find((l) => l.id === ab.id)?.phase).toBe('AB');
	});
});

describe('three-phase wye, 400Y/230 V (PEC 2017 App. D Ex. D6/D8)', () => {
	const wyePanel = (name: string, circuit_number: number): GenericPhasePanelSchema => ({
		name,
		circuit_number,
		ambient_temperature: 30,
		length: 10,
		terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
		phase: default_phases.THREE_PHASE_WYE
	});
	const onePhasePanel = (name: string, circuit_number: number): GenericPhasePanelSchema => ({
		...wyePanel(name, circuit_number),
		phase: default_phases.ONE_PHASE
	});
	const load = (circuit_number: number, load_type: string, varies: string, length = 10) =>
		({
			load_type,
			quantity: 1,
			varies,
			load_description: `Load ${circuit_number}`,
			continuous: false,
			circuit_number,
			length,
			ambient_temperature: 30,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			config_preference: 'CUSTOM'
		}) as never;

	async function wyeProject() {
		resetData();
		const created = await createProject('Wye', {
			distribution_unit: 'Transformer',
			phase: default_phases.THREE_PHASE_WYE
		});
		return created!.root_node_id;
	}

	// root ─ MDP (3P-Y) ─┬─ 1: 1 840 VA lighting   → A (D7's 1-Hp acu, 8 A × 230 V)
	//                    ├─ 3: 1 500 VA lighting   → B
	//                    ├─ 5: 1 500 VA lighting   → C
	//                    ├─ 7: 6 000 VA 3P equipment (D6 package ACU) → ABC
	//                    ├─ 9: 44 A 3P motor (25 HP, Table 4.30.14.4 @ 400 V) → ABC
	//                    └─ 11: LP-1 (1P) ─ 1: 2 300 VA lighting → LP-1 on C
	async function buildWyeTree() {
		const root = await wyeProject();
		const mdp = await add({ parent_id: root, panel_data: wyePanel('MDP', 1) })!;
		const a = await add({
			parent_id: mdp.id,
			load_data: load(1, default_load_types.LIGHTING_LOAD, '1840')
		})!;
		const b = await add({
			parent_id: mdp.id,
			load_data: load(3, default_load_types.LIGHTING_LOAD, '1500')
		})!;
		const c = await add({
			parent_id: mdp.id,
			load_data: load(5, default_load_types.LIGHTING_LOAD, '1500')
		})!;
		const acu = await add({
			parent_id: mdp.id,
			load_data: load(7, default_load_types.THREE_P_EQUIPMENT, '6000')
		})!;
		const motor = await add({
			parent_id: mdp.id,
			load_data: load(9, default_load_types.THREE_P_MOTOR__RATED_CURRENT, '44')
		})!;
		const lp1 = await add({ parent_id: mdp.id, panel_data: onePhasePanel('LP-1', 11) })!;
		const lp1_load = await add({
			parent_id: lp1.id,
			load_data: load(1, default_load_types.LIGHTING_LOAD, '2300')
		})!;
		await settled();
		return { root, mdp, a, b, c, acu, motor, lp1, lp1_load };
	}

	it('sets poles and conductor count per circuit type on insert', async () => {
		const { mdp, a, acu, motor, lp1, lp1_load } = await buildWyeTree();
		expect([mdp.pole, mdp.conductor_qty]).toEqual(['3', 4]); // D6/D8: 3 phase + neutral, 3-pole
		expect([acu.pole, acu.conductor_qty]).toEqual(['3', 3]); // D6: 3-wire
		expect([motor.pole, motor.conductor_qty]).toEqual(['3', 3]); // D9: three wires
		for (const single of [a, lp1, lp1_load]) {
			expect([single.pole, single.conductor_qty]).toEqual(['1', 2]); // D6: 2-wire, 1-pole
		}
	});

	it('keeps single-phase defaults on a single-phase project', async () => {
		resetData();
		const created = await createProject('One', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const node = await add({
			parent_id: created!.root_node_id,
			panel_data: onePhasePanel('LP', 1)
		})!;
		expect([node.pole, node.conductor_qty]).toEqual(['2', 2]);
	});

	it('balances single-phase loads by circuit number and sizes on the higher current', async () => {
		const { root, mdp } = await buildWyeTree();
		const [row] = getComputedLoads(root);
		expect(row?.voltage).toBe(400);
		expect(row?.phase).toBe('ABC');

		const loads = new Map(getComputedLoads(mdp.id).map((l) => [l.circuit_number, l]));
		expect(loads.get(1)).toMatchObject({ phase: 'A', voltage: 230, current: 8 });
		expect(loads.get(3)?.phase).toBe('B');
		expect(loads.get(5)?.phase).toBe('C');
		expect(loads.get(7)).toMatchObject({ phase: 'ABC', voltage: 400 });
		expect(loads.get(7)?.current).toBeCloseTo(6_000 / 692.8, 2);
		expect(loads.get(9)).toMatchObject({ phase: 'ABC', voltage: 400, current: 44 });
		expect(loads.get(11)).toMatchObject({ phase: 'C', voltage: 230, current: 10 });

		const motor_va = 44 * 400 * 1.732;
		const share = (6_000 + motor_va) / 3;
		expect(row?.phase_va?.A).toBeCloseTo(1_840 + share, 6);
		expect(row?.phase_va?.B).toBeCloseTo(1_500 + share, 6);
		expect(row?.phase_va?.C).toBeCloseTo(1_500 + 2_300 + share, 6);

		const total = 1_840 + 1_500 + 1_500 + 6_000 + motor_va + 2_300;
		expect(row?.va).toBeCloseTo(total, 6);
		// D6 6.3 balanced formula vs the most loaded phase (C) at 230 V.
		expect(row?.balanced_current).toBeCloseTo(total / 692.8, 2);
		expect(row?.current).toBeCloseTo((1_500 + 2_300 + share) / 230, 2);
		expect(row!.current).toBeGreaterThan(row!.balanced_current!);
	});

	it('agrees with the sidebar/header computation', async () => {
		const { mdp } = await buildWyeTree();
		const by_id = getNodeById(mdp.id)!;
		const computed = getComputedLoads(getNode(mdp.id)!.parent_id!).find(
			(row) => row.id === mdp.id
		)!;
		expect(by_id.phase_va).toEqual(computed.phase_va);
		expect(by_id.current).toBe(computed.current);
		expect(by_id.balanced_current).toBe(computed.balanced_current);
		expect(by_id.voltage).toBe(400);
	});

	it('moves a circuit to another phase and back', async () => {
		const { mdp, a } = await buildWyeTree();
		const before = getComputedLoads(getNode(mdp.id)!.parent_id!)[0]!.phase_va!;

		await changePhaseAssignment(a.id, 'C');
		await settled();
		const moved = getComputedLoads(getNode(mdp.id)!.parent_id!)[0]!.phase_va!;
		expect(moved.A).toBeCloseTo(before.A - 1_840, 6);
		expect(moved.C).toBeCloseTo(before.C + 1_840, 6);
		expect(getComputedLoads(mdp.id).find((l) => l.id === a.id)?.phase).toBe('C');

		await changePhaseAssignment(a.id, undefined);
		await settled();
		expect(getComputedLoads(getNode(mdp.id)!.parent_id!)[0]!.phase_va).toEqual(before);
	});

	it('refuses three-phase circuits under a single-phase panel', async () => {
		const { mdp, motor, lp1 } = await buildWyeTree();
		const added = await addNode({
			parent_id: lp1.id,
			load_data: load(3, default_load_types.THREE_P_EQUIPMENT, '3000')
		});
		expect(added.error).toBe('A three-phase circuit needs a three-phase supply.');
		const moved = await updateNode({
			id: motor.id,
			parent_id: lp1.id,
			load_data: getNode(motor.id)!.load_data as never
		});
		expect(moved.error).toBe('A three-phase circuit needs a three-phase supply.');
		expect(getNode(motor.id)!.parent_id).toBe(mdp.id);
		// MDP feeds three-phase circuits, so it cannot turn single-phase.
		const turned = await updateNode({
			id: mdp.id,
			parent_id: getNode(mdp.id)!.parent_id!,
			panel_data: onePhasePanel('MDP', 1)
		});
		expect(turned.error).toMatch(/must stay three-phase/);
		expect((await getParentNodes(motor.id)).map((parent) => parent.name)).not.toContain('LP-1');
		// A panel is never offered its own subtree.
		expect((await getParentNodes(mdp.id)).map((parent) => parent.name)).not.toContain('LP-1');
	});

	it('gives a load the pole and wire count of its new type, unless the user changed them', async () => {
		const { mdp, a, b } = await buildWyeTree();
		const to3p = (id: string, circuit: number) =>
			update({
				id,
				parent_id: mdp.id,
				load_data: load(circuit, default_load_types.THREE_P_EQUIPMENT, '3000')
			});
		expect([(await to3p(a.id, 1)).pole, getNode(a.id)!.conductor_qty]).toEqual(['3', 3]);
		const back = await update({
			id: a.id,
			parent_id: mdp.id,
			load_data: load(1, default_load_types.LIGHTING_LOAD, '1840')
		})!;
		expect([back.pole, back.conductor_qty]).toEqual(['1', 2]);

		await patchNode(b.id, { conductor_qty: 3 });
		const kept = await to3p(b.id, 3);
		expect([kept.pole, kept.conductor_qty]).toEqual(['1', 3]);
	});

	it('drag and drop refuses moves that break the tree or the supply', async () => {
		const { root, mdp, motor, lp1, lp1_load } = await buildWyeTree();
		const refused = async (id: string, parent: string) => {
			const before = getNode(id)!.parent_id;
			const result = await updateNodeParentById(id, parent);
			expect(result.error).toBeTruthy();
			expect(getNode(id)!.parent_id).toBe(before);
		};
		await refused(motor.id, lp1.id); // a 3P motor on a 1P panel (D6)
		await refused(mdp.id, mdp.id); // onto itself
		await refused(mdp.id, lp1.id); // into its own sub-panel
		await refused(root, mdp.id); // the root never moves
		await refused(lp1.id, lp1_load.id); // loads supply nothing
	});

	it('drag and drop renumbers a taken circuit and drops the old phase pick', async () => {
		const { root, mdp, a } = await buildWyeTree();
		await changePhaseAssignment(a.id, 'C');
		// MDP is circuit 1 on the root, and so is load A on MDP.
		const result = await updateNodeParentById(a.id, root);
		expect(result.error).toBeUndefined();
		expect(result.renumbered_to).toBe(2);
		expect(getNode(a.id)).toMatchObject({ parent_id: root, circuit_number: 2 });
		expect(getNode(a.id)!.phase_assignment).toBeUndefined();
		expect(getNode(root)!.child_ids).toContain(a.id);
		expect(getNode(mdp.id)!.child_ids).not.toContain(a.id);
	});

	it('keeps the drop of loads under feeders that drop nothing', async () => {
		const { mdp, lp1, lp1_load } = await buildWyeTree();
		await patchNode(mdp.id, { length: 0 });
		await patchNode(lp1.id, { length: 0 });
		const rows = new Map((await getComputedVoltageDropsAsync()).map((row) => [row.id, row]));
		expect(rows.get(lp1.id)!.voltage_at_end_circuit).toBe(0);
		const load = rows.get(lp1_load.id)!;
		expect(load.voltage_per_segment).toBeGreaterThan(0);
		expect(load.voltage_at_end_circuit).toBe(load.voltage_per_segment);
	});

	it('undoing a move puts the phase pick back', async () => {
		const { root, mdp, a } = await buildWyeTree();
		await changePhaseAssignment(a.id, 'C');
		await updateNodeParentById(a.id, root);
		expect(getNode(a.id)!.phase_assignment).toBeUndefined();
		await undoEdit();
		expect(getNode(a.id)).toMatchObject({ parent_id: mdp.id, phase_assignment: 'C' });
	});

	it('a copy follows its new circuit number, not the original phase pick', async () => {
		const { mdp, a } = await buildWyeTree();
		await changePhaseAssignment(a.id, 'C');
		const {
			nodes: [copy]
		} = await copyAndAddNodesById(a.id, 1);
		expect(copy!.parent_id).toBe(mdp.id);
		expect(copy!.phase_assignment).toBeUndefined();
		expect(getNode(a.id)!.phase_assignment).toBe('C');
	});

	it('rebalances several circuits in one write', async () => {
		const { mdp, a, b, c } = await buildWyeTree();
		await changePhaseAssignments([
			[a.id, 'B'],
			[b.id, 'C'],
			[c.id, 'A']
		]);
		await settled();
		const phases = new Map(getComputedLoads(mdp.id).map((l) => [l.id, l.phase]));
		expect([phases.get(a.id), phases.get(b.id), phases.get(c.id)]).toEqual(['B', 'C', 'A']);
	});

	describe('voltage drop, PEC 2017 App. D Ex. D15 (k = 1.732 for three-phase)', () => {
		it('(a) 295 A over 15.2 m of 250 mm² in steel conduit → 1.428 V', async () => {
			const root = await wyeProject();
			const feeder = await add({
				parent_id: root,
				load_data: load(1, default_load_types.THREE_P_MOTOR__RATED_CURRENT, '295', 15.2)
			})!;
			// D15 uses √(R² + X²) of Table 10.1.1.9: 0.029 Ω and 0.048 Ω per 305 m.
			await overrideField({
				node_id: feeder.id,
				field_data: Math.hypot(0.029, 0.048),
				field_type: 'z'
			});
			const [drop] = await getComputedVoltageDropsAsync();
			expect(drop?.current).toBe(295);
			// D15 Eq. (1): 1.732 × 295 × √(0.029² + 0.048²) × 15.2 / 305 = 1.42797 V, "1.428 volt".
			expect(drop?.voltage_per_segment).toBe(1.428);
			expect(drop?.percent_voltage_drop).toBeCloseTo((drop!.voltage_per_segment / 400) * 100, 4);
		});

		it('(b) 20 A over 30.5 m of 5.5 mm² in steel conduit → 4.163 V', async () => {
			const root = await wyeProject();
			const motor = await add({
				parent_id: root,
				load_data: load(1, default_load_types.THREE_P_MOTOR__RATED_CURRENT, '20', 30.5)
			})!;
			await overrideField({
				node_id: motor.id,
				field_data: Math.hypot(1.2, 0.063),
				field_type: 'z'
			});
			const [drop] = await getComputedVoltageDropsAsync();
			// D15 Eq. (1): 1.732 × 20 × √(1.2² + 0.063²) × 30.5 / 305 = 4.162525 V, printed "4.163".
			expect(drop?.voltage_per_segment).toBe(4.1625);
		});

		it('carries the percent drop of a 400 V feeder into a 230 V branch', async () => {
			const { mdp, a } = await buildWyeTree();
			const drops = new Map((await getComputedVoltageDropsAsync()).map((d) => [d.id, d]));
			const feeder = drops.get(mdp.id)!;
			const branch = drops.get(a.id)!;
			expect(feeder.voltage_at_receiving_end).toBeCloseTo(400 - feeder.voltage_at_end_circuit, 10);
			// Branch end = feeder drop rescaled to 230 V + the branch's own 2·I·Z.
			expect(branch.voltage_at_end_circuit).toBeCloseTo(
				(feeder.voltage_at_end_circuit / 400) * 230 + branch.voltage_per_segment,
				4
			);
			expect(branch.percent_voltage_drop).toBeCloseTo(
				feeder.percent_voltage_drop + (branch.voltage_per_segment / 230) * 100,
				3
			);
		});
	});
});

function countNodes(): number {
	return getNodes().length;
}

describe('selective coordination, PEC 2017 7.0.6.3', () => {
	const panel = (name: string, circuit_number: number, system: GenericPhasePanelSchema['system']) =>
		({
			name,
			circuit_number,
			ambient_temperature: 30,
			length: 10,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			phase: default_phases.ONE_PHASE,
			system
		}) satisfies GenericPhasePanelSchema;
	const lighting = (circuit_number: number) =>
		({
			load_type: default_load_types.LIGHTING_LOAD,
			quantity: 1,
			varies: '2000',
			load_description: `Light ${circuit_number}`,
			continuous: false,
			circuit_number,
			length: 10,
			ambient_temperature: 30,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			config_preference: 'CUSTOM'
		}) as never;

	// root ─ MDP ─┬─ EP (emergency) ─┬─ Light 1
	//             │                  └─ Light 2
	//             └─ LP ─ Light 1
	it('pairs each emergency device with all supply-side devices, and keeps the documented selection', async () => {
		resetData();
		const created = await createProject('Coordination', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const mdp = await add({ parent_id: created!.root_node_id, panel_data: panel('MDP', 1, null) });
		const ep = await add({ parent_id: mdp.id, panel_data: panel('EP', 1, 'emergency') });
		const e1 = await add({ parent_id: ep.id, load_data: lighting(1) });
		await add({ parent_id: ep.id, load_data: lighting(2) });
		const lp = await add({ parent_id: mdp.id, panel_data: panel('LP', 2, null) });
		await add({ parent_id: lp.id, load_data: lighting(1) });

		const study = await getCoordinationAsync();
		expect(study.map((p) => [p.upstream.name, p.downstream.name, p.section])).toEqual([
			['MDP', 'EP', '7.0.6.3'],
			['EP', 'Light 1', '7.0.6.3'],
			['MDP', 'Light 1', '7.0.6.3'],
			['EP', 'Light 2', '7.0.6.3'],
			['MDP', 'Light 2', '7.0.6.3']
		]);
		expect(study.every((p) => p.status.kind === 'needs_documentation')).toBe(true);

		await patchNode(e1.id, { coordination_reference: 'Selectivity table, p. 12' });
		const documented = (await getCoordinationAsync()).filter((p) => p.downstream.id === e1.id);
		expect(documented.map((p) => p.status)).toEqual([
			{ kind: 'documented', reference: 'Selectivity table, p. 12' },
			{ kind: 'documented', reference: 'Selectivity table, p. 12' }
		]);

		// The form checks the stored value: a circuit removed meanwhile answers nothing.
		await removeNodesById([e1.id]);
		expect(await patchNode(e1.id, { coordination_reference: 'Late' })).toBeUndefined();

		// A normal panel again: nothing left to coordinate.
		await updateNode({ id: ep.id, parent_id: mdp.id, panel_data: panel('EP', 1, null) });
		expect(await getCoordinationAsync()).toEqual([]);
	});
});
