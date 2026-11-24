//! The permit sheet set as one PDF (#287): the riser diagram, every panelboard's
//! schedule of loads, and the voltage drop and short circuit computations, on PEC 2017
//! 1.3.1.1 drawing sheets with the 1.3.2.2 title block. Every value is the one the app
//! shows; values the engineer overrode are marked with an asterisk.
//!
//! The sheets are first laid out as plain drawing operations (the title blocks need the
//! final sheet count), then written with krilla, which embeds a subset of Liberation
//! Sans (SIL Open Font License, `fonts/`).

use crate::graph::Graph;
use crate::load_schedule::{load_row, LoadRow};
use crate::model::{phases, Node};
use crate::num;
use crate::phases::{supply_phase_of, ALL_PHASES, PAIRS, PHASES};
use crate::riser::{phase_label, RiserLayout, BREAKER_HEIGHT, LINE, TRANSFORMER_HEIGHT};
use crate::short_circuit::{InterruptingRatingStatus, ShortCircuitRow};
use crate::sizing::{Conduit, Egc};
use crate::text::{Metrics, BOLD, REGULAR};
use crate::voltage_drop::VoltageDropRow;
use krilla::geom::{PathBuilder, Point, Transform};
use krilla::metadata::Metadata;
use krilla::page::PageSettings;
use krilla::paint::{Fill, Stroke};
use krilla::text::{Font, GlyphId, KrillaGlyph};
use krilla::Document;
use serde::Deserialize;
use serde_json::Value;
use skrifa::MetadataProvider;
use std::collections::HashMap;

const PT_PER_MM: f64 = 72.0 / 25.4;
/// Border around the sheet, mm.
const BORDER: f64 = 10.0;
/// PEC 2017 1.3.2.2: "a standard strip of 40 mm high at the bottom of the sheet".
const TITLE_BLOCK_HEIGHT: f64 = 40.0;
const GAP: f64 = 6.0;
const OVERRIDE_NOTE: &str = "* Set by the engineer (override), not the computed value.";
/// Riser scale, mm per layout px: fit the sheet when the diagram is small, never below readable.
const RISER_MAX_SCALE: f64 = 0.45;
const RISER_MIN_SCALE: f64 = 0.18;

/// PEC 2017 1.3.1.1(C): A3 sheets only up to this load (and 50 m², which heda does not record).
pub const A3_SHEET_MAX_VA: f64 = 3680.0;

/// The drawing sheet sizes of PEC 2017 1.3.1.1, landscape (width, height) in mm: (A) the
/// standard sizes, and (C) A3 for a dwelling of at most 50 m² and 3680 VA.
pub fn sheet_size(value: Option<&str>) -> (f64, f64) {
    match value {
        Some("600x900") => (900.0, 600.0),
        Some("500x760") => (760.0, 500.0),
        Some("A3") => (420.0, 297.0),
        _ => (1000.0, 760.0),
    }
}

/// What the title block carries per project, PEC 2017 1.3.2.2 (A), (B), (D).
#[derive(Debug, Clone, Default, Deserialize)]
pub struct TitleBlock {
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub owner_name: Option<String>,
    #[serde(default)]
    pub owner_address: Option<String>,
    #[serde(default)]
    pub engineer_name: Option<String>,
    #[serde(default)]
    pub prc_license_number: Option<String>,
    #[serde(default)]
    pub prc_license_validity: Option<String>,
    #[serde(default)]
    pub ptr_number: Option<String>,
    #[serde(default)]
    pub tin: Option<String>,
    #[serde(default)]
    pub sheet_size: Option<String>,
}

/// Everything the sheet set prints, read from the session.
pub struct SheetSetInputs<'a> {
    pub graph: &'a Graph,
    pub docs: &'a HashMap<String, Value>,
    pub rows: &'a mut HashMap<String, LoadRow>,
    pub voltage_drops: Vec<VoltageDropRow>,
    pub short_circuits: Vec<ShortCircuitRow>,
    pub riser: RiserLayout,
    pub title_block: TitleBlock,
    pub project_name: String,
    /// Date drawn, PEC 2017 1.3.2.2(E).
    pub date: String,
}

// ---------------------------------------------------------------------------------------
// Text

impl Metrics {
    /// `text` as glyphs one per character, advanced by the font's own widths. These are
    /// short Latin labels, so a full shaper (krilla's `draw_text`) adds nothing but time.
    fn glyphs(&self, text: &str, bold: bool) -> Vec<KrillaGlyph> {
        let (font, metrics) = if bold { &self.bold } else { &self.regular };
        let charmap = font.charmap();
        text.char_indices()
            .map(|(i, c)| {
                let glyph = charmap.map(c).unwrap_or_default();
                KrillaGlyph::new(
                    GlyphId::new(glyph.to_u32()),
                    metrics.advance_width(glyph).unwrap_or(0.0),
                    0.0,
                    0.0,
                    0.0,
                    i..i + c.len_utf8(),
                    None,
                )
            })
            .collect()
    }
}

fn num(value: f64) -> String {
    num::display(value)
}

/// -1 is the engine's "none in the PEC table": a dash, as the schedule shows it.
fn size(value: f64) -> String {
    if value == -1.0 {
        "-".into()
    } else {
        num(value)
    }
}

fn egc(egc: Egc) -> String {
    match egc {
        Egc::Size(v) => size(v),
        Egc::Error => "error".into(),
    }
}

fn conduit(conduit: Conduit) -> String {
    match conduit {
        Conduit::Size(v) => size(v),
        Conduit::Text(text) => text.into(),
    }
}

/// The app's `dashIfNone`: -1, absent or NaN print as "-".
fn dash(value: Option<f64>) -> String {
    match value {
        Some(v) if v != -1.0 && !v.is_nan() => num(v),
        _ => "-".into(),
    }
}

/// Fault current in whole amperes with thousands separators; a dash without a source.
fn amperes(value: Option<f64>) -> String {
    let Some(value) = value else {
        return "—".into();
    };
    let digits = format!("{}", (value + 0.5).floor() as i64);
    let (sign, digits) = digits
        .strip_prefix('-')
        .map_or(("", digits.as_str()), |d| ("-", d));
    let mut grouped = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(c);
    }
    format!("{sign}{grouped}")
}

