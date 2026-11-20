//! The Excel exports: a panel's schedule of loads with every panel below it (one sheet
//! per depth: "1st", "2nd", …), and the voltage drop table. The sheets, cells and styles
//! are the ones the app's ExcelJS export wrote; they are built here from the session in
//! one pass, then written with rust_xlsxwriter.
//!
//! A cell keeps the type the app gave it: engine values are numbers, and a node's stored
//! fields are written as stored (a text "2" stays text).

use crate::graph::Graph;
use crate::js;
use crate::load_schedule::{load_row, LoadRow};
use crate::model::{phases, Node};
use crate::phases::{supply_phase_of, ALL_PHASES, PAIRS, PHASES};
use crate::riser::phase_label;
use crate::sizing::{Conduit, Egc};
use crate::voltage_drop::VoltageDropRow;
use rust_xlsxwriter::{DocProperties, Format, FormatAlign, FormatBorder, Workbook};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};

const CREATOR: &str = "HEDA(Desktop App)";
/// Narrowest column, in characters.
const MIN_WIDTH: usize = 10;

/// What to export, as the app names it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Kind {
    LoadSchedule,
    VoltageDrop,
}

impl Kind {
    fn label(self) -> &'static str {
        match self {
            Kind::LoadSchedule => "Load schedule",
            Kind::VoltageDrop => "Voltage drop",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Cell {
    Empty,
    Number(f64),
    Text(String),
    Bool(bool),
}

impl Cell {
    fn text(text: impl Into<String>) -> Self {
        Cell::Text(text.into())
    }

    /// An engine number as the app received it: JSON has no NaN or infinity, so those
    /// arrived as null, an empty cell.
    fn num(value: f64) -> Self {
        if value.is_finite() {
            Cell::Number(value)
        } else {
            Cell::Empty
        }
    }

    /// A node's stored field, as stored.
    fn doc(value: Option<&Value>) -> Self {
        match value {
            Some(Value::Number(n)) => n.as_f64().map_or(Cell::Empty, Cell::Number),
            Some(Value::String(text)) => Cell::Text(text.clone()),
            Some(Value::Bool(b)) => Cell::Bool(*b),
            _ => Cell::Empty,
        }
    }

    /// `String(value).length`, what the column widths are fitted to (UTF-16 units).
    fn width(&self) -> usize {
        match self {
            Cell::Empty => 0,
            Cell::Number(v) => js::number_to_string(*v).len(),
            Cell::Text(text) => text.encode_utf16().count(),
            Cell::Bool(b) => b.to_string().len(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Style {
    /// No format: the values beside the schedule's labels.
    Plain,
    /// DESCRIPTION, SUPPLY, FROM, NAME.
    Label,
    /// A header over its columns' own headers.
    Group,
    /// A header over both header rows (no column headers of its own).
    Tall,
    /// A column's own header, under its group.
    Sub,
    Body,
    Total,
}

impl Style {
    fn format(self) -> Format {
        let center = || Format::new().set_bold().set_align(FormatAlign::Center);
        let body = || {
            Format::new()
                .set_align(FormatAlign::Center)
                .set_align(FormatAlign::VerticalCenter)
        };
        match self {
            Style::Plain => Format::new(),
            Style::Label => Format::new().set_bold(),
            Style::Group => center().set_border_top(FormatBorder::Thin),
            Style::Tall => center()
                .set_align(FormatAlign::VerticalCenter)
                .set_border_top(FormatBorder::Thin)
                .set_border_bottom(FormatBorder::Thick),
            Style::Sub => center().set_border_bottom(FormatBorder::Thick),
            Style::Body => body().set_border_bottom(FormatBorder::Thin),
            Style::Total => body()
                .set_bold()
                .set_border_top(FormatBorder::Thin)
                .set_border_bottom(FormatBorder::Thick),
        }
    }
}

/// One worksheet, zero-based rows and columns.
#[derive(Debug, Default)]
pub struct Sheet {
    pub name: String,
    pub cells: Vec<(u32, u16, Cell, Style)>,
    /// First row, first column, last row, last column.
    pub merges: Vec<(u32, u16, u32, u16)>,
    /// Rows used so far: the next schedule starts here.
    rows: u32,
}

impl Sheet {
    fn new(name: &str) -> Self {
        Sheet {
            name: name.into(),
            ..Sheet::default()
        }
    }

    fn put(&mut self, row: u32, col: u16, cell: Cell, style: Style) {
        self.rows = self.rows.max(row + 1);
        self.cells.push((row, col, cell, style));
    }

    fn put_row(&mut self, row: u32, cells: Vec<Cell>, style: Style) {
        for (col, cell) in cells.into_iter().enumerate() {
            self.put(row, col as u16, cell, style);
        }
    }

    /// Two header rows at `row`: each group over its columns' headers, or over both rows.
    fn headers(&mut self, row: u32, headers: &[Header]) {
        let mut col = 0u16;
        for header in headers {
            let text = Cell::text(header.text);
            if header.subs.is_empty() {
                self.merges.push((row, col, row + 1, col));
                self.put(row, col, text, Style::Tall);
                col += 1;
                continue;
            }
            let last = col + header.subs.len() as u16 - 1;
            if last > col {
                self.merges.push((row, col, row, last));
            }
            self.put(row, col, text, Style::Group);
            for (i, sub) in header.subs.iter().enumerate() {
                self.put(row + 1, col + i as u16, Cell::text(*sub), Style::Sub);
            }
            col = last + 1;
        }
    }

    /// Each column's width: its longest text, a merged cell's counted in every column it
    /// spans, and at least `MIN_WIDTH`.
    pub fn widths(&self) -> Vec<usize> {
        let columns = self
            .cells
            .iter()
            .map(|c| c.1 as usize + 1)
            .max()
            .unwrap_or(0);
        let mut widths = vec![MIN_WIDTH; columns];
        let mut at: HashMap<(u32, u16), usize> = HashMap::new();
        for (row, col, cell, _) in &self.cells {
            let width = cell.width();
            widths[*col as usize] = widths[*col as usize].max(width);
            at.insert((*row, *col), width);
        }
        for (row, first, _, last) in &self.merges {
            let width = at.get(&(*row, *first)).copied().unwrap_or(0);
            for col in *first..=*last {
                widths[col as usize] = widths[col as usize].max(width);
            }
        }
        widths
    }
}

struct Header {
    text: &'static str,
    subs: Vec<&'static str>,
}

fn header(text: &'static str, subs: &[&'static str]) -> Header {
    Header {
        text,
        subs: subs.to_vec(),
    }
}

/// A whole workbook, laid out.
#[derive(Debug)]
pub struct Layout {
    pub title: String,
    /// The project's phase and the kind, e.g. "1P Load schedule".
    pub subject: String,
    pub category: String,
    pub sheets: Vec<Sheet>,
}

/// Everything an export reads, from the session.
pub struct Inputs<'a> {
    pub graph: &'a Graph,
    pub docs: &'a HashMap<String, Value>,
    pub rows: &'a mut HashMap<String, LoadRow>,
}

impl Inputs<'_> {
    fn doc(&self, id: &str, key: &str) -> Option<&Value> {
        self.docs.get(id)?.get(key)
    }
}

/// The workbook `kind` of `node_id` (the schedule's top panel; the voltage drop table
/// always covers the whole project), titled `title`.
pub fn layout(
    mut input: Inputs,
    kind: Kind,
    node_id: &str,
    title: String,
    voltage_drops: &[VoltageDropRow],
) -> Result<Layout, String> {
    let root_phase = input
        .graph
        .root()
        .and_then(|root| root.highest_unit_form.as_ref()?.phase.clone());
    let phase = root_phase.as_deref();
    if !matches!(
        phase,
        Some(phases::ONE_PHASE | phases::THREE_PHASE_WYE | phases::THREE_PHASE_DELTA)
    ) {
        return Err("Unknown phase".into());
    }
    let sheets = match kind {
        Kind::LoadSchedule => {
            let depth = input.graph.ancestors_and_self(node_id).len();
            let mut writer = Schedules {
                sheets: Vec::new(),
                seen: HashSet::new(),
                root_phase: phase,
            };
            writer.panel(&mut input, node_id, depth)?;
            writer.sheets
        }
        Kind::VoltageDrop => vec![voltage_drop_sheet(&mut input, phase, voltage_drops)],
    };
    let label = phase_label(phase);
    Ok(Layout {
        title,
        subject: format!("{label} {}", kind.label()),
        category: format!("{label},{},Export", kind.label()),
        sheets,
    })
}

/// The xlsx file.
pub fn render(layout: &Layout) -> Result<Vec<u8>, String> {
    let error = |e: rust_xlsxwriter::XlsxError| e.to_string();
    let mut workbook = Workbook::new();
    workbook.set_properties(
        &DocProperties::new()
            .set_title(&layout.title)
            .set_author(CREATOR)
            .set_subject(&layout.subject)
            .set_category(&layout.category)
            .set_comment(&layout.subject),
    );
    let styles = [
        Style::Plain,
        Style::Label,
        Style::Group,
        Style::Tall,
        Style::Sub,
        Style::Body,
        Style::Total,
    ];
    let formats: Vec<(Style, Format)> = styles.iter().map(|s| (*s, s.format())).collect();
    let format = |style: Style| &formats.iter().find(|(s, _)| *s == style).unwrap().1;
    for sheet in &layout.sheets {
        let worksheet = workbook.add_worksheet();
        worksheet.set_name(&sheet.name).map_err(error)?;
        // A merged range is written with its first cell's text and style.
        let mut masters: HashMap<(u32, u16), (&str, Style)> = sheet
            .merges
            .iter()
            .map(|m| ((m.0, m.1), ("", Style::Plain)))
            .collect();
        for (row, col, cell, style) in &sheet.cells {
            if let Some(master) = masters.get_mut(&(*row, *col)) {
                let Cell::Text(text) = cell else {
                    return Err("a merged range without text".into());
                };
                *master = (text, *style);
                continue;
            }
            let f = format(*style);
            match cell {
                Cell::Empty => worksheet.write_blank(*row, *col, f).map(|_| ()),
                Cell::Number(v) => worksheet
                    .write_number_with_format(*row, *col, *v, f)
                    .map(|_| ()),
                Cell::Text(text) if *style == Style::Plain => {
                    worksheet.write_string(*row, *col, text).map(|_| ())
                }
                Cell::Text(text) => worksheet
                    .write_string_with_format(*row, *col, text, f)
                    .map(|_| ()),
                Cell::Bool(b) => worksheet
                    .write_boolean_with_format(*row, *col, *b, f)
                    .map(|_| ()),
            }
            .map_err(error)?;
        }
        for &(first_row, first_col, last_row, last_col) in &sheet.merges {
            let (text, style) = masters[&(first_row, first_col)];
            worksheet
                .merge_range(
                    first_row,
                    first_col,
                    last_row,
                    last_col,
                    text,
                    format(style),
                )
                .map_err(error)?;
        }
        for (col, width) in sheet.widths().into_iter().enumerate() {
            // Pixels at Calibri 11 (7 px a character), so Excel's stored width is exactly
            // `width` characters, as ExcelJS wrote it (`set_column_width` adds padding).
            worksheet
                .set_column_width_pixels(col as u16, (width * 7) as u32)
                .map_err(error)?;
        }
    }
    workbook.save_to_buffer().map_err(error)
}

// ---------------------------------------------------------------------------------------
// Schedules of loads, PEC 2017 1.3.2.1(G)(1)(a)

struct Schedules<'p> {
    sheets: Vec<Sheet>,
    /// Panels written, so a looping parent chain in a tampered file cannot recurse forever.
    seen: HashSet<String>,
    root_phase: Option<&'p str>,
}

impl Schedules<'_> {
    /// Writes `id`'s schedule on its depth's sheet, then each sub-panel's, depth first.
    fn panel(&mut self, input: &mut Inputs, id: &str, depth: usize) -> Result<(), String> {
        let graph = input.graph;
        let node = graph.get(id).ok_or("Node not found")?;
        if !self.seen.insert(node.id.clone()) {
            return Ok(());
        }
        let total = load_row(graph, node, input.rows);
        let loads: Vec<(&Node, LoadRow)> = graph
            .children(&node.id)
            .map(|child| (child, load_row(graph, child, input.rows)))
            .collect();
        // What this panel distributes: the project's supply at the root, else its own phase.
        let panel_phase = supply_phase_of(Some(node)).or(self.root_phase);
        let name = node
            .panel_data
            .as_ref()
            .and_then(|p| p.name.clone())
            .or_else(|| {
                node.highest_unit_form
                    .as_ref()
                    .and_then(|f| f.distribution_unit.clone())
            })
            .unwrap_or_else(|| "Unknown Panel".into());
        let from = if node.node_type == "root" {
            "--".to_string()
        } else {
            node.parent_id
                .as_deref()
                .and_then(|id| graph.get(id))
                .and_then(|parent| parent.panel_data.as_ref()?.name.clone())
                .unwrap_or_else(|| "Transformer".into())
        };

        let sheet_name = ordinal(depth);
        let index = match self.sheets.iter().position(|s| s.name == sheet_name) {
            Some(index) => index,
            None => {
                self.sheets.push(Sheet::new(&sheet_name));
                self.sheets.len() - 1
            }
        };
        let sheet = &mut self.sheets[index];
        let start = sheet.rows;
        for (i, (label, value)) in [
            ("DESCRIPTION", "PANELBOARD SCHEDULE".to_string()),
            ("SUPPLY", supply_description(panel_phase)),
            ("FROM", from),
            ("NAME", name),
        ]
        .into_iter()
        .enumerate()
        {
            let row = start + i as u32;
            sheet.put(row, 0, Cell::text(label), Style::Label);
            sheet.put(row, 1, Cell::Text(format!(": {value}")), Style::Plain);
        }
        // A last column for the motors' overload relays (PEC 2017 4.30.3.2(A)(1)), only on
        // a schedule with a motor whose nameplate current is given.
        let overload = loads.iter().any(|(_, load)| load.overload.is_some());
        let mut headers = schedule_headers(panel_phase);
        if overload {
            headers.push(header(" ", &["OVERLOAD (A)"]));
        }
        sheet.headers(start + 4, &headers);
        let mut row = start + 6;
        for (child, load) in &loads {
            let mut cells = load_cells(input, child, load, panel_phase);
            if overload {
                cells.push(load.overload.map_or(Cell::text(""), Cell::num));
            }
            sheet.put_row(row, cells, Style::Body);
            row += 1;
        }
        // The root is the supply, not a panelboard: it has no main of its own to total
        // (the service rating sits on the panel it feeds, PEC 2017 2.30.6.10).
        if node.node_type != "root" {
            let mut cells = total_cells(input, node, &total, panel_phase);
            if overload {
                cells.push(Cell::text("N/A"));
            }
            sheet.put_row(row, cells, Style::Total);
            row += 1;
        }
        // Two blank rows before the next schedule on this sheet.
        sheet.rows = sheet.rows.max(row + 2);

        for (child, _) in &loads {
            if child.node_type == "root" || child.node_type == "panel" {
                self.panel(input, &child.id, depth + 1)?;
            }
        }
        Ok(())
    }
}

/// 1st, 2nd, 3rd, 4th, … 11th, 12th, 13th, … 21st (the app's `getOrdinalSuffix`).
fn ordinal(n: usize) -> String {
    let suffix = match (n % 10, n % 100) {
        (_, 11..=13) => "th",
        (1, _) => "st",
        (2, _) => "nd",
        (3, _) => "rd",
        _ => "th",
    };
    format!("{n}{suffix}")
}

fn is_three_phase(phase: Option<&str>) -> bool {
    matches!(
        phase,
        Some(phases::THREE_PHASE_WYE | phases::THREE_PHASE_DELTA)
    )
}

/// Phases (3P-Y) or line pairs (delta) a three-phase panel lists VA under.
fn phase_labels(phase: Option<&str>) -> &'static [&'static str] {
    if phase == Some(phases::THREE_PHASE_DELTA) {
        &PAIRS
    } else {
        &PHASES
    }
}

