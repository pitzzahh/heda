//! Voltage drop of every run, ported from `walkVoltageDrops` in
//! `src/lib/db/queries/voltage-drop-core.ts`.

use crate::graph::Graph;
use crate::load_schedule::{load_row, LoadRow};
use crate::num;
use crate::sizing::SQRT_3;
use crate::tables::{lookup, ALTERNATING_CURRENT_REACTANCE};
use serde::Serialize;
use std::collections::HashMap;

/// What the engine adds to a node's load row for its voltage-drop row.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct VoltageDropRow {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub z: Option<f64>,
    pub actual_z: f64,
    pub voltage_per_segment: f64,
    pub voltage_at_end_circuit: f64,
    pub voltage_at_receiving_end: f64,
    pub percent_voltage_drop: f64,
    pub from_node_name: String,
    pub to_node_name: String,
    /// The breaker rating when the circuit is set to use it as its current.
    pub current: f64,
    /// Absent when the run has no length entered.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<f64>,
}

/// One row per node in preorder (each node, then its subtree).
pub fn voltage_drops(graph: &Graph, memo: &mut HashMap<String, LoadRow>) -> Vec<VoltageDropRow> {
    let Some(root) = graph.root() else {
        return Vec::new();
    };
    // Drop at the end of each node's run, as a fraction of that run's nominal voltage,
    // so a 230 V branch can continue from a 400 V feeder.
    let mut end_fraction: HashMap<&str, f64> = HashMap::new();
    let mut rows = Vec::new();
    for node in graph.preorder(root) {
        let computed = load_row(graph, node, memo);
        let parent = node.parent_id.as_deref().and_then(|id| graph.get(id));
        let parent_end_fraction = node
            .parent_id
            .as_deref()
            .and_then(|id| end_fraction.get(id).copied());
        // PEC 2017 App. D Ex. D15: VD = k·I·Z, k = 1.732 for three-phase (line to line:
        // 400 V on wye, 230 V on delta) and 2 for single-phase (230 V), over the
        // circuit's own nominal voltage.
        let is_three_phase = computed.phase == crate::phases::ALL_PHASES;
        let nominal_voltage = computed.voltage;
        let k = if is_three_phase { SQRT_3 } else { 2.0 };
        let conductor_size =
            num::positive(node.overrided_conductor_size).unwrap_or(computed.conductor_size);
        let length = crate::sizing::overridden(node.overrided_length).or(node.length);
        let z = crate::sizing::overridden(node.overrided_z)
            .or_else(|| lookup(&ALTERNATING_CURRENT_REACTANCE, conductor_size).copied());
        // Ohms of this run: Table 10.1.1.9 gives Ω per 305 m. D15 carries it unrounded
        // into VD (1.732 × 295 A × 0.0561 Ω × 15.2 / 305 = 1.428 V); 0.0001 Ω is display only.
        // Parallel sets (3.10.2.1(H)) each carry an equal share, so the run is Z / sets,
        // as in the short-circuit study.
        let sets = num::positive(node.conductor_sets).unwrap_or(1.0);
        let run_z = (length.unwrap_or(f64::NAN) * z.unwrap_or(f64::NAN)) / 305.0 / sets;
        let actual_z = num::round(run_z, 4);
        let voltage_per_segment = num::round(k * computed.current * run_z, 4);
        // Parents come first in preorder; the root (and a feeder with no drop) adds nothing.
        let voltage_at_end_circuit = num::round(
            parent_end_fraction.unwrap_or(0.0) * nominal_voltage + voltage_per_segment,
            4,
        );
        let voltage_at_receiving_end = nominal_voltage - voltage_at_end_circuit;
        let percent_voltage_drop = num::round(
            (1.0 - voltage_at_receiving_end / nominal_voltage) * 100.0,
            4,
        );
        end_fraction.insert(&node.id, voltage_at_end_circuit / nominal_voltage);
        rows.push(VoltageDropRow {
            id: node.id.clone(),
            z,
            actual_z,
            voltage_per_segment,
            voltage_at_end_circuit,
            voltage_at_receiving_end,
            percent_voltage_drop,
            from_node_name: from_node_name(parent),
            to_node_name: to_node_name(node),
            current: if node.is_at_used_as_currents_value == Some(true) {
                computed.at
            } else {
                computed.current
            },
            length,
        });
    }
    rows
}

/// The supplying node's name: the root's distribution unit, else the panel's name.
pub fn from_node_name(parent: Option<&crate::model::Node>) -> String {
    let unit = parent
        .and_then(|p| p.highest_unit_form.as_ref())
        .and_then(|h| h.distribution_unit.as_deref());
    let panel = parent
        .and_then(|p| p.panel_data.as_ref())
        .and_then(|d| d.name.as_deref());
    num::text(unit)
        .or(num::text(panel))
        .unwrap_or("")
        .to_owned()
}

/// The node's own name: a panel's name, else the load's description.
pub fn to_node_name(node: &crate::model::Node) -> String {
    let panel = node.panel_data.as_ref().and_then(|d| d.name.as_deref());
    let load = node
        .load_data
        .as_ref()
        .and_then(|d| d.load_description.as_deref());
    num::text(panel)
        .or(num::text(load))
        .unwrap_or("")
        .to_owned()
}