/// Per-unit and ohm values to four decimals; a dash when absent.
fn impedance(value: Option<f64>) -> String {
    value.map_or("—".into(), |v| format!("{:.4}", v))
}

/// The least interrupting rating a breaker needs (PEC 2017 1.10.1.9), kA rounded up to 0.1.
fn required_ka(fault_current: Option<f64>) -> String {
    fault_current.map_or("—".into(), |fc| {
        format!("{:.1}", (fc / 100.0).ceil() / 10.0)
    })
}

fn status_label(status: InterruptingRatingStatus) -> &'static str {
    match status {
        InterruptingRatingStatus::Ok => "OK",
        InterruptingRatingStatus::UnderRated => "UNDER-RATED",
        InterruptingRatingStatus::NoSource => "NO SOURCE",
    }
}

/// A stored value as the app prints it: text as typed, numbers in their shortest form.
fn doc_value(docs: &HashMap<String, Value>, id: &str, key: &str) -> Option<String> {
    match docs.get(id)?.get(key)? {
        Value::String(text) => Some(text.clone()),
        Value::Number(n) => n.as_f64().map(num),
        _ => None,
    }
}

// ---------------------------------------------------------------------------------------
// Drawing operations, in mm with the origin at the top left of the sheet

#[derive(Debug, Clone, Copy, PartialEq)]
enum Align {
    Left,
    Center,
}

#[derive(Debug, Clone)]
enum Op {
    /// Straight segments, stroked at a width.
    Lines(f64, Vec<[f64; 4]>),
    Rect([f64; 4], f64),
    /// A cubic Bézier: start, then control, control, end per segment.
    Curve(Vec<[f64; 2]>, f64),
    Circle([f64; 3], bool),
    Text {
        at: [f64; 2],
        size: f64,
        bold: bool,
        text: String,
    },
    /// Operations clipped to a rectangle and moved by a transform (a b c d e f).
    Group {
        clip: [f64; 4],
        transform: [f64; 6],
        ops: Vec<Op>,
    },
}

struct Sheet {
    title: String,
    ops: Vec<Op>,
    marked: bool,
}

/// Sheets of one size, a cursor down the drawing area, and the text metrics.
struct Writer {
    width: f64,
    height: f64,
    font: f64,
    sheets: Vec<Sheet>,
    y: f64,
    metrics: Metrics,
}

impl Writer {
    fn left(&self) -> f64 {
        BORDER + GAP
    }
    fn right(&self) -> f64 {
        self.width - BORDER - GAP
    }
    fn top(&self) -> f64 {
        BORDER + GAP
    }
    /// Above the title block, leaving a line for the override note.
    fn bottom(&self) -> f64 {
        self.height - BORDER - TITLE_BLOCK_HEIGHT - GAP - self.font * 2.0
    }

    fn ops(&mut self) -> &mut Vec<Op> {
        &mut self.sheets.last_mut().expect("a sheet").ops
    }

    /// Starts a sheet; `title` goes in its title block (PEC 2017 1.3.2.2(C)).
    fn start(&mut self, title: &str) {
        self.sheets.push(Sheet {
            title: title.into(),
            ops: Vec::new(),
            marked: false,
        });
        self.y = self.top();
    }

    /// Moves to a new sheet of the same title unless `height` still fits.
    fn fit(&mut self, height: f64) {
        if self.y + height > self.bottom() {
            let title = self
                .sheets
                .last()
                .map(|s| s.title.clone())
                .unwrap_or_default();
            self.start(&title);
        }
    }

    fn text(&mut self, x: f64, y: f64, text: &str, size: f64, bold: bool, align: Align) {
        if text.is_empty() {
            return;
        }
        let x = match align {
            Align::Left => x,
            Align::Center => x - self.metrics.width(text, size, bold) / 2.0,
        };
        self.ops().push(Op::Text {
            at: [x, y],
            size,
            bold,
            text: text.into(),
        });
    }

    /// A heading line at the cursor.
    fn heading(&mut self, text: &str, bold: bool) {
        let font = self.font;
        self.fit(font * 2.0);
        self.y += font * 1.6;
        let (x, y) = (self.left(), self.y);
        self.text(
            x,
            y,
            text,
            font * if bold { 1.2 } else { 1.0 },
            bold,
            Align::Left,
        );
    }
}

// ---------------------------------------------------------------------------------------
// Tables

/// A header group: its text, and its columns' own headers (none for a single column).
struct Header {
    text: String,
    subs: Vec<String>,
}

fn header(text: &str, subs: &[&str]) -> Header {
    Header {
        text: text.into(),
        subs: subs.iter().map(|s| s.to_string()).collect(),
    }
}

impl Header {
    fn cols(&self) -> usize {
        self.subs.len().max(1)
    }
}

#[derive(Default)]
struct Row {
    cells: Vec<String>,
    /// Cells holding an engineer's override instead of the computed value.
    marks: Vec<bool>,
    bold: bool,
}

impl Row {
    fn cell(&self, i: usize) -> String {
        let text = self.cells.get(i).cloned().unwrap_or_default();
        if self.marks.get(i).copied().unwrap_or(false) {
            format!("{text}*")
        } else {
            text
        }
    }
}