/// The supply line of the schedule header, e.g. "1P + E, 230V, 60Hz".
fn supply_description(phase: Option<&str>) -> String {
    let label = phase_label(phase);
    if phase == Some(phases::THREE_PHASE_WYE) {
        format!("{label} + N + E, 400Y/230V, 60Hz")
    } else {
        // 1P and 3P-Δ: no neutral.
        format!("{label} + E, 230V, 60Hz")
    }
}

/// A single-phase panel's columns A–Q; a three-phase one also lists each circuit's phase
/// and its VA per phase of a 400Y/230 V panel (PEC 2017 App. D Ex. D6), or per line pair
/// of a 230 V delta one, after the current.
fn schedule_headers(phase: Option<&str>) -> Vec<Header> {
    let mut headers = vec![
        header(" ", &["CRKT NO."]),
        header(" ", &["LOAD DESCRIPTION"]),
        header(" ", &["VOLTAGE (V)"]),
        header(" ", &["APPARENT POWER (VA)"]),
        header(" ", &["CURRENT (A)"]),
    ];
    if is_three_phase(phase) {
        let title = if phase == Some(phases::THREE_PHASE_DELTA) {
            "VA PER LINE PAIR"
        } else {
            "VA PER PHASE"
        };
        headers.push(header(" ", &["PHASE"]));
        headers.push(header(title, phase_labels(phase)));
    }
    headers.extend([
        header("CIRCUIT BREAKER", &["AT", "AF", "Pole", "KAIC"]),
        header("CONDUCTOR", &["Sets", "Qty", "Size (mm2)", "Insulation"]),
        header("EGC", &["Size", "Insulation"]),
        header("CONDUIT", &["Size", "Type"]),
    ]);
    headers
}

