//! Layout of the riser (one-line) diagram, PEC 2017 1.3.2.1(G): each panelboard with
//! its main and branch circuit ratings ((1)(a)), each feeder labelled with its wire size
//! and type, raceway, protective device and allowable ampacity over design load current
//! as a ratio ((3)(a)–(d)), and the load center's incoming supply ((4)). Every value is
//! a computed row; this only places text. The app draws it on screen and the sheet set
//! prints it, so both show the same diagram.

use crate::graph::Graph;
use crate::load_schedule::{load_row, LoadRow};
use crate::model::{phases, HighestUnitForm, Node};
use crate::num;
use crate::phases::{supply_of, Supply};
use crate::sizing::{self, Conduit, Egc};
use crate::solar;
use crate::text::Metrics;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;

pub const COLUMN: f64 = 300.0;
pub const BOX_WIDTH: f64 = 240.0;
pub const LINE: f64 = 16.0;
const PADDING: f64 = 12.0;
const MARGIN: f64 = 24.0;
/// Feeder labels have five lines; the drop to each panel leaves room for them.
const DROP: f64 = 5.0 * LINE + 40.0;
const BUS: f64 = 24.0;
/// Size of a box's text; the SVG and the screen draw it at 12 too.
const FONT_SIZE: f64 = 12.0;
/// Feeder labels start beside their drop and can run past the last column.
const LABEL_OVERHANG: f64 = 100.0;
/// The circuit breaker symbol (Appendix A 1.11) breaks the feeder this far below the bus.
const BREAKER_AT: f64 = 8.0;
pub const BREAKER_HEIGHT: f64 = 22.0;
/// Where the cross-lines counting the wires (Appendix A 1.37) sit on a feeder.
const TICKS_AT: f64 = 48.0;
/// Room above the service for the transformer (Appendix A 3.1).
const TRANSFORMER_SPACE: f64 = 64.0;
/// Height of the transformer symbol, leads included.
pub const TRANSFORMER_HEIGHT: f64 = 40.0;

pub type Point = [f64; 2];

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RiserBox {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub title: String,
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct RiserLabel {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub lines: Vec<String>,
}

/// Cross-lines on a feeder, one per wire (Appendix A 1.37).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Tick {
    pub x: f64,
    pub y: f64,
    pub count: f64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct RiserLayout {
    pub width: f64,
    pub height: f64,
    pub boxes: Vec<RiserBox>,
    /// Polylines of [x, y] points.
    pub wires: Vec<Vec<Point>>,
    pub labels: Vec<RiserLabel>,
    /// Top of each feeder's circuit breaker (Appendix A 1.11).
    pub breakers: Vec<Point>,
    pub ticks: Vec<Tick>,
    /// Top of the service transformer (Appendix A 3.1), when the project has one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transformer: Option<Point>,
    /// Earth ground (Appendix A 1.3), at the service.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ground: Option<Point>,
    /// Kilowatt-hour meter (Appendix A 1.7), on the service drop.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meter: Option<Point>,
}

/// What the diagram reads of a circuit: its stored node and document, and its row.
#[derive(Debug, Clone)]
pub struct Circuit<'a> {
    pub node: &'a Node,
    /// The stored document, for the fields the calculations do not read (pole, EGC insulation).
    pub doc: Option<&'a Value>,
    pub row: LoadRow,
}

impl Circuit<'_> {
    fn text(&self, key: &str) -> Option<&str> {
        self.doc?.get(key)?.as_str()
    }
}

/// A panelboard and everything below it.
#[derive(Debug, Clone)]
pub struct RiserTree<'a> {
    pub circuit: Circuit<'a>,
    pub panels: Vec<RiserTree<'a>>,
    /// Breaker ratings (AT) of the branch circuits on this panelboard.
    pub branch_ats: Vec<f64>,
    /// Total VA of those branch circuits.
    pub branch_va: f64,
    /// Equivalent area (mm², sets × size) of one ungrounded conductor of each branch
    /// circuit, summed per line A, B, C; `None` when one has no listed size.
    pub branch_area: Option<[f64; 3]>,
}

