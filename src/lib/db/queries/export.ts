import { settled } from '../index.js';
import { loadRowOf } from './loads.js';
import { loadSnapshot } from './snapshot.js';
import { getComputedVoltageDropsAsync } from './voltage-drops.js';
import type { ExcelExportType, ExportInputs } from '#lib/types/misc.js';

/**
 * What an Excel export writes, read from the engine here on the page: the worker
 * that builds the workbook cannot reach the engine, so it only lays these out.
 */
export async function getExportInputs(type: ExcelExportType): Promise<ExportInputs> {
	const voltage_drops = type === 'VOLTAGE_DROP' ? await getComputedVoltageDropsAsync() : [];
	await settled();
	const { nodes } = loadSnapshot();
	const rows = Object.fromEntries(
		nodes.flatMap((node) => {
			const row = loadRowOf(node);
			return row ? [[node.id, row] as const] : [];
		})
	);
	return { nodes, rows, voltage_drops };
}