/// -1 is the engine's "none in the PEC table": a dash, as the schedule shows it.
fn size(value: f64) -> Cell {
    if value == -1.0 {
        Cell::text("-")
    } else {
        Cell::num(value)
    }
}

fn egc(egc: Egc) -> Cell {
    match egc {
        Egc::Size(v) => size(v),
        Egc::Error => Cell::text("error"),
    }
}

fn conduit(conduit: Conduit) -> Cell {
    match conduit {
        Conduit::Size(v) => size(v),
        Conduit::Text(text) => Cell::text(text),
    }
}

/// One share of `row`'s phase VA or line-pair VA, if the engine split it.
fn share(row: &LoadRow, label: &str) -> Option<f64> {
    let value = match label {
        "A" => row.phase_va.map(|p| p.A),
        "B" => row.phase_va.map(|p| p.B),
        "C" => row.phase_va.map(|p| p.C),
        "AB" => row.pair_va.map(|p| p.AB),
        "BC" => row.pair_va.map(|p| p.BC),
        _ => row.pair_va.map(|p| p.CA),
    };
    value.filter(|v| v.is_finite())
}

/// VA a circuit puts on one phase or line pair: a three-phase circuit's share (a third
/// when unsplit), a single-phase circuit's VA on its own phase, empty on the others.
fn phase_va(row: &LoadRow, label: &str) -> Cell {
    let va = if js::truthy(row.va) { row.va } else { 0.0 };
    if row.phase == ALL_PHASES {
        Cell::Number(js::round_js(share(row, label).unwrap_or(va / 3.0), 2))
    } else if row.phase == label {
        Cell::Number(va)
    } else {
        Cell::text("")
    }
}