/// The tree under `id` from the computed rows.
pub fn riser_tree<'a>(
    graph: &'a Graph,
    docs: &'a HashMap<String, Value>,
    rows: &mut HashMap<String, LoadRow>,
    id: &str,
) -> Option<RiserTree<'a>> {
    let node = graph.get(id)?;
    let circuit = |node: &'a Node, rows: &mut HashMap<String, LoadRow>| Circuit {
        node,
        doc: docs.get(&node.id),
        row: load_row(graph, node, rows),
    };
    let mut panels = Vec::new();
    let mut branch_ats = Vec::new();
    let mut branch_va = 0.0;
    let mut branch_area = Some([0.0; 3]);
    let supply = supply_of(Some(node));
    let children: Vec<&Node> = graph.children(id).collect();
    for child in children {
        if child.node_type == "panel" {
            panels.extend(riser_tree(graph, docs, rows, &child.id));
        } else {
            let row = circuit(child, rows).row;
            branch_ats.push(row.at);
            branch_va += row.va;
            branch_area = add(branch_area, set_area(child, &row, supply));
        }
    }
    Some(RiserTree {
        circuit: circuit(node, rows),
        panels,
        branch_ats,
        branch_va,
        branch_area,
    })
}

/// One ungrounded conductor of every parallel set together, mm², on each line A, B, C the
/// circuit runs on (every line on a single-phase supply); `None` without a listed size (-1).
fn set_area(node: &Node, row: &LoadRow, supply: Supply) -> Option<[f64; 3]> {
    if row.conductor_size <= 0.0 {
        return None;
    }
    let area = (node.conductor_sets.unwrap_or(1.0) * row.conductor_size).max(0.0);
    let on_line =
        |line: char| supply == Supply::OnePhase || row.phase.is_empty() || row.phase.contains(line);
    Some(['A', 'B', 'C'].map(|line| if on_line(line) { area } else { 0.0 }))
}

/// Two equivalent areas together, line by line; unknown when either is.
fn add(a: Option<[f64; 3]>, b: Option<[f64; 3]>) -> Option<[f64; 3]> {
    let (a, b) = (a?, b?);
    Some([a[0] + b[0], a[1] + b[1], a[2] + b[2]])
}

fn num(value: f64) -> String {
    num::display(value)
}

/// Like the Excel export: -1 (none in the table) prints as "-".
fn size(value: Option<f64>) -> String {
    match value {
        None => "-".into(),
        Some(-1.0) => "-".into(),
        Some(v) => num(v),
    }
}

fn egc_size(egc: Egc) -> String {
    match egc {
        Egc::Size(v) => size(Some(v)),
        Egc::Error => "error".into(),
    }
}

fn conduit_size(conduit: Conduit) -> String {
    match conduit {
        Conduit::Size(v) => size(Some(v)),
        Conduit::Text(text) => text.into(),
    }
}

/// The app's short phase labels (`DEFAULT_PHASES`), or the stored value itself.
pub fn phase_label(phase: Option<&str>) -> String {
    match phase {
        Some(phases::ONE_PHASE) => "1P".into(),
        Some(phases::THREE_PHASE_WYE) => "3P-Y".into(),
        Some(phases::THREE_PHASE_DELTA) => "3P-Δ".into(),
        other => other.unwrap_or("").into(),
    }
}

/// Branch breakers by rating, largest first: "6 × 20 AT", as one list the box wraps.
pub fn branch_summary(ats: &[f64]) -> Vec<String> {
    let mut counts: Vec<(f64, usize)> = Vec::new();
    for &at in ats {
        match counts.iter_mut().find(|(rating, _)| *rating == at) {
            Some((_, count)) => *count += 1,
            None => counts.push((at, 1)),
        }
    }
    counts.sort_by(|(a, _), (b, _)| b.total_cmp(a));
    let groups: Vec<String> = counts
        .iter()
        .map(|(at, count)| format!("{count} × {} AT", num(*at)))
        .collect();
    if groups.is_empty() {
        return vec!["No branch circuits".into()];
    }
    vec!["Branch CBs:".into(), groups.join(", ")]
}

