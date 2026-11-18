//! Load-schedule rows: what the engine adds to a node, shown in its parent's load
//! schedule and, the same values, in the node's own sidebar entry and page header.

use crate::graph::Graph;
use crate::js;
use crate::model::Node;
use crate::phases::{self, CircuitTotal, PhaseVa};
use crate::sizing::{self, ConductorInput, Conduit, Egc, Sizing, WYE_LINE_VOLTAGE};
use serde::Serialize;
use std::collections::HashMap;

/// What the engine adds to a node for one load-schedule row.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct LoadRow {
    pub load_description: String,
    pub voltage: f64,
    pub phase: String,
    pub va: f64,
    pub at: f64,
    pub current: f64,
    pub conductor_size: f64,
    pub egc_size: Egc,
    pub adjusted_current: f64,
    pub conduit_size: Conduit,
    pub ampere_frames: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase_va: Option<PhaseVa>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balanced_current: Option<f64>,
}

/// Fields every circuit shares: single-phase circuits run at 230 V, three-phase ones
/// line-to-line at 400 V (PEC 2017 2.20.1.5(A); App. D Ex. D6).
fn voltage_and_phase(node: &Node) -> (f64, String) {
    let voltage = if phases::is_three_phase_circuit(node) {
        WYE_LINE_VOLTAGE
    } else {
        230.0
    };
    (voltage, phases::circuit_phase(node).to_owned())
}

/// VA and current of a node's own load (0 for a panel or the root).
fn own_load(node: &Node) -> (f64, f64) {
    let load_data = node.load_data.as_ref();
    let va = sizing::volt_ampere(
        node.load_type(),
        load_data.and_then(|d| d.quantity).unwrap_or(0.0),
        or_zero(js::number(load_data.and_then(|d| d.varies.as_ref()))),
    );
    let va = or_zero(va);
    let current = if phases::is_three_phase_circuit(node) {
        phases::three_phase_current(va)
    } else {
        va / 230.0
    };
    (va, current)
}

/// `x || 0`.
fn or_zero(value: f64) -> f64 {
    if js::truthy(value) {
        value
    } else {
        0.0
    }
}

/// `conductor_sets` / `conductor_qty` read `as number`: absent is NaN in the arithmetic.
fn count(value: Option<f64>) -> f64 {
    value.unwrap_or(f64::NAN)
}

fn conduit(node: &Node, conductor_size: f64) -> Conduit {
    match sizing::overridden(node.overrided_conduit_size) {
        Some(size) => Conduit::Size(size),
        None => sizing::conduit_size(
            conductor_size,
            count(node.conductor_sets) * count(node.conductor_qty) + 1.0,
        ),
    }
}

fn egc(node: &Node, at: f64) -> Egc {
    sizing::overridden(node.overrided_egc_size).map_or_else(|| sizing::egc_size(at), Egc::Size)
}

/// One load-schedule row, memoized per node. A panel's row totals its circuits.
pub fn load_row<'g>(
    graph: &'g Graph,
    node: &'g Node,
    is_dynamic: bool,
    memo: &mut HashMap<String, LoadRow>,
) -> LoadRow {
    if let Some(row) = memo.get(&node.id) {
        return row.clone();
    }
    let (voltage, phase) = voltage_and_phase(node);
    let load_type = node.load_type();
    let ambient_temp = js::or(
        node.load_data.as_ref().and_then(|d| d.ambient_temperature),
        30.0,
    );
    let (va, current) = own_load(node);
    let input = |current: f64, at: f64, sizing: Sizing<'g>, ambient_temp: f64| ConductorInput {
        sets: count(node.conductor_sets),
        qty: count(node.conductor_qty),
        ambient_temp,
        sizing,
        at,
        current,
        is_dynamic,
    };
    let at = js::or(node.overrided_at, sizing::ampere_trip(current, load_type));
    let own_sizing = input(current, at, Sizing::of(load_type), ambient_temp);
    let conductor_size = js::or(
        node.overrided_conductor_size,
        sizing::conductor_size(own_sizing),
    );
    let adjusted_current = sizing::adjusted_current(own_sizing);

    let row = if let Some(panel_data) = &node.panel_data {
        let circuits: Vec<(&Node, LoadRow)> = graph
            .children(&node.id)
            .map(|child| (child, load_row(graph, child, is_dynamic, memo)))
            .collect();
        let totals = phases::panel_totals(
            node,
            &circuits
                .iter()
                .map(|(child, row)| CircuitTotal {
                    node: child,
                    va: row.va,
                    current: row.current,
                })
                .collect::<Vec<_>>(),
        );
        let main_at = js::or(node.overrided_at, sizing::ampere_trip(totals.current, None));
        let main_current = js::round_js(totals.current, 2);
        let main_sizing = input(
            main_current,
            main_at,
            Sizing::Main,
            js::or(panel_data.ambient_temperature, 30.0),
        );
        let main_conductor_size = js::or(
            node.overrided_conductor_size,
            sizing::conductor_size(main_sizing),
        );
        LoadRow {
            load_description: js::or_str(panel_data.name.as_deref(), "").to_owned(),
            voltage,
            phase,
            va: totals.va,
            at: main_at,
            current: main_current,
            conductor_size: main_conductor_size,
            // PEC 2017 Table 2.50.6.13 sizes the EGC on the overcurrent device ahead of it: the main.
            egc_size: egc(node, main_at),
            adjusted_current: sizing::adjusted_current(main_sizing),
            conduit_size: conduit(node, main_conductor_size),
            ampere_frames: js::or(node.overrided_ampere_frames, main_at),
            phase_va: totals.wye.map(|(phase_va, _)| phase_va),
            balanced_current: totals.wye.map(|(_, balanced)| balanced),
        }
    } else {
        LoadRow {
            load_description: js::or_str(
                node.load_data
                    .as_ref()
                    .and_then(|d| d.load_description.as_deref()),
                "",
            )
            .to_owned(),
            voltage,
            phase,
            va,
            at,
            current: js::round_js(current, 2),
            conductor_size,
            egc_size: egc(node, at),
            adjusted_current,
            conduit_size: conduit(node, conductor_size),
            ampere_frames: js::or(node.overrided_ampere_frames, at),
            phase_va: None,
            balanced_current: None,
        }
    };
    memo.insert(node.id.clone(), row.clone());
    row
}