/// A table at the cursor, columns sized to their text and shrunk to the sheet's width;
/// it continues on the next sheet under "`caption` (cont.)" with its header repeated.
fn table(w: &mut Writer, caption: &str, headers: &[Header], rows: &[Row]) {
    let base = w.font;
    let subs: Vec<&str> = headers
        .iter()
        .flat_map(|h| {
            if h.subs.is_empty() {
                vec![h.text.as_str()]
            } else {
                h.subs.iter().map(String::as_str).collect()
            }
        })
        .collect();
    let mut widths: Vec<f64> = subs
        .iter()
        .enumerate()
        .map(|(i, sub)| {
            rows.iter()
                .map(|row| w.metrics.width(&row.cell(i), base, row.bold))
                .fold(w.metrics.width(sub, base, true), f64::max)
        })
        .collect();
    // A group's own text widens its columns when they are narrower than it.
    let mut column = 0;
    for h in headers {
        let span: f64 = widths[column..column + h.cols()].iter().sum();
        let need = w.metrics.width(&h.text, base, true) - span;
        if !h.subs.is_empty() && need > 0.0 {
            for width in &mut widths[column..column + h.cols()] {
                *width += need / h.cols() as f64;
            }
        }
        column += h.cols();
    }
    let pad = base * 0.8;
    let natural: f64 = widths.iter().map(|width| width + pad * 2.0).sum();
    let scale = ((w.right() - w.left()) / natural).min(1.0);
    let font = base * scale;
    let row_height = font * 1.8;
    let mut edges = vec![w.left()];
    for width in &widths {
        edges.push(edges.last().unwrap() + (width + pad * 2.0) * scale);
    }
    let total = edges.last().unwrap() - w.left();

    let next_sheet = |w: &mut Writer| {
        let title = w.sheets.last().map(|s| s.title.clone()).unwrap_or_default();
        w.start(&title);
        w.heading(&format!("{caption} (cont.)"), true);
    };
    let draw_header = |w: &mut Writer| {
        if w.y + row_height * 3.0 > w.bottom() {
            next_sheet(w);
        }
        let top = w.y + row_height * 0.5;
        let left = w.left();
        let mut lines = vec![];
        let mut i = 0;
        for h in headers {
            let (l, r) = (edges[i], edges[i + h.cols()]);
            lines.push([r, top, r, top + row_height * 2.0]);
            if h.subs.is_empty() {
                w.text(
                    (l + r) / 2.0,
                    top + row_height * 1.2,
                    &h.text,
                    font,
                    true,
                    Align::Center,
                );
            } else {
                w.text(
                    (l + r) / 2.0,
                    top + row_height * 0.7,
                    &h.text,
                    font,
                    true,
                    Align::Center,
                );
                lines.push([l, top + row_height, r, top + row_height]);
                for (j, sub) in h.subs.iter().enumerate() {
                    let (sl, sr) = (edges[i + j], edges[i + j + 1]);
                    if j > 0 {
                        lines.push([sl, top + row_height, sl, top + row_height * 2.0]);
                    }
                    w.text(
                        (sl + sr) / 2.0,
                        top + row_height * 1.7,
                        sub,
                        font,
                        true,
                        Align::Center,
                    );
                }
            }
            i += h.cols();
        }
        w.ops()
            .push(Op::Rect([left, top, total, row_height * 2.0], 0.25));
        w.ops().push(Op::Lines(0.25, lines));
        w.y = top + row_height * 2.0;
    };

    draw_header(w);
    for row in rows {
        if w.y + row_height > w.bottom() {
            next_sheet(w);
            draw_header(w);
        }
        let top = w.y;
        let mut lines = vec![];
        for i in 0..edges.len() - 1 {
            let (l, r) = (edges[i], edges[i + 1]);
            if i > 0 {
                lines.push([l, top, l, top + row_height]);
            }
            if row.marks.get(i).copied().unwrap_or(false) {
                w.sheets.last_mut().unwrap().marked = true;
            }
            w.text(
                (l + r) / 2.0,
                top + row_height * 0.68,
                &row.cell(i),
                font,
                row.bold,
                Align::Center,
            );
        }
        let left = w.left();
        let stroke = if row.bold { 0.35 } else { 0.15 };
        w.ops()
            .push(Op::Rect([left, top, total, row_height], stroke));
        w.ops().push(Op::Lines(0.15, lines));
        w.y += row_height;
    }
    w.y += row_height;
}

// ---------------------------------------------------------------------------------------
// Schedules of loads, PEC 2017 1.3.2.1(E): the columns the app and the Excel export show

/// Phases (3P-Y) or line pairs (delta) a three-phase panel lists VA under.
fn phase_labels(panel_phase: Option<&str>) -> &'static [&'static str] {
    match panel_phase {
        Some(phases::THREE_PHASE_DELTA) => &PAIRS,
        _ => &PHASES,
    }
}

fn is_three_phase(panel_phase: Option<&str>) -> bool {
    matches!(
        panel_phase,
        Some(phases::THREE_PHASE_WYE | phases::THREE_PHASE_DELTA)
    )
}

/// VA a circuit puts on one phase or line pair, as the schedule shows it (`rowPhaseVa`).
fn phase_va(row: &LoadRow, label: &str) -> String {
    if row.phase == ALL_PHASES {
        let share = row
            .phase_va
            .and_then(|p| match label {
                "A" => Some(p.A),
                "B" => Some(p.B),
                "C" => Some(p.C),
                _ => None,
            })
            .or_else(|| {
                row.pair_va.and_then(|p| match label {
                    "AB" => Some(p.AB),
                    "BC" => Some(p.BC),
                    "CA" => Some(p.CA),
                    _ => None,
                })
            });
        return num(num::round(share.unwrap_or(row.va / 3.0), 2));
    }
    if row.phase == label {
        num(row.va)
    } else {
        String::new()
    }
}

/// The supply line of the schedule header, e.g. "1P + E, 230V, 60Hz".
fn supply_description(phase: Option<&str>) -> String {
    let label = phase_label(phase);
    if phase == Some(phases::THREE_PHASE_WYE) {
        format!("{label} + N + E, 400Y/230V, 60Hz")
    } else {
        format!("{label} + E, 230V, 60Hz")
    }
}

fn schedule_headers(panel_phase: Option<&str>) -> Vec<Header> {
    let mut headers = vec![
        header("CKT NO.", &[]),
        header("LOAD DESCRIPTION", &[]),
        header("VOLTAGE (V)", &[]),
        header("APPARENT POWER (VA)", &[]),
        header("CURRENT (A)", &[]),
    ];
    if is_three_phase(panel_phase) {
        let title = if panel_phase == Some(phases::THREE_PHASE_DELTA) {
            "VA PER LINE PAIR"
        } else {
            "VA PER PHASE"
        };
        headers.push(header("PHASE", &[]));
        headers.push(header(title, phase_labels(panel_phase)));
    }
    headers.extend([
        header("CIRCUIT BREAKER", &["AT", "AF", "Pole", "KAIC"]),
        header("CONDUCTOR", &["Sets", "Qty", "Size (mm²)", "Insulation"]),
        header("EGC", &["Size", "Insulation"]),
        header("CONDUIT", &["Size", "Type"]),
    ]);
    headers
}

