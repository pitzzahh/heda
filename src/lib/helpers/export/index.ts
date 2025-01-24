import { getOrdinalSuffix } from "@/utils/format";
import type { Node } from '@/db/schema';
import { getComputedLoads, getComputedVoltageDrops, getNodeById, getNodeDepth } from "@/db/queries";
import { toast } from "svelte-sonner";
import ExcelJS from 'exceljs';
import type { ExcelExportType } from "@/types/misc";
import { convertToNormalText } from "@/utils/text";

type ExportProcessResult = {
  valid: boolean;
  message?: string;
  is_system_error?: boolean;
  description?: string;
}

type Header = { text: string; cols: number; subText?: string, sub_cols?: string[] };

export async function processOnePhaseExcelPanelBoardSchedule(
  workbook: ExcelJS.Workbook,
  node_id: string,
  highest_unit?: Node['highest_unit_form'],
): Promise<ExportProcessResult> {
  const current_node = await getNodeById(node_id);
  const children = await getComputedLoads(node_id);

  if (!current_node) {
    return {
      valid: false,
      message: 'Node not found',
      is_system_error: true
    };
  }

  // Use the existing getNodeDepth2 function to calculate the depth
  const actualDepth = await getNodeDepth(node_id);
  const panel_level = getOrdinalSuffix(actualDepth);
  const parent_node = current_node.parent_id ? await getNodeById(current_node.parent_id) : undefined;
  const panel_name = current_node?.panel_data?.name ?? current_node?.highest_unit_form?.distribution_unit ?? 'Unknown Panel';
  const from_supply_name = current_node?.node_type === 'root' ? '--' : parent_node?.panel_data?.name ?? 'Transformer'

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
    `: ${from_supply_name}`;
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
      cell.border = { bottom: { style: 'thin' }, top: { style: 'thin' } };
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

  const loads = await getComputedLoads(node_id);
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

  const main_columns = [
    { column: 'A', value: 'TOTAL' },
    { column: 'B', value: 'MAIN' },
    { column: 'C', value: current_node.voltage.toString() },
    { column: 'D', value: current_node.va.toString() },
    { column: 'E', value: current_node.current.toString() },
    { column: 'F', value: current_node.at.toString() },
    { column: 'G', value: current_node.ampere_frames.toString() },
    { column: 'H', value: current_node.pole ?? 'N/A' },
    { column: 'I', value: current_node.kaic ?? 'N/A' },
    { column: 'J', value: current_node.conductor_sets?.toString() ?? 'N/A' },
    { column: 'K', value: current_node.conductor_qty?.toString() ?? 'N/A' },
    { column: 'L', value: current_node.conductor_size.toString() },
    { column: 'M', value: current_node.conductor_insulation ?? 'N/A' },
    { column: 'N', value: current_node.egc_size.toString() },
    { column: 'O', value: current_node.egc_insulation ?? 'N/A' },
    { column: 'P', value: current_node.conduit_size.toString() },
    { column: 'Q', value: current_node.conduit_type ?? 'N/A' }
  ];

  main_columns.forEach(({ column, value }) => {
    const cell = worksheet.getCell(`${column}${current_load_row}`);
    cell.value = value;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thick' } };
  });

  const emptyRow = worksheet.getRow(current_load_row + 2);
  emptyRow.height = 15;

  // Process children
  for (const child of children) {
    if (child.node_type === 'root' || child.node_type === 'panel') {
      await processOnePhaseExcelPanelBoardSchedule(
        workbook,
        child.id,
        highest_unit
      );
    }
  }

  for (let i = 0; i < worksheet.columns.length; i += 1) {
    let dataMax = 0;
    const column = worksheet.columns[i];
    const headerLength = String(column.values?.[1] ?? '').length;
    for (let j = 1; j < (column.values?.length ?? 0); j += 1) {
      const columnLength = String(column.values?.[j] ?? '').length;
      if (columnLength > dataMax) {
        dataMax = columnLength;
      }
    }
    column.width = Math.max(dataMax, headerLength, 10);
  }

  return { valid: true };
}