/// The five lines beside a feeder, PEC 2017 1.3.2.1(G)(3).
pub fn feeder_lines(circuit: &Circuit) -> Vec<String> {
    let Circuit { node, row, .. } = circuit;
    let sets = node.conductor_sets.unwrap_or(1.0);
    let ratio = match row.ampacity {
        Some(ampacity) if row.current > 0.0 => format!(
            "{} A / {} A = {:.2}",
            num(ampacity),
            num(row.current),
            ampacity / row.current
        ),
        _ => "-".into(),
    };
    let or_dash = |value: Option<f64>| value.map_or("-".into(), num);
    let conductor = format!(
        "{}{} × {} mm² {}",
        if sets > 1.0 {
            format!("{} sets × ", num(sets))
        } else {
            String::new()
        },
        or_dash(node.conductor_qty),
        size(Some(row.conductor_size)),
        node.conductor_insulation.as_deref().unwrap_or("")
    );
    let egc = ["+ 1 ×", &egc_size(row.egc_size), "mm²"]
        .into_iter()
        .chain(circuit.text("egc_insulation"))
        .chain(["EGC"])
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    let conduit = format!(
        "in {} mm ø {}",
        conduit_size(row.conduit_size),
        node.conduit_type.as_deref().unwrap_or("")
    );
    vec![
        format!(
            "CKT {}: {} AT / {} AF, {}P",
            or_dash(node.circuit_number),
            num(row.at),
            num(row.ampere_frames),
            circuit.text("pole").unwrap_or("-")
        ),
        conductor.trim().into(),
        egc,
        conduit.trim().into(),
        format!("Ampacity/load: {ratio}"),
    ]
}

fn panel_box(tree: &RiserTree) -> (String, Vec<String>) {
    let Circuit { node, row, .. } = &tree.circuit;
    let panel = node.panel_data.as_ref();
    let phase = phase_label(panel.and_then(|p| p.phase.as_deref()));
    let voltage = if row.voltage > 0.0 {
        format!("{} V", num(row.voltage))
    } else {
        String::new()
    };
    let title = panel
        .and_then(|p| p.name.clone())
        .unwrap_or_else(|| row.load_description.clone());
    let mut lines = vec![
        [phase, voltage]
            .into_iter()
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join(" · "),
        format!("Main: {} AT / {} AF", num(row.at), num(row.ampere_frames)),
    ];
    lines.extend(branch_summary(&tree.branch_ats));
    (title, lines)
}

/// System voltages of PEC 2017 2.20.1.5(A), as the schedule header shows them.
fn supply_voltage(phase: Option<&str>) -> &'static str {
    match phase {
        Some(phases::ONE_PHASE) | Some(phases::THREE_PHASE_DELTA) => "230 V",
        Some(phases::THREE_PHASE_WYE) => "400Y/230 V",
        _ => "",
    }
}

fn source_lines(source: &HighestUnitForm, tree: &RiserTree) -> Vec<String> {
    let phase = source.phase.as_deref();
    let first = [phase_label(phase), supply_voltage(phase).to_string()]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" · ");
    let mut lines = vec![first];
    if let Some(kva) = num::positive(source.transformer_kva) {
        lines.push(format!("Transformer: {} kVA", num(kva)));
        lines.extend(transformer_lines(kva, phase, tree));
    }
    lines.extend(grounding_lines(
        num::positive(source.transformer_kva).is_some(),
        Supply::of(phase),
        tree,
    ));
    lines.extend(generator_lines(source, phase, tree));
    lines.extend(source.solar_pv.iter().flat_map(solar::service_lines));
    if let Some(kva) = num::positive(source.utility_sc_kva) {
        lines.push(format!("Utility fault level: {} kVA", num(kva)));
    }
    lines.retain(|line| !line.is_empty());
    lines
}

