/**
 * The Rust engine (`crates/heda-core`, through its WASM build) must reproduce the
 * TypeScript engine's goldens (`./golden/`, see `golden.test.ts`) exactly, on
 * every sample and variant.
 *
 * Rows are rebuilt the way the app will show them: the stored node, then the
 * engine's fields on top.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { default_phases } from '#lib/constants.js';
import { decryptFilePayload } from '#lib/helpers/file/format.js';
import { loadCurrentProject } from '#lib/db/mutations/index.js';
import { loadSnapshot } from '#lib/db/queries/snapshot.js';
import {
	canonicalJson,
	HASHED,
	SAMPLE_PASSWORD,
	SAMPLES_DIR,
	samples,
	withEverythingOn
} from './golden-samples.js';
import { dispatch_json } from './pkg/heda_core.js';
import type { FileExport } from '#lib/types/main.js';
import type { Node } from '#lib/types/db.js';

type Row = Record<string, unknown> & { id: string };

function call<T>(command: string, args: unknown = {}): T {
	return JSON.parse(dispatch_json(command, JSON.stringify(args))) as T;
}

describe('Rust engine reproduces the TypeScript goldens', () => {
	for (const sample of samples) {
		for (const variant of [false, true]) {
			const name = variant ? `${sample}.variant` : sample;
			it(name, { timeout: 120_000 }, async () => {
				const raw = readFileSync(new URL(`${sample}.heda`, SAMPLES_DIR), 'utf8');
				const file_export = await decryptFilePayload<FileExport>(raw, SAMPLE_PASSWORD);
				const opened = variant ? withEverythingOn(file_export) : file_export;
				// The session store applies the open path's migrations and defaults; the
				// engine gets exactly the nodes the app stores.
				await loadCurrentProject(opened);
				const { nodes } = loadSnapshot();
				call('open', { nodes, settings: opened.project.settings });
				const golden = canonicalJson(collectOutputs(nodes));
				const expected = readFileSync(
					new URL(`./golden/${name}${HASHED.has(sample) ? '.hash' : ''}.json`, import.meta.url),
					'utf8'
				);
				if (HASHED.has(sample)) {
					const outputs = JSON.parse(golden);
					expect(
						canonicalJson({
							sha256: createHash('sha256').update(golden).digest('hex'),
							load_schedules: Object.keys(outputs.load_schedules).length,
							node_results: Object.keys(outputs.node_results).length,
							voltage_drops: outputs.voltage_drops.length,
							short_circuits: outputs.short_circuits.length,
							balanced_phases: Object.keys(outputs.balanced_phases).length
						}) + '\n'
					).toBe(expected);
				} else {
					expect(golden + '\n').toBe(expected);
				}
			});
		}
	}
});

function collectOutputs(nodes: Node[]) {
	const node_by_id = new Map(nodes.map((node) => [node.id, node]));
	const root = nodes.find((node) => node.node_type === 'root');
	const load_by_id = new Map<string, Row>();
	const load_schedules: Record<string, unknown> = {};
	const balanced_phases: Record<string, unknown> = {};
	for (const parent of nodes.filter((n) => n.node_type === 'root' || n.node_type === 'panel')) {
		const rows = call<Row[]>('load_schedule', { parent_id: parent.id });
		for (const row of rows) load_by_id.set(row.id, row);
		load_schedules[parent.id] = rows.map((row) => ({ ...node_by_id.get(row.id), ...row }));
		if (parent.panel_data?.phase === default_phases.THREE_PHASE_WYE) {
			balanced_phases[parent.id] = Object.fromEntries(
				call<[string, string][]>('balanced_phases', {
					circuits: rows.map((row) => ({ id: row.id, va: row.va, phase: row.phase }))
				})
			);
		}
	}
	const node_results = Object.fromEntries(
		nodes.map((node) => [node.id, { ...node, ...call<Row>('node_result', { id: node.id }) }])
	);
	const full = (row: Row) => ({ ...node_by_id.get(row.id), ...load_by_id.get(row.id), ...row });
	return {
		root_id: root?.id ?? null,
		load_schedules,
		node_results,
		// `length` is the run's length, or undefined without one, whatever the node stored.
		voltage_drops: call<Row[]>('voltage_drops').map((row) => ({
			...full(row),
			length: row.length
		})),
		short_circuits: call<Row[]>('short_circuits').map(full),
		balanced_phases
	};
}