/// One circuit's cells, or a panel's totals (`total`), in `schedule_headers` order.
fn schedule_row(
    node: &Node,
    row: &LoadRow,
    docs: &HashMap<String, Value>,
    panel_phase: Option<&str>,
    total: bool,
) -> Row {
    let overridden = |value: Option<f64>| num::positive(value).is_some();
    let or_na = |value: Option<String>| {
        if total {
            value.unwrap_or_else(|| "N/A".into())
        } else {
            value.unwrap_or_default()
        }
    };
    let mut cells = vec![];
    let mut marks = vec![];
    let mut push = |cell: String, mark: bool| {
        cells.push(cell);
        marks.push(mark);
    };
    if total {
        push("TOTAL".into(), false);
        push("MAIN".into(), false);
    } else {
        push(node.circuit_number.map(num).unwrap_or_default(), false);
        push(row.load_description.clone(), false);
    }
    push(num(row.voltage), false);
    push(num(row.va), false);
    // The schedule's footer shows the panel current to 0.01 A.
    push(
        if total {
            format!("{:.2}", row.current)
        } else {
            num(row.current)
        },
        false,
    );
    if is_three_phase(panel_phase) {
        push(
            if total {
                ALL_PHASES.into()
            } else {
                row.phase.clone()
            },
            false,
        );
        for label in phase_labels(panel_phase) {
            let cell = if total {
                let value = match *label {
                    "A" => row.phase_va.map(|p| p.A),
                    "B" => row.phase_va.map(|p| p.B),
                    "C" => row.phase_va.map(|p| p.C),
                    "AB" => row.pair_va.map(|p| p.AB),
                    "BC" => row.pair_va.map(|p| p.BC),
                    _ => row.pair_va.map(|p| p.CA),
                };
                num(num::round(value.unwrap_or(0.0), 2))
            } else {
                phase_va(row, label)
            };
            push(cell, false);
        }
    }
    push(num(row.at), overridden(node.overrided_at));
    push(
        num(row.ampere_frames),
        overridden(node.overrided_ampere_frames),
    );
    push(or_na(doc_value(docs, &node.id, "pole")), false);
    push(or_na(doc_value(docs, &node.id, "kaic")), false);
    push(or_na(node.conductor_sets.map(num)), false);
    push(or_na(node.conductor_qty.map(num)), false);
    push(
        size(row.conductor_size),
        overridden(node.overrided_conductor_size),
    );
    push(or_na(node.conductor_insulation.clone()), false);
    push(egc(row.egc_size), overridden(node.overrided_egc_size));
    push(or_na(doc_value(docs, &node.id, "egc_insulation")), false);
    push(
        conduit(row.conduit_size),
        overridden(node.overrided_conduit_size),
    );
    push(or_na(node.conduit_type.clone()), false);
    Row {
        cells,
        marks,
        bold: total,
    }
}

fn draw_schedules(w: &mut Writer, input: &mut SheetSetInputs) {
    let Some(root) = input.graph.root() else {
        return;
    };
    let root_phase = root
        .highest_unit_form
        .as_ref()
        .and_then(|form| form.phase.clone());
    w.start("SCHEDULE OF LOADS");
    let mut first = true;
    // The supply first, then every panel below it, each before its subtree.
    let order: Vec<&Node> = std::iter::once(root)
        .chain(
            input
                .graph
                .preorder(root)
                .into_iter()
                .filter(|node| node.node_type == "panel"),
        )
        .collect();
    for node in order {
        let graph = input.graph;
        let panel_phase = supply_phase_of(Some(node))
            .map(str::to_owned)
            .or_else(|| root_phase.clone());
        let panel_phase = panel_phase.as_deref();
        let total = load_row(graph, node, input.rows);
        let loads: Vec<(&Node, LoadRow)> = graph
            .children(&node.id)
            .map(|child| (child, load_row(graph, child, input.rows)))
            .collect();
        // Keep a schedule's heading with at least its header and a row.
        if !first {
            let font = w.font;
            w.fit(font * 16.0);
        }
        first = false;
        let name = node
            .schedule_name()
            .unwrap_or_else(|| "Unknown Panel".into());
        let from = if node.node_type == "root" {
            "--".to_string()
        } else {
            node.parent_id
                .as_deref()
                .and_then(|id| graph.get(id))
                .and_then(Node::schedule_name)
                .unwrap_or_else(|| "--".into())
        };
        let caption = format!("PANELBOARD SCHEDULE: {name}");
        w.heading(&caption, true);
        w.heading(
            &format!("SUPPLY: {}", supply_description(panel_phase)),
            false,
        );
        w.heading(&format!("FROM: {from}"), false);
        if let (true, Some(unbalance)) = (is_three_phase(panel_phase), total.unbalance) {
            w.heading(&format!("UNBALANCE: {} %", num(unbalance)), false);
        }
        // A last column for the motors' overload relays (PEC 2017 4.30.3.2(A)(1)), only on
        // a schedule with a motor whose nameplate current is given.
        let overload = loads.iter().any(|(_, row)| row.overload.is_some());
        let with_overload = |mut row: Row, value: String| {
            if overload {
                row.cells.push(value);
                row.marks.push(false);
            }
            row
        };
        let mut rows: Vec<Row> = loads
            .iter()
            .map(|(child, row)| {
                let cells = schedule_row(child, row, input.docs, panel_phase, false);
                with_overload(cells, row.overload.map(num).unwrap_or_default())
            })
            .collect();
        // The root is the supply, not a panelboard: it has no main of its own to total
        // (the service disconnect is the panel it feeds; 2.30.6.10 sets its minimum rating).
        if node.node_type != "root" {
            let cells = schedule_row(node, &total, input.docs, panel_phase, true);
            rows.push(with_overload(cells, "N/A".into()));
        }
        let mut headers = schedule_headers(panel_phase);
        if overload {
            headers.push(header("OVERLOAD (A)", &[]));
        }
        table(w, &caption, &headers, &rows);
    }
}