export async function processOnePhaseVoltageDrop(
  workbook: ExcelJS.Workbook,
  node_id: string
): Promise<ExportProcessResult> {
  let worksheet = workbook.getWorksheet();

  if (!worksheet) {
    worksheet = workbook.addWorksheet();
  }

  const startRow = worksheet.rowCount > 0 ? worksheet.rowCount + 1 : 1;

  const table_headers: Header[] = [
    { text: 'From NODE', cols: 1 },
    { text: 'To NODE', cols: 1 },
    { text: 'CABLE', cols: 3, sub_cols: ['Sets', 'Qty', 'Size (mm2)'] },
    { text: 'Z', cols: 1, sub_cols: ['(Ω/305m)'] },
    { text: 'LENGTH', cols: 1, sub_cols: ['(m)'] },
    { text: 'CURRENT', cols: 1, sub_cols: ['(A)'] },
    { text: 'Actual Z', cols: 1, sub_cols: ['(Ω)'] },
    { text: 'VOLTAGE DROP (V)', cols: 2, sub_cols: ['Per Segment', 'At End Circuit'] },
    { text: 'VOLTAGE AT RECEIVING END (V)', cols: 1 },
    { text: 'PERCENTAGE VOLTAGE DROP (%)', cols: 1 },
  ];

  let current_header_column = 1;

  table_headers.forEach((header: Header) => {
    const cell = worksheet.getCell(startRow + 4, current_header_column);
    cell.value = header.text;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.border = { top: { style: 'thin' } };

    if (header.sub_cols) {
      worksheet.mergeCells(
        startRow + 4,
        current_header_column,
        startRow + 4,
        current_header_column + header.cols - 1
      );
      header.sub_cols.forEach((subText, i) => {
        const subCell = worksheet.getCell(startRow + 5, current_header_column + i);
        subCell.value = subText;
        subCell.font = { bold: true };
        subCell.alignment = { horizontal: 'center' };
        subCell.border = { bottom: { style: 'thick' } };
      });
    } else {
      worksheet.mergeCells(
        startRow + 4,
        current_header_column,
        startRow + 5,
        current_header_column
      );
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thick' }, top: { style: 'thin' } };
    }
    current_header_column += header.cols;
  });

  const voltage_drops = await getComputedVoltageDrops();
  let current_load_row = startRow + 6;

  for (const voltage_drop_node of voltage_drops) {
    const loadCells = [
      { column: 'A', value: voltage_drop_node.from_node_name },
      { column: 'B', value: voltage_drop_node.to_node_name },
      { column: 'C', value: voltage_drop_node.voltage },
      { column: 'D', value: voltage_drop_node.va },
      { column: 'E', value: voltage_drop_node.current },
      { column: 'F', value: voltage_drop_node.at },
      { column: 'G', value: voltage_drop_node.ampere_frames },
      { column: 'H', value: voltage_drop_node.pole },
      { column: 'I', value: voltage_drop_node.kaic },
      { column: 'J', value: voltage_drop_node.conductor_sets },
      { column: 'K', value: voltage_drop_node.conductor_qty },
      { column: 'L', value: voltage_drop_node.conductor_size },
      { column: 'M', value: voltage_drop_node.conductor_insulation },
      { column: 'N', value: voltage_drop_node.egc_size },
      { column: 'O', value: voltage_drop_node.egc_insulation },
      { column: 'P', value: voltage_drop_node.conduit_size },
      { column: 'Q', value: voltage_drop_node.conduit_type }
    ];

    loadCells.forEach(({ column, value }) => {
      const cell = worksheet.getCell(`${column}${current_load_row}`);
      cell.value = value;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin' } };
    });
    current_load_row++;
  }

  for (let i = 0; i < worksheet.columns.length; i += 1) {
    let dataMax = 0;
    const column = worksheet.columns[i];
    for (let j = 1; j < (column.values?.length ?? 0); j += 1) {
      const columnLength = String(column.values?.[j] ?? '').length;
      if (columnLength > dataMax) {
        dataMax = columnLength;
      }
    }
    column.width = dataMax < 10 ? 10 : dataMax;
  }

  return { valid: true };
}