fn load_cells(input: &Inputs, node: &Node, row: &LoadRow, phase: Option<&str>) -> Vec<Cell> {
    let doc = |key: &str| Cell::doc(input.doc(&node.id, key));
    let mut cells = vec![
        doc("circuit_number"),
        Cell::text(row.load_description.as_str()),
        Cell::num(row.voltage),
        Cell::num(row.va),
        Cell::num(row.current),
    ];
    if is_three_phase(phase) {
        cells.push(Cell::text(row.phase.as_str()));
        cells.extend(phase_labels(phase).iter().map(|l| phase_va(row, l)));
    }
    cells.extend([
        Cell::num(row.at),
        Cell::num(row.ampere_frames),
        doc("pole"),
        doc("kaic"),
        doc("conductor_sets"),
        doc("conductor_qty"),
        size(row.conductor_size),
        doc("conductor_insulation"),
        egc(row.egc_size),
        doc("egc_insulation"),
        conduit(row.conduit_size),
        doc("conduit_type"),
    ]);
    cells
}

/// The panel's own row: TOTAL / MAIN, then its totals typed like the circuits above them
/// (numbers as numbers, so Excel can sum and format them), "N/A" for what it lacks.
fn total_cells(input: &Inputs, node: &Node, row: &LoadRow, phase: Option<&str>) -> Vec<Cell> {
    let doc = |key: &str| match Cell::doc(input.doc(&node.id, key)) {
        Cell::Empty => Cell::text("N/A"),
        cell => cell,
    };
    let mut cells = vec![
        Cell::text("TOTAL"),
        Cell::text("MAIN"),
        Cell::num(row.voltage),
        Cell::num(row.va),
        Cell::num(row.current),
    ];
    if is_three_phase(phase) {
        cells.push(Cell::text(ALL_PHASES));
        cells.extend(
            phase_labels(phase)
                .iter()
                .map(|l| Cell::Number(js::round_js(share(row, l).unwrap_or(0.0), 2))),
        );
    }
    cells.extend([
        Cell::num(row.at),
        Cell::num(row.ampere_frames),
        doc("pole"),
        doc("kaic"),
        doc("conductor_sets"),
        doc("conductor_qty"),
        size(row.conductor_size),
        doc("conductor_insulation"),
        egc(row.egc_size),
        doc("egc_insulation"),
        conduit(row.conduit_size),
        doc("conduit_type"),
    ]);
    cells
}