// ---------------------------------------------------------------------------------------
// Voltage drop and short circuit computation sheets, as the app's tables show them

fn draw_voltage_drops(w: &mut Writer, input: &mut SheetSetInputs) {
    let graph = input.graph;
    let root_phase = graph
        .root()
        .and_then(|root| root.highest_unit_form.as_ref()?.phase.as_deref());
    let three_phase = is_three_phase(root_phase);
    let mut headers = vec![header("From NODE", &[]), header("To NODE", &[])];
    if three_phase {
        headers.extend([header("PHASE", &[]), header("VOLTAGE", &["(V)"])]);
    }
    headers.extend([
        header("CABLE", &["Sets", "Qty", "Size (mm²)"]),
        header("Z", &["(Ω/305m)"]),
        header("LENGTH", &["(m)"]),
        header("CURRENT", &["(A)"]),
        header("Actual Z", &["(Ω)"]),
        header("VOLTAGE DROP (V)", &["Per Segment", "At End Circuit"]),
        header("VOLTAGE AT RECEIVING END (V)", &[]),
        header("PERCENTAGE VOLTAGE DROP (%)", &[]),
    ]);
    let drops = std::mem::take(&mut input.voltage_drops);
    let rows: Vec<Row> = drops
        .iter()
        .filter_map(|drop| {
            let node = graph.get(&drop.id)?;
            let row = load_row(graph, node, input.rows);
            let mut cells = vec![drop.from_node_name.clone(), drop.to_node_name.clone()];
            let mut marks = vec![false, false];
            if three_phase {
                cells.extend([row.phase.clone(), num(row.voltage)]);
                marks.extend([false, false]);
            }
            let overridden = |value: Option<f64>| num::positive(value).is_some();
            for (cell, mark) in [
                (node.conductor_sets.map(num).unwrap_or_default(), false),
                (node.conductor_qty.map(num).unwrap_or_default(), false),
                (dash(Some(row.conductor_size)), false),
                (dash(drop.z), overridden(node.overrided_z)),
                (
                    drop.length.map(num).unwrap_or_default(),
                    overridden(node.overrided_length),
                ),
                (num(drop.current), false),
                (dash(Some(drop.actual_z)), false),
                (dash(Some(drop.voltage_per_segment)), false),
                (dash(Some(drop.voltage_at_end_circuit)), false),
                (dash(Some(drop.voltage_at_receiving_end)), false),
                (dash(Some(drop.percent_voltage_drop)), false),
            ] {
                cells.push(cell);
                marks.push(mark);
            }
            Some(Row {
                cells,
                marks,
                bold: false,
            })
        })
        .collect();
    if rows.is_empty() {
        return;
    }
    w.start("VOLTAGE DROP CALCULATION");
    w.heading("VOLTAGE DROP CALCULATION", true);
    table(w, "VOLTAGE DROP CALCULATION", &headers, &rows);
}

/// The short circuit table as the app shows it (PEC 2017 App. D Ex. D14, 1.10.1.9).
fn draw_short_circuits(w: &mut Writer, input: &mut SheetSetInputs) {
    let graph = input.graph;
    let faults = std::mem::take(&mut input.short_circuits);
    let rows: Vec<Row> = faults
        .iter()
        .filter_map(|fault| {
            let node = graph.get(&fault.id)?;
            let row = load_row(graph, node, input.rows);
            let overridden = |value: Option<f64>| num::positive(value).is_some();
            let conductor = node
                .overrided_conductor_size
                .filter(|v| *v > 0.0)
                .unwrap_or(row.conductor_size);
            let cells = vec![
                fault.from_node_name.clone(),
                fault.to_node_name.clone(),
                node.conductor_sets.map(num).unwrap_or_default(),
                size(conductor),
                node.conduit_type.clone().unwrap_or_default(),
                num(fault.length),
                impedance(Some(fault.conductor_z_ohm)),
                impedance(Some(fault.conductor_z_pu)),
                impedance(fault.motor_z_pu),
                impedance(fault.supply_z_pu),
                amperes(fault.supply_fault_current),
                amperes(fault.node_fault_current),
                required_ka(fault.supply_fault_current),
                num(fault.interrupting_rating_ka),
                status_label(fault.status).into(),
            ];
            let mut marks = vec![false; cells.len()];
            marks[3] = overridden(node.overrided_conductor_size);
            marks[5] = overridden(node.overrided_length);
            Some(Row {
                cells,
                marks,
                bold: false,
            })
        })
        .collect();
    if rows.is_empty() {
        return;
    }
    w.start("SHORT CIRCUIT CALCULATION");
    w.heading("SHORT CIRCUIT CALCULATION", true);
    table(
        w,
        "SHORT CIRCUIT CALCULATION",
        &[
            header("From NODE", &[]),
            header("To NODE", &[]),
            header("CABLE", &["Sets", "Size (mm²)", "Conduit", "Length (m)"]),
            header("CONDUCTOR Z", &["(Ω)", "(pu)"]),
            header("MOTOR Z", &["(pu)"]),
            header("AT BREAKER (SUPPLY BUS)", &["Z (pu)", "Isc (A)"]),
            header("AT END OF RUN", &["Isc (A)"]),
            header("kAIC", &["Required", "Rating"]),
            header("STATUS", &[]),
        ],
        &rows,
    );
}

// ---------------------------------------------------------------------------------------
// Riser diagram

/// A semicircle as two cubic quarter arcs, from `from` to `to` bulging by `bulge`
/// (perpendicular, in the direction of `normal`).
fn half_circle(from: [f64; 2], normal: [f64; 2], radius: f64, along: [f64; 2]) -> Vec<[f64; 2]> {
    let k = radius * 0.5523;
    let at = |a: f64, n: f64| {
        [
            from[0] + along[0] * a + normal[0] * n,
            from[1] + along[1] * a + normal[1] * n,
        ]
    };
    vec![
        at(0.0, 0.0),
        at(0.0, k),
        at(radius - k, radius),
        at(radius, radius),
        at(radius + k, radius),
        at(2.0 * radius, k),
        at(2.0 * radius, 0.0),
    ]
}

