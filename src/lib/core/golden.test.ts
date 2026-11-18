/**
 * Golden outputs of heda's calculations on every project in `samples/`.
 *
 * Recorded from the TypeScript engine before the move to Rust
 * (`crates/heda-core`), so each step of the port has to reproduce exactly what
 * engineers saw before it. The samples go through the real open path
 * (unseal, migrate, open in the session) and the results come from the same
 * query functions the pages use, which read the Rust engine's answers.
 *
 * Each sample also runs as a variant that switches on what the samples leave
 * off: a short-circuit source (the utility and transformer of PEC 2017 App. D
 * Ex. D14), the dynamic adjustment factor, and phase overrides on 3P-Y
 * panels.
 *
 * A changed golden is a changed result: update one only on purpose
 * (`bunx vitest run src/lib/core/golden.test.ts -u`), with the reason in the
 * commit. The two large samples are stored as a hash plus row counts to keep
 * the repository small; regenerate the full JSON locally to see what moved.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { default_phases } from '#lib/constants.js';
import { decryptFilePayload } from '#lib/helpers/file/format.js';
import { loadCurrentProject } from '#lib/db/mutations/index.js';
import {
	getComputedLoads,
	getComputedShortCircuitsAsync,
	getComputedVoltageDropsAsync,
	getNodeById
} from '#lib/db/queries/index.js';
import { settled } from '#lib/db/index.js';
import { loadSnapshot } from '#lib/db/queries/snapshot.js';
import { engine } from '#lib/core/api.js';
import { circuitPhase } from '#lib/utils/computations/index.js';
import type { FileExport } from '#lib/types/main.js';
import {
	canonicalJson,
	HASHED,
	SAMPLE_PASSWORD,
	SAMPLES_DIR,
	samples,
	withEverythingOn
} from './golden-samples.js';

describe('calculation goldens', () => {
	it('covers every sample project', () => {
		expect(samples).toEqual([
			'harborview-residences',
			'maple-street-residence',
			'meridian-business-park',
			'meridian-office-building',
			'northpoint-cold-storage',
			'sunrise-apartment-7a'
		]);
	});

	for (const sample of samples) {
		for (const variant of [false, true]) {
			const name = variant ? `${sample}.variant` : sample;
			it(name, { timeout: 120_000 }, async () => {
				const raw = readFileSync(new URL(`${sample}.heda`, SAMPLES_DIR), 'utf8');
				const file_export = await decryptFilePayload<FileExport>(raw, SAMPLE_PASSWORD);
				await loadCurrentProject(variant ? withEverythingOn(file_export) : file_export);
				await settled();
				await expectGolden(name, HASHED.has(sample), canonicalJson(await collectOutputs()));
			});
		}
	}
});

async function expectGolden(name: string, hashed: boolean, golden: string) {
	if (hashed) {
		const outputs = JSON.parse(golden) as Awaited<ReturnType<typeof collectOutputs>>;
		await expect(
			canonicalJson({
				sha256: createHash('sha256').update(golden).digest('hex'),
				load_schedules: Object.keys(outputs.load_schedules).length,
				node_results: Object.keys(outputs.node_results).length,
				voltage_drops: outputs.voltage_drops.length,
				short_circuits: outputs.short_circuits.length,
				balanced_phases: Object.keys(outputs.balanced_phases).length
			}) + '\n'
		).toMatchFileSnapshot(`./golden/${name}.hash.json`);
	} else {
		await expect(golden + '\n').toMatchFileSnapshot(`./golden/${name}.json`);
	}
}

/** Everything a page shows that the engine computes, keyed by node id. */
async function collectOutputs() {
	const { nodes, root } = loadSnapshot();
	const parents = nodes.filter((node) => node.node_type === 'root' || node.node_type === 'panel');
	const load_schedules: Record<string, unknown> = {};
	const balanced_phases: Record<string, unknown> = {};
	for (const parent of parents) {
		const rows = getComputedLoads(parent.id);
		load_schedules[parent.id] = rows;
		if (parent.panel_data?.phase === default_phases.THREE_PHASE_WYE) {
			// What the "Balance phases" menu would assign on this panel.
			balanced_phases[parent.id] = Object.fromEntries(
				await engine<[string, string][]>('balanced_phases', {
					circuits: rows.map((row) => ({ id: row.id, va: row.va, phase: circuitPhase(row) }))
				})
			);
		}
	}
	const node_results = Object.fromEntries(nodes.map((node) => [node.id, getNodeById(node.id)]));
	return {
		root_id: root?.id ?? null,
		load_schedules,
		node_results,
		voltage_drops: await getComputedVoltageDropsAsync(),
		short_circuits: await getComputedShortCircuitsAsync(),
		balanced_phases
	};
}