// ---------------------------------------------------------------------------------------
// Voltage drop, PEC 2017 App. D Ex. D15

/// The app's `dashIfNone`: -1, absent or not a number print as "-".
fn dash(value: Option<f64>) -> Cell {
    match value {
        Some(v) if v != -1.0 && v.is_finite() => Cell::Number(v),
        _ => Cell::text("-"),
    }
}

fn voltage_drop_sheet(
    input: &mut Inputs,
    root_phase: Option<&str>,
    drops: &[VoltageDropRow],
) -> Sheet {
    // A three-phase study mixes three-phase and single-phase runs (App. D Ex. D15), and
    // 3P-Y also 400 V and 230 V ones, so each row names its phase and voltage.
    let three_phase = is_three_phase(root_phase);
    let mut headers = vec![header("From NODE", &[]), header("To NODE", &[])];
    if three_phase {
        headers.extend([header("PHASE", &[]), header("VOLTAGE", &["(V)"])]);
    }
    headers.extend([
        header("CABLE", &["Sets", "Qty", "Size (mm2)"]),
        header("Z", &["(Ω/305m)"]),
        header("LENGTH", &["(m)"]),
        header("CURRENT", &["(A)"]),
        header("Actual Z", &["(Ω)"]),
        header("VOLTAGE DROP (V)", &["Per Segment", "At End Circuit"]),
        header("VOLTAGE AT RECEIVING END (V)", &[]),
        header("PERCENTAGE VOLTAGE DROP (%)", &[]),
    ]);
    let mut sheet = Sheet::new("Voltage Drop");
    sheet.headers(0, &headers);
    let graph = input.graph;
    for (i, drop) in drops.iter().enumerate() {
        let Some(node) = graph.get(&drop.id) else {
            continue;
        };
        let row = load_row(graph, node, input.rows);
        let doc = |key: &str| Cell::doc(input.doc(&node.id, key));
        let mut cells = vec![
            Cell::text(drop.from_node_name.as_str()),
            Cell::text(drop.to_node_name.as_str()),
        ];
        if three_phase {
            cells.extend([Cell::text(row.phase.as_str()), Cell::num(row.voltage)]);
        }
        cells.extend([
            doc("conductor_sets"),
            doc("conductor_qty"),
            dash(Some(row.conductor_size)),
            dash(drop.z),
            drop.length.map_or(Cell::Empty, Cell::num),
            Cell::num(drop.current),
            dash(Some(drop.actual_z)),
            dash(Some(drop.voltage_per_segment)),
            dash(Some(drop.voltage_at_end_circuit)),
            dash(Some(drop.voltage_at_receiving_end)),
            dash(Some(drop.percent_voltage_drop)),
        ]);
        sheet.put_row(2 + i as u32, cells, Style::Body);
    }
    sheet
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinal_follows_get_ordinal_suffix() {
        for (n, text) in [
            (1, "1st"),
            (2, "2nd"),
            (3, "3rd"),
            (4, "4th"),
            (11, "11th"),
            (12, "12th"),
            (13, "13th"),
            (21, "21st"),
            (22, "22nd"),
            (111, "111th"),
            (101, "101st"),
        ] {
            assert_eq!(ordinal(n), text);
        }
    }

    #[test]
    fn widths_count_a_merged_cell_in_every_column_it_spans() {
        let mut sheet = Sheet::new("s");
        sheet.headers(0, &[header("CIRCUIT BREAKER", &["AT", "AF"])]);
        sheet.put(2, 0, Cell::Number(14.35), Style::Body);
        assert_eq!(sheet.widths(), vec![15, 15]);
        assert_eq!(sheet.merges, vec![(0, 0, 0, 1)]);
    }

    #[test]
    fn a_one_column_group_is_not_merged() {
        let mut sheet = Sheet::new("s");
        sheet.headers(0, &[header(" ", &["CRKT NO."]), header("From", &[])]);
        assert_eq!(sheet.merges, vec![(0, 1, 1, 1)]);
    }
}
