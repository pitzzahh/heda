import { beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { default_phases } from '#lib/constants.js';
import { initializeDatabase } from '#lib/db/index.js';
import { createProject, resetData } from '#lib/db/mutations/index.js';
import { getExportInputs } from '#lib/db/queries/export.js';
import { generateWorkbook } from './generate.js';

beforeAll(async () => {
	await initializeDatabase();
});

describe('generateWorkbook', () => {
	it.each(['LOAD_SCHEDULE', 'VOLTAGE_DROP'] as const)(
		'returns a %s workbook the worker can transfer to the page',
		async (type) => {
			resetData();
			await createProject('Transfer', {
				distribution_unit: 'Transformer',
				phase: default_phases.ONE_PHASE
			});
			const inputs = await getExportInputs(type);
			const root = inputs.nodes.find((node) => node.node_type === 'root')!;

			const { buffer } = await generateWorkbook({
				type,
				node_id: root.id,
				highest_unit: root.highest_unit_form,
				...inputs
			});

			// The worker posts it with `[buffer]` as the transfer list; a Uint8Array there
			// throws "DataCloneError: The object can not be cloned".
			expect(buffer).toBeInstanceOf(ArrayBuffer);
			const received = structuredClone(buffer, { transfer: [buffer] });
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(received);
			expect(workbook.worksheets.length).toBeGreaterThan(0);
		}
	);
});
