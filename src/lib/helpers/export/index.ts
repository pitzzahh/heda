import { getOrdinalSuffix } from "@/utils/format";
import type { Node } from '@/db/schema';
import { getComputedLoads, getNodeById } from "@/db/queries";
import { toast } from "svelte-sonner";
import ExcelJS from 'exceljs';

export async function processOnePhaseExcelPanelBoardSchedule(
  workbook: ExcelJS.Workbook,
  node_id: string,
  highest_unit?: Node['highest_unit_form'],
  parent?: Node,
  depth: number = 1,
): Promise<{
  valid: boolean;
  message?: string;
  is_system_error?: boolean;
  description?: string;
}> {
  const children = await getComputedLoads(node_id);

  if (
    depth === 1 &&
    (children.length === 0 || children.every((child) => child.node_type !== 'panel'))
  ) {
    toast.warning('No panels found', { position: 'bottom-center' });
    return {
      valid: false,
      message: 'No panels found',
      description: 'Cannot proceed with the export.'
    };
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.node_type === 'root') {
      await processOnePhaseExcelPanelBoardSchedule(workbook, child.id, highest_unit, child, depth + 1);
    } else if (child.node_type === 'panel') {
      const panel_name = child.panel_data?.name ?? 'Unknown Panel';
      const panel_level = getOrdinalSuffix(depth + 1);

      let worksheet = workbook.getWorksheet(panel_level);
      if (!worksheet) {
        worksheet = workbook.addWorksheet(panel_level);
      }

      const startRow = worksheet.rowCount > 0 ? worksheet.rowCount + 1 : 1;

      const description_label_column_position_data = [
        { column: `A${startRow}`, value: 'DESCRIPTION' },
        { column: `A${startRow + 1}`, value: 'SUPPLY' },
        { column: `A${startRow + 2}`, value: 'FROM' },
        { column: `A${startRow + 3}`, value: 'NAME' }
      ];

      description_label_column_position_data.forEach(
        ({ column, value }) => (worksheet.getCell(column).value = value)
      );

      worksheet.getCell(`B${startRow}`).value = `: PANELBOARD SCHEDULE`;
      worksheet.getCell(`B${startRow + 1}`).value =
        `: ${highest_unit?.phase} + E, ${230}V, ${60}Hz`;
      worksheet.getCell(`B${startRow + 2}`).value =
        `: ${parent?.panel_data?.name?.toUpperCase() ?? 'Transformer'}`;
      worksheet.getCell(`B${startRow + 3}`).value = `: ${panel_name}`;

      description_label_column_position_data
        .map((e) => e.column)
        .forEach((cell) => {
          worksheet.getCell(cell).font = { bold: true };
        });

      type Header = { text: string; cols: number; subText?: string };

      const table_headers: Header[] = [
        { text: ' ', cols: 1, subText: 'CKT NO.' },
        { text: ' ', cols: 1, subText: 'LOAD DESCRIPTION' },
        { text: ' ', cols: 1, subText: 'VOLTAGE (V)' },
        { text: ' ', cols: 1, subText: 'APPARENT POWER (VA)' },
        { text: ' ', cols: 1, subText: 'CURRENT (A)' },
        { text: 'CIRCUIT BREAKER', cols: 4 },
        { text: 'CONDUCTOR', cols: 4 },
        { text: 'EGC', cols: 2 },
        { text: 'CONDUIT', cols: 2 }
      ];

      let current_header_column = 1;
      table_headers.forEach((header: Header) => {
        const cell = worksheet.getCell(startRow + 4, current_header_column);
        if (header.subText) {
          cell.value = header.text;
          cell.font = { bold: true };
          cell.alignment = { horizontal: 'center' };
          cell.border = { top: { style: 'thin' } };

          const subCell = worksheet.getCell(startRow + 5, current_header_column);
          subCell.value = header.subText;
          subCell.font = { bold: true };
          subCell.alignment = { horizontal: 'center' };
          subCell.border = { bottom: { style: 'thick' } };
        } else if (header.cols === 1) {
          worksheet.mergeCells(
            startRow + 4,
            current_header_column,
            startRow + 5,
            current_header_column
          );
          cell.value = header.text;
          cell.font = { bold: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { bottom: { style: 'thick' }, top: { style: 'thin' } };
        } else {
          worksheet.mergeCells(
            startRow + 4,
            current_header_column,
            startRow + 4,
            current_header_column + header.cols - 1
          );
          cell.value = header.text;
          cell.font = { bold: true };
          cell.alignment = { horizontal: 'center' };
          cell.border = { top: { style: 'thin' } };

          const subHeadersMap: Record<string, string[]> = {
            'CIRCUIT BREAKER': ['AT', 'AF', 'Pole', 'kAIC'],
            CONDUCTOR: ['Sets', 'Qty', 'Size\n(mm2)', 'Insulation'],
            EGC: ['Size', 'Insulation'],
            CONDUIT: ['Size', 'Insulation']
          };

          if (subHeadersMap[header.text]) {
            subHeadersMap[header.text].forEach((text, i) => {
              const subCell = worksheet.getCell(startRow + 5, current_header_column + i);
              subCell.value = text;
              subCell.font = { bold: true };
              subCell.alignment = { horizontal: 'center' };
              subCell.border = { bottom: { style: 'thick' } };
            });
          }
        }
        current_header_column += header.cols;
      });

      worksheet.columns = [
        { width: 15 },
        { width: 30 },
        { width: 15 },
        { width: 30 },
        { width: 15 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 10 },
        { width: 15 }
      ];

      const loads = await getComputedLoads(child.id);
      let current_load_row = startRow + 6;

      for (const load of loads) {
        const loadCells = [
          { column: 'A', value: load.circuit_number },
          { column: 'B', value: load.load_description },
          { column: 'C', value: load.voltage },
          { column: 'D', value: load.va },
          { column: 'E', value: load.current },
          { column: 'F', value: load.at },
          { column: 'G', value: load.ampere_frames },
          { column: 'H', value: load.pole },
          { column: 'I', value: load.kaic },
          { column: 'J', value: load.conductor_sets },
          { column: 'K', value: load.conductor_qty },
          { column: 'L', value: load.conductor_size },
          { column: 'M', value: load.conductor_insulation },
          { column: 'N', value: load.egc_size },
          { column: 'O', value: load.egc_insulation },
          { column: 'P', value: load.conduit_size },
          { column: 'Q', value: load.conduit_type }
        ];

        loadCells.forEach(({ column, value }) => {
          const cell = worksheet.getCell(`${column}${current_load_row}`);
          cell.value = value;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { bottom: { style: 'thin' } };
        });
        current_load_row++;
      }

      const node_data_summary = await getNodeById(child.id);

      if (!node_data_summary) {
        return {
          valid: false,
          message: 'Failed to get MAIN data',
          is_system_error: true
        };
      }

      const main_columns = [
        { column: 'A', value: 'TOTAL' },
        { column: 'B', value: 'MAIN' },
        { column: 'C', value: node_data_summary.voltage.toString() },
        { column: 'D', value: node_data_summary.va.toString() },
        { column: 'E', value: node_data_summary.current.toString() },
        { column: 'F', value: node_data_summary.at.toString() },
        { column: 'G', value: node_data_summary.ampere_frames.toString() },
        { column: 'H', value: node_data_summary.pole ?? 'N/A' },
        { column: 'I', value: node_data_summary.kaic ?? 'N/A' },
        { column: 'J', value: node_data_summary.conductor_sets?.toString() ?? 'N/A' },
        { column: 'K', value: node_data_summary.conductor_qty?.toString() ?? 'N/A' },
        { column: 'L', value: node_data_summary.conductor_size.toString() },
        { column: 'M', value: node_data_summary.conductor_insulation ?? 'N/A' },
        { column: 'N', value: node_data_summary.egc_size.toString() },
        { column: 'O', value: node_data_summary.egc_insulation ?? 'N/A' },
        { column: 'P', value: node_data_summary.conduit_size.toString() },
        { column: 'Q', value: node_data_summary.conduit_type ?? 'N/A' }
      ];

      main_columns.forEach(({ column, value }) => {
        const cell = worksheet.getCell(`${column}${current_load_row}`);
        cell.value = value;
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thick' } };
      });

      // Add empty row after main columns
      const emptyRow = worksheet.getRow(current_load_row + 2);
      emptyRow.height = 15; // Optional: set specific height for consistency

      await processOnePhaseExcelPanelBoardSchedule(workbook, child.id, highest_unit, child, depth + 1);
    }
  }

  return { valid: true };
}