export async function exportToExcel(
  type: ExcelExportType,
  node_id: string,
  highest_unit?: Node['highest_unit_form'],
  file_name?: string,
  idle_callaback?: () => void,
  loading_calback?: () => void
) {
  if (!highest_unit) {
    return toast.warning('No project found', {
      description: 'Cannot proceed with the export.',
      position: 'bottom-center'
    });
  }

  if (!highest_unit) {
    return toast.warning('No highest unit found, nothing to export', {
      description: 'This is a system error and should not be here, the error has been logged.',
      position: 'bottom-center'
    });
  }
  const _file_name = file_name ?? 'Exported Panelboard Schedule';
  loading_calback && loading_calback();
  toast.info(`Exporting to Excel... ${_file_name}.xlsx`, {
    description: 'Please wait, this should last very long.',
    position: 'bottom-center'
  });

  const workbook = new ExcelJS.Workbook();
  workbook.title = `Exported ${file_name} ${convertToNormalText(type, true)}`;
  workbook.creator = 'HEDA(Desktop App)';

  try {
    switch (highest_unit?.phase) {
      case '1P':
        workbook.subject = `1P ${convertToNormalText(type, true)}`;
        workbook.category = ['1P', `${convertToNormalText(type, true)}`, 'Export'].join(',');
        workbook.description = 'Load schedule for 1 phase load schedule';
        switch (type) {
          case 'LOAD_SCHEDULE':
            const load_schedule_process_result = await processOnePhaseExcelPanelBoardSchedule(
              workbook,
              node_id,
              highest_unit
            );
            if (!load_schedule_process_result.valid) {
              idle_callaback && idle_callaback();
              console.error(`Error while processing 1P load schedule: ${JSON.stringify(load_schedule_process_result)}`);
              return toast.warning(load_schedule_process_result.message ?? 'Something went wrong while exporting', {
                description: load_schedule_process_result?.is_system_error
                  ? 'This is a system error and should not be here, the error has been logged.'
                  : (load_schedule_process_result?.description ?? undefined),
                position: 'bottom-center'
              });
            }
            break;
          case 'VOLTAGE_DROP':
            const voltage_drop_process_result = await processOnePhaseVoltageDrop(
              workbook,
              node_id
            )
            if (!voltage_drop_process_result.valid) {
              idle_callaback && idle_callaback();
              console.error(`Error while processing 1P voltage drop: ${JSON.stringify(voltage_drop_process_result)}`);
              return toast.warning(voltage_drop_process_result.message ?? 'Something went wrong while exporting', {
                description: voltage_drop_process_result?.is_system_error
                  ? 'This is a system error and should not be here, the error has been logged.'
                  : (voltage_drop_process_result?.description ?? undefined),
                position: 'bottom-center'
              });
            }
            break;
        }
        break;
      case '3P':
        workbook.subject = '3P Load Schedule';
        workbook.category = ['3P', 'Load Schedule', 'Export'].join(',');
        workbook.description = 'Load schedule for 3 phase load schedule';
        return toast.warning('This feature is still under development', {
          description: 'Three phase load schedule is not yet supported',
          position: 'bottom-center'
        });
      default:
        idle_callaback && idle_callaback()
        workbook.subject = 'Unknown Load Schedule';
        return toast.warning('Something went wrong while exporting', {
          description:
            'This is a system error and should not be here, the error has been logged.',
          position: 'bottom-center'
        });
    }
  } catch (e) {
    idle_callaback && idle_callaback()
    return toast.warning(`Something went wrong while exporting:: ${e?.toString()}`, {
      description: 'This is a system error and should not be here, the error has been logged.',
      position: 'bottom-center'
    });
  }

  // Write the workbook and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);

  // Create a link and download the file
  const link = document.createElement('a');
  link.href = url;
  link.download = `${workbook.title}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Free resources
  URL.revokeObjectURL(url);
  toast.success('Export finished successfully.', {
    description: 'The file has been downloaded successfully',
    position: 'bottom-center'
  });
  idle_callaback && idle_callaback()
}