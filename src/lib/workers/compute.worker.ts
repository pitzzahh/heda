import { computeVoltageDropsFromNodes } from '#lib/db/queries/voltage-drop-core.js';
import type { ExcelExportType } from '#lib/types/misc/index.js';

self.onmessage = async (event: MessageEvent) => {
	const { id, type } = event.data ?? {};
	try {
		if (type === 'voltage-drops') {
			const { nodes, is_dynamic } = event.data;
			const result = computeVoltageDropsFromNodes(nodes, Boolean(is_dynamic));
			self.postMessage({ id, result });
			return;
		}

		if (type === 'export') {
			const { payload } = event.data;
			// Dynamically imported so voltage computes never bundle the workbook
			// generator (and its database imports) into the worker startup.
			const { generateWorkbook } = await import('#lib/helpers/export/generate.js');
			const generated = await generateWorkbook({
				type: payload.type as ExcelExportType,
				node_id: payload.node_id,
				highest_unit: payload.highest_unit,
				file_name: payload.file_name,
				nodes: payload.nodes,
				is_dynamic: Boolean(payload.is_dynamic)
			});
			(
				self as unknown as {
					postMessage: (message: unknown, transfer?: Transferable[]) => void;
				}
			).postMessage({ id, result: generated }, [generated.buffer]);
			return;
		}

		self.postMessage({ id, error: `Unknown worker task: ${String(type)}` });
	} catch (error) {
		self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
	}
};