/// The service transformer checked against what it feeds: the load of the panels and of the
/// circuits wired straight on the supply (Article 2.20 calculates the load a source must
/// carry) and the total of the service mains, which
/// PEC 2017 Table 4.50.1.3(B) Note 2 caps at the largest secondary protection allowed.
fn transformer_lines(kva: f64, phase: Option<&str>, tree: &RiserTree) -> Vec<String> {
    let panels_va: f64 = tree.panels.iter().map(|p| p.circuit.row.va).sum();
    let load_kva = (panels_va + tree.branch_va) / 1000.0;
    let over = |exceeded: bool| if exceeded { ", OVER" } else { "" };
    let mut lines = vec![format!(
        "Load: {} kVA{}",
        num((load_kva * 100.0).round() / 100.0),
        over(load_kva > kva)
    )];
    let ocpd = sizing::rated_current(kva, phase).and_then(sizing::transformer_secondary_ocpd);
    if let Some(ocpd) = ocpd {
        let panels_at: f64 = tree.panels.iter().map(|p| p.circuit.row.at).sum();
        let mains = panels_at + tree.branch_ats.iter().sum::<f64>();
        lines.push(format!(
            "Secondary OCPD ≤ {} A{}",
            num(ocpd),
            over(mains > ocpd)
        ));
    }
    lines
}