/// The riser in layout px: wires, Appendix A symbols and text, culled to `rect`.
fn riser_ops(layout: &RiserLayout, metrics: &Metrics, rect: [f64; 4]) -> Vec<Op> {
    let [left, top, right, bottom] = rect;
    let within =
        |l: f64, t: f64, r: f64, b: f64| r >= left && l <= right && b >= top && t <= bottom;
    let mut ops = vec![];
    let wires: Vec<[f64; 4]> = layout
        .wires
        .iter()
        .flat_map(|wire| {
            wire.windows(2)
                .map(|p| [p[0][0], p[0][1], p[1][0], p[1][1]])
        })
        .filter(|[x1, y1, x2, y2]| within(x1.min(*x2), y1.min(*y2), x1.max(*x2), y1.max(*y2)))
        .collect();
    ops.push(Op::Lines(1.5, wires));
    for &[x, y] in &layout.breakers {
        if !within(x - 12.0, y, x + 12.0, y + BREAKER_HEIGHT) {
            continue;
        }
        // Appendix A 1.11: circuit breaker, terminals and the arc between.
        ops.push(Op::Circle([x, y, 2.5], true));
        ops.push(Op::Circle([x, y + BREAKER_HEIGHT, 2.5], true));
        ops.push(Op::Curve(
            half_circle([x, y], [1.0, 0.0], BREAKER_HEIGHT / 2.0, [0.0, 1.0]),
            1.5,
        ));
    }
    // Appendix A 1.37: one cross-line per wire.
    let ticks: Vec<[f64; 4]> = layout
        .ticks
        .iter()
        .filter(|t| within(t.x - 6.0, t.y - 4.0, t.x + 6.0, t.y + t.count * 5.0))
        .flat_map(|t| {
            (0..t.count as usize).map(move |n| {
                let y = t.y + n as f64 * 5.0;
                [t.x - 5.0, y + 3.0, t.x + 5.0, y - 3.0]
            })
        })
        .collect();
    ops.push(Op::Lines(1.5, ticks));
    let text = |ops: &mut Vec<Op>, at: [f64; 2], size: f64, bold: bool, text: &str| {
        if !text.is_empty() {
            ops.push(Op::Text {
                at,
                size,
                bold,
                text: text.into(),
            });
        }
    };
    for b in &layout.boxes {
        if !within(b.x, b.y, b.x + b.width, b.y + b.height) {
            continue;
        }
        // Appendix A 1.14: a panelboard is a plain rectangle.
        ops.push(Op::Rect([b.x, b.y, b.width, b.height], 1.5));
        text(
            &mut ops,
            [b.x + 12.0, b.y + 12.0 + LINE - 4.0],
            12.0,
            true,
            &b.title,
        );
        for (i, line) in b.lines.iter().enumerate() {
            text(
                &mut ops,
                [b.x + 12.0, b.y + 12.0 + LINE * (i as f64 + 2.0) - 4.0],
                12.0,
                false,
                line,
            );
        }
    }
    for label in &layout.labels {
        let height = LINE * label.lines.len() as f64;
        if !within(label.x, label.y - LINE, label.x + 240.0, label.y + height) {
            continue;
        }
        for (i, line) in label.lines.iter().enumerate() {
            text(
                &mut ops,
                [label.x, label.y + LINE * i as f64],
                11.0,
                false,
                line,
            );
        }
    }
    if let Some([tx, ty]) = layout.transformer {
        // Appendix A 3.1: transformer with two separate windings.
        ops.push(Op::Lines(
            1.5,
            vec![
                [tx, ty, tx, ty + 11.0],
                [tx, ty + 29.0, tx, ty + TRANSFORMER_HEIGHT],
            ],
        ));
        for (y, up) in [(ty + 16.0, -1.0), (ty + 24.0, 1.0)] {
            for start in [tx - 15.0, tx - 5.0, tx + 5.0] {
                ops.push(Op::Curve(
                    half_circle([start, y], [0.0, up], 5.0, [1.0, 0.0]),
                    1.5,
                ));
            }
        }
    }
    if let Some([mx, my]) = layout.meter {
        // Appendix A 1.7: kilowatt-hour meter.
        ops.push(Op::Circle([mx, my, 9.0], false));
        let width = metrics.width("M", 10.0, true);
        text(&mut ops, [mx - width / 2.0, my + 4.0], 10.0, true, "M");
    }
    if let Some([gx, gy]) = layout.ground {
        // Appendix A 1.3: earth ground.
        ops.push(Op::Lines(
            1.5,
            vec![
                [gx + 12.0, gy, gx + 12.0, gy + 14.0],
                [gx + 2.0, gy + 14.0, gx + 22.0, gy + 14.0],
                [gx + 6.0, gy + 18.0, gx + 18.0, gy + 18.0],
                [gx + 10.0, gy + 22.0, gx + 14.0, gy + 22.0],
            ],
        ));
    }
    ops
}

/// The riser diagram (PEC 2017 1.3.2.1(G)). A diagram too large for one sheet at a
/// readable size is split across sheets, each showing its part.
fn draw_riser(w: &mut Writer, layout: &RiserLayout) {
    if layout.boxes.is_empty() {
        return;
    }
    let area = [
        w.left(),
        w.top(),
        w.right() - w.left(),
        w.height - BORDER - TITLE_BLOCK_HEIGHT - GAP - w.top(),
    ];
    let fit = (area[2] / layout.width).min(area[3] / layout.height);
    let scale = fit.clamp(RISER_MIN_SCALE, RISER_MAX_SCALE);
    let columns = ((layout.width * scale) / area[2] - 1e-9).ceil().max(1.0) as usize;
    let rows = ((layout.height * scale) / area[3] - 1e-9).ceil().max(1.0) as usize;
    let count = columns * rows;
    let tile = [area[2] / scale, area[3] / scale];
    // A diagram that fits one sheet sits in its middle.
    let offset = [
        if columns == 1 {
            (area[2] - layout.width * scale) / 2.0
        } else {
            0.0
        },
        if rows == 1 {
            (area[3] - layout.height * scale) / 2.0
        } else {
            0.0
        },
    ];
    for r in 0..rows {
        for c in 0..columns {
            let n = r * columns + c + 1;
            w.start(&if count > 1 {
                format!("RISER DIAGRAM ({n} OF {count})")
            } else {
                "RISER DIAGRAM".into()
            });
            let (left, top) = (c as f64 * tile[0], r as f64 * tile[1]);
            let ops = riser_ops(
                layout,
                &w.metrics,
                [left, top, left + tile[0], top + tile[1]],
            );
            w.ops().push(Op::Group {
                clip: area,
                transform: [
                    scale,
                    0.0,
                    0.0,
                    scale,
                    area[0] + offset[0] - left * scale,
                    area[1] + offset[1] - top * scale,
                ],
                ops,
            });
        }
    }
}

