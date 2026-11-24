//! Bill of materials: what a panel and everything below it (or the whole project) is
//! built from, totalled from the computed rows only, so an engineer's overrides (wire,
//! EGC and conduit sizes, breaker ratings and frames, lengths) carry through.
//!
//! - Conductors: each circuit's `conductor_sets × conductor_qty` wires of its size and
//!   insulation, over its length.
//! - Equipment grounding conductors: one per circuit raceway, sized by PEC 2017 Table
//!   2.50.6.13 (the row's `egc_size`). The conduit fill (`sizing::conduit_size`) puts every
//!   set and that one EGC in a single raceway, so the run is one EGC long.
//! - Conduit: one run per circuit, of the row's size and the circuit's conduit type.
//! - Circuit breakers: one per circuit, in the panelboard that feeds it, plus a main in
//!   every panelboard fed from another panelboard. A panelboard fed straight from the
//!   supply has only its main (the service disconnecting means, PEC 2017 2.30.6.10, when
//!   the supply is the utility service).
//! - Panelboards, with their main rating and how many circuits they hold.

use crate::graph::Graph;
use crate::load_schedule::{load_row, LoadRow};
use crate::model::Node;
use crate::riser::phase_label;
use crate::sizing::{self, Conduit, Egc};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WireUse {
    /// Phase and neutral conductors.
    Conductor,
    /// Equipment grounding conductor.
    Egc,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Wire {
    #[serde(rename = "use")]
    pub use_: WireUse,
    /// mm².
    pub size: f64,
    pub insulation: String,
    /// Metres of wire, every conductor counted.
    pub length: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Breaker {
    /// Trip rating (AT).
    pub at: f64,
    /// Frame (AF).
    pub af: f64,
    pub poles: String,
    pub count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ConduitRun {
    /// Trade size, mm.
    pub size: f64,
    pub conduit_type: String,
    /// Metres.
    pub length: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Panelboard {
    pub name: String,
    pub phase: String,
    pub main_at: f64,
    pub main_af: f64,
    pub circuits: usize,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct Bom {
    pub wires: Vec<Wire>,
    pub breakers: Vec<Breaker>,
    pub conduits: Vec<ConduitRun>,
    pub panelboards: Vec<Panelboard>,
    /// Circuits with no length, so none of their wire or conduit is counted.
    pub unmeasured: Vec<String>,
    /// Circuits whose wire, EGC or conduit has no size (the schedule shows an error), so
    /// that item is left out.
    pub no_size: Vec<String>,
}

/// The bill of materials under `node_id`: a panel and everything it feeds, or at the
/// root, the whole project.
pub fn bill_of_materials(
    graph: &Graph,
    docs: &HashMap<String, Value>,
    rows: &mut HashMap<String, LoadRow>,
    node_id: &str,
) -> Result<Bom, String> {
    let top = graph.get(node_id).ok_or("Node not found")?;
    let root_id = graph.root().map(|root| root.id.as_str());
    let text = |id: &str, key: &str| -> Option<String> {
        docs.get(id)?.get(key)?.as_str().map(str::to_string)
    };

    let mut bom = Bom::default();
    let mut wires: Vec<Wire> = Vec::new();
    let mut breakers: Vec<Breaker> = Vec::new();
    let mut conduits: Vec<ConduitRun> = Vec::new();

    let mut panels: Vec<&Node> = Vec::new();
    if is_panel(top) {
        panels.push(top);
    }
    let circuits = graph.preorder(top);
    panels.extend(circuits.iter().copied().filter(|node| is_panel(node)));

    for node in &circuits {
        let row = load_row(graph, node, rows);
        let poles = text(&node.id, "pole").unwrap_or_default();
        add_breaker(&mut breakers, row.at, row.ampere_frames, poles);

        let Some(length) = sizing::overridden(node.overrided_length)
            .or(node.length)
            .filter(|l| *l > 0.0)
        else {
            bom.unmeasured.push(row.load_description.clone());
            continue;
        };
        let wires_per_run = node.conductor_sets.unwrap_or(1.0) * node.conductor_qty.unwrap_or(0.0);
        let mut sized = true;
        if row.conductor_size.is_finite() && row.conductor_size > 0.0 {
            add_wire(
                &mut wires,
                WireUse::Conductor,
                row.conductor_size,
                node.conductor_insulation.clone().unwrap_or_default(),
                length * wires_per_run,
            );
        } else {
            sized = false;
        }
        match row.egc_size {
            Egc::Size(size) if size > 0.0 => add_wire(
                &mut wires,
                WireUse::Egc,
                size,
                text(&node.id, "egc_insulation").unwrap_or_default(),
                length,
            ),
            _ => sized = false,
        }
        match row.conduit_size {
            Conduit::Size(size) if size > 0.0 => {
                let conduit_type = node.conduit_type.clone().unwrap_or_default();
                match conduits
                    .iter_mut()
                    .find(|c| c.size == size && c.conduit_type == conduit_type)
                {
                    Some(run) => run.length += length,
                    None => conduits.push(ConduitRun {
                        size,
                        conduit_type,
                        length,
                    }),
                }
            }
            _ => sized = false,
        }
        if !sized {
            bom.no_size.push(row.load_description.clone());
        }
    }

    for panel in &panels {
        let row = load_row(graph, panel, rows);
        let fed_by_panel = panel
            .parent_id
            .as_deref()
            .is_some_and(|parent| Some(parent) != root_id);
        // A top panel fed from the supply is not among `circuits`, so its main is counted here.
        if fed_by_panel || panel.id == top.id {
            let poles = text(&panel.id, "pole").unwrap_or_default();
            add_breaker(&mut breakers, row.at, row.ampere_frames, poles);
        }
        bom.panelboards.push(Panelboard {
            name: panel
                .panel_data
                .as_ref()
                .and_then(|p| p.name.clone())
                .unwrap_or(row.load_description),
            phase: phase_label(panel.panel_data.as_ref().and_then(|p| p.phase.as_deref())),
            main_at: row.at,
            main_af: row.ampere_frames,
            circuits: graph.children(&panel.id).count(),
        });
    }

    for wire in &mut wires {
        wire.length = metres(wire.length);
    }
    for run in &mut conduits {
        run.length = metres(run.length);
    }
    wires.sort_by(|a, b| {
        (a.use_, &a.insulation)
            .cmp(&(b.use_, &b.insulation))
            .then(a.size.total_cmp(&b.size))
    });
    breakers.sort_by(|a, b| {
        a.at.total_cmp(&b.at)
            .then(a.af.total_cmp(&b.af))
            .then(a.poles.cmp(&b.poles))
    });
    conduits.sort_by(|a, b| {
        a.conduit_type
            .cmp(&b.conduit_type)
            .then(a.size.total_cmp(&b.size))
    });
    bom.wires = wires;
    bom.breakers = breakers;
    bom.conduits = conduits;
    Ok(bom)
}

fn is_panel(node: &Node) -> bool {
    node.node_type == "panel"
}

fn add_wire(wires: &mut Vec<Wire>, use_: WireUse, size: f64, insulation: String, length: f64) {
    match wires
        .iter_mut()
        .find(|w| w.use_ == use_ && w.size == size && w.insulation == insulation)
    {
        Some(wire) => wire.length += length,
        None => wires.push(Wire {
            use_,
            size,
            insulation,
            length,
        }),
    }
}

fn add_breaker(breakers: &mut Vec<Breaker>, at: f64, af: f64, poles: String) {
    if !(at.is_finite() && at > 0.0) {
        return;
    }
    match breakers
        .iter_mut()
        .find(|b| b.at == at && b.af == af && b.poles == poles)
    {
        Some(breaker) => breaker.count += 1,
        None => breakers.push(Breaker {
            at,
            af,
            poles,
            count: 1,
        }),
    }
}

/// A sum of lengths to the centimetre, without float noise (0.1 + 0.2).
fn metres(length: f64) -> f64 {
    (length * 100.0).round() / 100.0
}