/// The grounding at the supply, from the copper conductors it feeds: PEC 2017 Table
/// 2.50.3.17's grounding electrode conductor and 2.50.2.9(D)(1)'s bonding jumper (Table
/// 2.50.5.13(C)(1)), both by the equivalent area of those conductors. Parallel sets add,
/// and so do the sets of every circuit on the supply: Note 3 of Table 2.50.5.13(C)(1)
/// takes the largest sum of the areas of the corresponding conductors of each set, so
/// line by line, for multiple sets of service-entrance conductors (2.30.4.1 Exception
/// No. 2) or of a separately derived system's ungrounded conductors, and heda applies it
/// to every circuit on the supply. From a transformer they are the separately derived
/// system's: 2.50.2.11(A)(5) sizes its GEC and (A)(1) its system bonding jumper the same
/// way; else the service's GEC (2.50.2.5(D)) and main bonding jumper.
fn grounding_lines(transformer: bool, supply: Supply, tree: &RiserTree) -> Vec<String> {
    let area = tree
        .panels
        .iter()
        .map(|panel| set_area(panel.circuit.node, &panel.circuit.row, supply))
        .fold(tree.branch_area, add)
        .map(|lines| lines.into_iter().fold(0.0, f64::max));
    let jumper = if transformer { "System" } else { "Main" };
    // A conductor with no listed size leaves the area unknown: a size from the others
    // alone would be too small.
    let Some(area) = area else {
        return vec![
            "GEC: supply conductors unsized".into(),
            format!("{jumper} bonding jumper: unsized"),
        ];
    };
    [
        sizing::gec_size(area).map(|gec| format!("GEC ≥ {} mm² Cu", num(gec))),
        sizing::bonding_jumper_size(area)
            .map(|size| format!("{jumper} bonding jumper ≥ {} mm² Cu", num(size))),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn standby_panels(source: &HighestUnitForm) -> Vec<&str> {
    source
        .standby_panels
        .iter()
        .flatten()
        .map(String::as_str)
        .collect()
}

/// The standby generator checked against the panels it carries: PEC 2017 7.2.1.4(B)
/// calculates its load by Article 2.20, here each chosen panel's computed load (one under
/// another chosen panel counts once, with it), and (B)(2)(a) has an automatically
/// transferred source carry all of it. 4.45.1.13(A) gives its conductors' least ampacity.
fn generator_lines(source: &HighestUnitForm, phase: Option<&str>, tree: &RiserTree) -> Vec<String> {
    fn standby_va(tree: &RiserTree, standby: &[&str]) -> f64 {
        tree.panels
            .iter()
            .map(|panel| {
                if standby.contains(&panel.circuit.node.id.as_str()) {
                    panel.circuit.row.va
                } else {
                    standby_va(panel, standby)
                }
            })
            .sum()
    }
    let standby = standby_panels(source);
    let kva = num::positive(source.generator_kva);
    if standby.is_empty() && kva.is_none() {
        return Vec::new();
    }
    let load_kva = standby_va(tree, &standby) / 1000.0;
    let load = num((load_kva * 100.0).round() / 100.0);
    let Some(kva) = kva else {
        return vec![format!("Standby load: {load} kVA")];
    };
    let over = if load_kva > kva { ", OVER" } else { "" };
    let mut lines = vec![
        format!("Generator: {} kVA", num(kva)),
        format!("Standby load: {load} kVA{over}"),
    ];
    if let Some(current) = sizing::rated_current(kva, phase) {
        let ampacity = sizing::generator_conductor_ampacity(current);
        lines.push(format!(
            "Gen. conductors ≥ {} A",
            num(((ampacity * 1e7).round() / 1e6).ceil() / 10.0)
        ));
    }
    lines
}

/// A box's title and lines, for a tree at a depth.
type BoxOf<'a> = dyn Fn(&RiserTree, usize) -> (String, Vec<String>) + 'a;

fn box_height(lines: usize) -> f64 {
    PADDING * 2.0 + LINE * (lines as f64 + 1.0)
}

fn leaves(tree: &RiserTree) -> f64 {
    if tree.panels.is_empty() {
        1.0
    } else {
        tree.panels.iter().map(leaves).sum()
    }
}

/// Places the panels top-down, each centred over the panels it feeds. With a `source`,
/// `tree` is the service (the project root) and its box shows the supply; otherwise
/// `tree` is a panel and its own feeder is drawn coming in from above.
pub fn layout_riser(tree: &RiserTree, source: Option<&HighestUnitForm>) -> RiserLayout {
    let mut layout = RiserLayout::default();
    let source_lines = source.map(|s| source_lines(s, tree)).unwrap_or_default();
    let standby = source.map(standby_panels).unwrap_or_default();
    let metrics = Metrics::new();
    // Each line wraps to the box, so a long list (Branch CBs) never crosses its border.
    let fit = |(title, lines): (String, Vec<String>)| {
        let inner = BOX_WIDTH - PADDING * 2.0;
        let lines = lines
            .iter()
            .flat_map(|line| metrics.wrap_list(line, inner, FONT_SIZE, false))
            .collect();
        (title, lines)
    };
    let box_of = |node: &RiserTree, depth: usize| {
        fit(match source {
            Some(source) if depth == 0 => (
                source
                    .distribution_unit
                    .clone()
                    .unwrap_or_else(|| "Service".into()),
                source_lines.clone(),
            ),
            _ => {
                let (title, mut lines) = panel_box(node);
                if standby.contains(&node.circuit.node.id.as_str()) {
                    lines.push("On standby generator".into());
                }
                let pv = source.and_then(|s| s.solar_pv.as_ref());
                if let Some(pv) = pv.filter(|pv| pv.panel.as_deref() == Some(&node.circuit.node.id))
                {
                    let load_ocpds = node.branch_ats.iter().sum::<f64>()
                        + node.panels.iter().map(|p| p.circuit.row.at).sum::<f64>();
                    lines.extend(solar::panel_lines(pv, node.circuit.row.at, load_ocpds));
                }
                (title, lines)
            }
        })
    };

    // A level starts below the tallest box of the one above it.
    let mut level_height: Vec<f64> = Vec::new();
    fn measure(node: &RiserTree, depth: usize, level_height: &mut Vec<f64>, box_of: &BoxOf<'_>) {
        let height = box_height(box_of(node, depth).1.len());
        if level_height.len() <= depth {
            level_height.push(0.0);
        }
        level_height[depth] = level_height[depth].max(height);
        for panel in &node.panels {
            measure(panel, depth + 1, level_height, box_of);
        }
    }
    measure(tree, 0, &mut level_height, &box_of);
    let has_transformer = source.is_some_and(|s| num::positive(s.transformer_kva).is_some());
    let mut bottom = MARGIN
        + match (source, has_transformer) {
            (Some(_), true) => TRANSFORMER_SPACE,
            (Some(_), false) => 0.0,
            (None, _) => DROP,
        };
    let mut level_y = Vec::new();
    for height in &level_height {
        level_y.push(bottom);
        bottom += height + BUS + DROP;
    }

    struct Placer<'l, 'b> {
        layout: &'l mut RiserLayout,
        level_y: &'l [f64],
        box_of: &'b BoxOf<'b>,
        source: bool,
        has_transformer: bool,
    }

    impl Placer<'_, '_> {
        /// A feeder from `top` down to its panel at `bottom`: breaker, wire count, label.
        fn feeder(&mut self, circuit: &Circuit, x: f64, top: f64, bottom: f64) {
            let breaker_top = top + BREAKER_AT;
            self.layout.wires.push(vec![[x, top], [x, breaker_top]]);
            self.layout
                .wires
                .push(vec![[x, breaker_top + BREAKER_HEIGHT], [x, bottom]]);
            self.layout.breakers.push([x, breaker_top]);
            if let Some(count) = circuit.node.conductor_qty.filter(|q| *q > 0.0) {
                self.layout.ticks.push(Tick {
                    x,
                    y: top + TICKS_AT,
                    count,
                });
            }
            self.layout.labels.push(RiserLabel {
                id: circuit.node.id.clone(),
                x: x + 16.0,
                y: top + LINE + 4.0,
                lines: feeder_lines(circuit),
            });
        }

        fn place(&mut self, node: &RiserTree, depth: usize, left: f64) -> f64 {
            let cx = left + leaves(node) * COLUMN / 2.0;
            let top = self.level_y[depth];
            let (title, lines) = (self.box_of)(node, depth);
            let height = box_height(lines.len());
            self.layout.boxes.push(RiserBox {
                id: node.circuit.node.id.clone(),
                x: cx - BOX_WIDTH / 2.0,
                y: top,
                width: BOX_WIDTH,
                height,
                title,
                lines,
            });
            if depth == 0 && self.has_transformer {
                self.layout
                    .wires
                    .push(vec![[cx, MARGIN + TRANSFORMER_HEIGHT], [cx, top]]);
            }
            if depth == 0 && !self.source {
                // The start panel's own feeder, from a supply the diagram does not draw.
                self.feeder(&node.circuit, cx, top - DROP, top);
            }
            let mut child_left = left;
            let centres: Vec<f64> = node
                .panels
                .iter()
                .map(|panel| {
                    let child_cx = self.place(panel, depth + 1, child_left);
                    child_left += leaves(panel) * COLUMN;
                    child_cx
                })
                .collect();
            if !centres.is_empty() {
                let bus_y = top + height + BUS;
                let low = centres.iter().copied().fold(cx, f64::min);
                let high = centres.iter().copied().fold(cx, f64::max);
                self.layout
                    .wires
                    .push(vec![[cx, top + height], [cx, bus_y]]);
                self.layout.wires.push(vec![[low, bus_y], [high, bus_y]]);
                for (panel, centre) in node.panels.iter().zip(centres) {
                    self.feeder(&panel.circuit, centre, bus_y, self.level_y[depth + 1]);
                }
            }
            cx
        }
    }

    Placer {
        layout: &mut layout,
        level_y: &level_y,
        box_of: &box_of,
        source: source.is_some(),
        has_transformer,
    }
    .place(tree, 0, MARGIN);

    layout.width = leaves(tree) * COLUMN + MARGIN * 2.0 + LABEL_OVERHANG;
    layout.height = bottom - BUS - DROP + MARGIN;
    if source.is_some() {
        let service = &layout.boxes[0];
        let centre = service.x + service.width / 2.0;
        let base = service.y + service.height;
        if has_transformer {
            layout.transformer = Some([centre, MARGIN]);
        }
        layout.ground = Some([service.x, base]);
        layout.meter = Some([centre, base + BUS / 2.0]);
    }
    layout
}