// ---------------------------------------------------------------------------------------
// Title block

/// PEC 2017 1.3.2.2 (A)–(F), in a 40 mm strip across the bottom of the sheet.
fn title_block_ops(
    w: &Writer,
    input: &SheetSetInputs,
    title: &str,
    number: usize,
    count: usize,
) -> Vec<Op> {
    let block = &input.title_block;
    let field = |value: &Option<String>| value.clone().unwrap_or_default();
    let x = BORDER;
    let y = w.height - BORDER - TITLE_BLOCK_HEIGHT;
    let width = w.width - BORDER * 2.0;
    let small = w.width < 500.0;
    let label = if small { 1.6 } else { 2.4 };
    let value = if small { 2.2 } else { 3.4 };
    let cells: [(f64, &str, String, Vec<String>); 6] = [
        (
            0.22,
            "PROJECT AND LOCATION",
            input.project_name.clone(),
            vec![field(&block.location)],
        ),
        (
            0.2,
            "OWNER",
            field(&block.owner_name),
            vec![
                field(&block.owner_address),
                String::new(),
                "Signature: ______________________".into(),
            ],
        ),
        (0.18, "SHEET TITLE", title.into(), vec![]),
        (
            0.24,
            "PROFESSIONAL ELECTRICAL ENGINEER",
            field(&block.engineer_name),
            vec![
                format!(
                    "PRC License No.: {}   Valid until: {}",
                    field(&block.prc_license_number),
                    field(&block.prc_license_validity)
                ),
                format!(
                    "PTR No.: {}   TIN: {}",
                    field(&block.ptr_number),
                    field(&block.tin)
                ),
                "Signature and seal: ______________________".into(),
            ],
        ),
        // NTS: the sheets hold schedules and a one-line diagram, nothing drawn to a scale.
        // PEC 2017 1.3.1.3 asks a graphic scale on each drawing sheet, and its FPN says it
        // "denotes nominal or average plan scale"; heda draws no plan, so it shows none and
        // says NTS (heda's reading: the clause names no exception).
        (0.09, "SCALE / DATE", "NTS".into(), vec![input.date.clone()]),
        (
            0.07,
            "SHEET NO.",
            format!("E-{number}"),
            vec![format!("{number} of {count}")],
        ),
    ];
    let mut ops = vec![Op::Rect([x, y, width, TITLE_BLOCK_HEIGHT], 0.35)];
    let mut lines = vec![];
    let mut left = x;
    let text = |ops: &mut Vec<Op>, at: [f64; 2], size: f64, bold: bool, text: &str| {
        if !text.is_empty() {
            ops.push(Op::Text {
                at,
                size,
                bold,
                text: text.into(),
            });
        }
    };
    for (share, caption, big, rest) in &cells {
        let cell_width = width * share;
        if left > x {
            lines.push([left, y, left, y + TITLE_BLOCK_HEIGHT]);
        }
        let pad = 2.0;
        let inner = cell_width - pad * 2.0;
        text(
            &mut ops,
            [left + pad, y + pad + label],
            label,
            true,
            caption,
        );
        let mut line_y = y + pad + label + value * 2.0;
        // The name wraps down to the cell's bottom, as the lines under it do: never cut short.
        for line in w.metrics.wrap(big, inner, value * 1.2, true) {
            if line_y > y + TITLE_BLOCK_HEIGHT - pad {
                break;
            }
            text(&mut ops, [left + pad, line_y], value * 1.2, true, &line);
            line_y += value * 1.7;
        }
        for line in rest
            .iter()
            .flat_map(|line| w.metrics.wrap(line, inner, value, false))
        {
            if line_y > y + TITLE_BLOCK_HEIGHT - pad {
                break;
            }
            text(&mut ops, [left + pad, line_y], value, false, &line);
            line_y += value * 1.5;
        }
        left += cell_width;
    }
    ops.push(Op::Lines(0.35, lines));
    ops
}

// ---------------------------------------------------------------------------------------
// Rendering with krilla

struct Fonts {
    regular: Font,
    bold: Font,
    metrics: Metrics,
}

