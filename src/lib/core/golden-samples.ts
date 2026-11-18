/** The sample projects the calculation goldens run on (`golden.test.ts`, `rust-parity.test.ts`). */
import { readdirSync } from 'node:fs';
import { default_phases } from '#lib/constants.js';
import type { FileExport } from '#lib/types/main.js';

export const SAMPLES_DIR = new URL('../../../samples/', import.meta.url);
export const SAMPLE_PASSWORD = 'heda-sample-2026'; // published in samples/README.md
export const HASHED = new Set(['harborview-residences', 'meridian-business-park']);

export const samples = readdirSync(SAMPLES_DIR)
	.filter((file) => file.endsWith('.heda') && !file.endsWith('-device.heda'))
	.map((file) => file.replace(/\.heda$/, ''))
	.sort();

/**
 * The sample with a fault source (PEC 2017 App. D Ex. D14: 1 000 MVA utility,
 * 300 kVA at 5 %) and an explicit phase on every fourth circuit of each 3P-Y panel.
 */
export function withEverythingOn(file_export: FileExport): FileExport {
	const wye_panels = new Set(
		file_export.nodes
			.filter((node) => node.panel_data?.phase === default_phases.THREE_PHASE_WYE)
			.map((node) => node.id)
	);
	const phases = ['A', 'B', 'C'] as const;
	return {
		project: file_export.project,
		nodes: file_export.nodes.map((node) => {
			if (node.node_type === 'root') {
				return {
					...node,
					highest_unit_form: {
						...node.highest_unit_form,
						utility_sc_kva: 1_000_000,
						transformer_kva: 300,
						transformer_z_percent: 5
					}
				} as typeof node;
			}
			const circuit = node.circuit_number ?? 0;
			if (wye_panels.has(node.parent_id ?? '') && circuit % 4 === 0) {
				return { ...node, phase_assignment: phases[circuit % 3] };
			}
			return node;
		})
	};
}

/**
 * JSON with object keys sorted, so a golden depends on values only: the Rust
 * engine builds rows in its own field order.
 */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(value, (_key, item: unknown) =>
		item && typeof item === 'object' && !Array.isArray(item)
			? Object.fromEntries(
					Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
						a < b ? -1 : a > b ? 1 : 0
					)
				)
			: item
	);
}