fn render(surface: &mut krilla::surface::Surface, ops: &[Op], fonts: &Fonts) {
    let stroke = |width: f64| Stroke {
        width: width as f32,
        ..Stroke::default()
    };
    for op in ops {
        match op {
            Op::Lines(width, lines) => {
                let mut path = PathBuilder::new();
                for [x1, y1, x2, y2] in lines {
                    path.move_to(*x1 as f32, *y1 as f32);
                    path.line_to(*x2 as f32, *y2 as f32);
                }
                if let Some(path) = path.finish() {
                    surface.set_fill(None);
                    surface.set_stroke(Some(stroke(*width)));
                    surface.draw_path(&path);
                }
            }
            Op::Rect([x, y, w, h], width) => {
                let mut path = PathBuilder::new();
                path.move_to(*x as f32, *y as f32);
                path.line_to((x + w) as f32, *y as f32);
                path.line_to((x + w) as f32, (y + h) as f32);
                path.line_to(*x as f32, (y + h) as f32);
                path.close();
                if let Some(path) = path.finish() {
                    surface.set_fill(None);
                    surface.set_stroke(Some(stroke(*width)));
                    surface.draw_path(&path);
                }
            }
            Op::Curve(points, width) => {
                let mut path = PathBuilder::new();
                path.move_to(points[0][0] as f32, points[0][1] as f32);
                for c in points[1..].chunks(3) {
                    if let [a, b, end] = c {
                        path.cubic_to(
                            a[0] as f32,
                            a[1] as f32,
                            b[0] as f32,
                            b[1] as f32,
                            end[0] as f32,
                            end[1] as f32,
                        );
                    }
                }
                if let Some(path) = path.finish() {
                    surface.set_fill(None);
                    surface.set_stroke(Some(stroke(*width)));
                    surface.draw_path(&path);
                }
            }
            Op::Circle([cx, cy, r], filled) => {
                let k = r * 0.5523;
                let p = |x: f64, y: f64| ((cx + x) as f32, (cy + y) as f32);
                let mut path = PathBuilder::new();
                let (sx, sy) = p(*r, 0.0);
                path.move_to(sx, sy);
                for [(ax, ay), (bx, by), (ex, ey)] in [
                    [p(*r, k), p(k, *r), p(0.0, *r)],
                    [p(-k, *r), p(-r, k), p(-r, 0.0)],
                    [p(-r, -k), p(-k, -r), p(0.0, -r)],
                    [p(k, -r), p(*r, -k), p(*r, 0.0)],
                ] {
                    path.cubic_to(ax, ay, bx, by, ex, ey);
                }
                path.close();
                if let Some(path) = path.finish() {
                    if *filled {
                        surface.set_stroke(None);
                        surface.set_fill(Some(Fill::default()));
                    } else {
                        surface.set_fill(None);
                        surface.set_stroke(Some(stroke(1.5)));
                    }
                    surface.draw_path(&path);
                }
            }
            Op::Text {
                at,
                size,
                bold,
                text,
            } => {
                surface.set_stroke(None);
                surface.set_fill(Some(Fill::default()));
                let font = if *bold { &fonts.bold } else { &fonts.regular };
                surface.draw_glyphs(
                    Point::from_xy(at[0] as f32, at[1] as f32),
                    &fonts.metrics.glyphs(text, *bold),
                    font.clone(),
                    text,
                    *size as f32,
                    false,
                );
            }
            Op::Group {
                clip,
                transform,
                ops,
            } => {
                let [x, y, w, h] = *clip;
                let mut path = PathBuilder::new();
                path.move_to(x as f32, y as f32);
                path.line_to((x + w) as f32, y as f32);
                path.line_to((x + w) as f32, (y + h) as f32);
                path.line_to(x as f32, (y + h) as f32);
                path.close();
                let Some(path) = path.finish() else { continue };
                surface.push_clip_path(&path, &Default::default());
                let [a, b, c, d, e, f] = transform.map(|v| v as f32);
                surface.push_transform(&Transform::from_row(a, b, c, d, e, f));
                render(surface, ops, fonts);
                surface.pop();
                surface.pop();
            }
        }
    }
}

/// Lays out every sheet, the title blocks and frames included.
fn lay_out(mut input: SheetSetInputs) -> (Writer, SheetSetInputs) {
    let (width, height) = sheet_size(input.title_block.sheet_size.as_deref());
    let mut w = Writer {
        width,
        height,
        font: if width < 500.0 { 1.8 } else { 2.4 },
        sheets: Vec::new(),
        y: 0.0,
        metrics: Metrics::new(),
    };
    let riser = std::mem::take(&mut input.riser);
    draw_riser(&mut w, &riser);
    draw_schedules(&mut w, &mut input);
    draw_voltage_drops(&mut w, &mut input);
    draw_short_circuits(&mut w, &mut input);

    let count = w.sheets.len();
    let frames: Vec<Vec<Op>> = w
        .sheets
        .iter()
        .enumerate()
        .map(|(i, sheet)| {
            let mut frame = vec![Op::Rect(
                [BORDER, BORDER, width - BORDER * 2.0, height - BORDER * 2.0],
                0.5,
            )];
            if sheet.marked {
                frame.push(Op::Text {
                    at: [w.left(), w.bottom() + w.font * 1.5],
                    size: w.font,
                    bold: false,
                    text: OVERRIDE_NOTE.into(),
                });
            }
            frame.extend(title_block_ops(&w, &input, &sheet.title, i + 1, count));
            frame
        })
        .collect();
    for (sheet, frame) in w.sheets.iter_mut().zip(frames) {
        sheet.ops.extend(frame);
    }
    (w, input)
}

/// Each sheet's title and every text on it, in drawing order: what the tests read.
pub fn sheet_texts(input: SheetSetInputs) -> Vec<(String, Vec<String>)> {
    fn collect(ops: &[Op], texts: &mut Vec<String>) {
        for op in ops {
            match op {
                Op::Text { text, .. } => texts.push(text.clone()),
                Op::Group { ops, .. } => collect(ops, texts),
                _ => {}
            }
        }
    }
    let (w, _) = lay_out(input);
    w.sheets
        .iter()
        .map(|sheet| {
            let mut texts = vec![];
            collect(&sheet.ops, &mut texts);
            (sheet.title.clone(), texts)
        })
        .collect()
}

/// The sheet set PDF.
pub fn build(input: SheetSetInputs) -> Result<Vec<u8>, String> {
    let (w, input) = lay_out(input);
    let fonts = Fonts {
        regular: Font::new(REGULAR.into(), 0).ok_or("the bundled font did not load")?,
        bold: Font::new(BOLD.into(), 0).ok_or("the bundled font did not load")?,
        metrics: Metrics::new(),
    };
    let mut document = Document::new();
    document.set_metadata(
        Metadata::new()
            .title(format!("{} sheet set", input.project_name))
            .creator("heda".into()),
    );
    let page_size =
        PageSettings::from_wh((w.width * PT_PER_MM) as f32, (w.height * PT_PER_MM) as f32)
            .ok_or("invalid sheet size")?;
    for sheet in &w.sheets {
        let mut page = document.start_page_with(page_size.clone());
        let mut surface = page.surface();
        // Everything is laid out in mm.
        surface.push_transform(&Transform::from_scale(PT_PER_MM as f32, PT_PER_MM as f32));
        render(&mut surface, &sheet.ops, &fonts);
        surface.pop();
        surface.finish();
        page.finish();
    }
    document.finish().map_err(|error| format!("{error:?}"))
}
