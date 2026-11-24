//! Selective coordination, PEC 2017 only. The PEC defines it (Article 1.0, "Coordination,
//! Selective": the fault localized to the circuit affected, by the devices' ratings or
//! settings, "for the full range of available overcurrents, from overload to the maximum
//! available fault current") and requires it of every overcurrent device of these
//! systems "with all supply-side overcurrent protective devices":
//!
//! - emergency systems, 7.0.6.3;
//! - legally required standby systems, 7.1.4.3;
//! - critical operations power systems, 7.8.4.5;
//! - critical operations data systems, 6.45.1.27.
//!
//! The PEC gives no trip curves: it has a licensed professional electrical engineer
//! select the coordination and document it. So this lists each pair the PEC requires,
//! with the available fault current at the downstream device (what a manufacturer's
//! selectivity table is read at), and settles only what the PEC and the ratings decide:
//!
//! - the Exception of 7.0.6.3, 7.1.4.3 and 7.8.4.5: two devices in series with no load
//!   in parallel with the downstream one need not be coordinated (6.45.1.27 has none);
//! - a downstream device rated at or above its supply-side device cannot localize an
//!   overload, so that pair is not selective by the definition;
//! - otherwise the engineer's documented selection (`coordination_reference`), else the
//!   pair still needs one.

use crate::graph::Graph;
use crate::load_schedule::{load_row, LoadRow};
use crate::model::Node;
use crate::short_circuit::ShortCircuitRow;
use serde::Serialize;
use std::collections::HashMap;

/// A system whose devices the PEC requires to be selectively coordinated.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum System {
    Emergency,
    LegallyRequiredStandby,
    CriticalOperationsPower,
    CriticalOperationsData,
}

impl System {
    pub fn of(value: Option<&str>) -> Option<Self> {
        match value? {
            "emergency" => Some(System::Emergency),
            "legally_required_standby" => Some(System::LegallyRequiredStandby),
            "critical_operations_power" => Some(System::CriticalOperationsPower),
            "critical_operations_data" => Some(System::CriticalOperationsData),
            _ => None,
        }
    }

    /// The PEC 2017 section that requires the coordination.
    pub fn section(self) -> &'static str {
        match self {
            System::Emergency => "7.0.6.3",
            System::LegallyRequiredStandby => "7.1.4.3",
            System::CriticalOperationsPower => "7.8.4.5",
            System::CriticalOperationsData => "6.45.1.27",
        }
    }

    /// Whether the section has the series Exception (6.45.1.27 has none).
    fn series_exception(self) -> bool {
        self != System::CriticalOperationsData
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Status {
    /// The Exception: in series with nothing in parallel with the downstream device.
    Exempt,
    /// The downstream device is rated at or above the supply-side one.
    NotSelective,
    /// The engineer's documented selection.
    Documented { reference: String },
    /// Required, and not yet documented.
    NeedsDocumentation,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    /// Trip rating (AT) and frame (AF).
    pub at: f64,
    pub af: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Pair {
    pub system: System,
    pub section: &'static str,
    pub upstream: Device,
    pub downstream: Device,
    /// Available fault current at the downstream device's line terminals (A), from the short circuit study.
    pub available_fault_current: Option<f64>,
    pub status: Status,
}

/// Every pair of overcurrent devices the PEC requires to be selectively coordinated, each
/// device of a listed system with each supply-side device up to the supply, nearest first.
pub fn coordination(
    graph: &Graph,
    rows: &mut HashMap<String, LoadRow>,
    faults: &[ShortCircuitRow],
) -> Vec<Pair> {
    let Some(root) = graph.root() else {
        return Vec::new();
    };
    // At each device's line terminals (1.10.1.9): a panel's main sits at its own bus, the
    // end of its feeder; a circuit's breaker sits in the panel that feeds it.
    let fault_at: HashMap<&str, f64> = faults
        .iter()
        .filter_map(|row| {
            let is_panel = graph.get(&row.id)?.node_type == "panel";
            let current = if is_panel {
                row.node_fault_current
            } else {
                row.supply_fault_current
            };
            Some((row.id.as_str(), current?))
        })
        .collect();
    let mut pairs = Vec::new();
    for node in graph.preorder(root) {
        let Some(system) = system_of(graph, node) else {
            continue;
        };
        let downstream = device(graph, node, rows);
        // The supply-side devices: the main of each panel above, up to the supply.
        let mut fed = node;
        while let Some(panel) = parent(graph, fed).filter(|p| p.node_type == "panel") {
            let upstream = device(graph, panel, rows);
            let status = if system.series_exception() && in_series(graph, panel, node) {
                Status::Exempt
            } else if downstream.at >= upstream.at {
                Status::NotSelective
            } else {
                match node
                    .coordination_reference
                    .as_deref()
                    .map(str::trim)
                    .filter(|r| !r.is_empty())
                {
                    Some(reference) => Status::Documented {
                        reference: reference.to_string(),
                    },
                    None => Status::NeedsDocumentation,
                }
            };
            pairs.push(Pair {
                system,
                section: system.section(),
                upstream,
                downstream: downstream.clone(),
                available_fault_current: fault_at.get(node.id.as_str()).copied(),
                status,
            });
            fed = panel;
        }
    }
    pairs
}

fn parent<'g>(graph: &'g Graph, node: &Node) -> Option<&'g Node> {
    graph.get(node.parent_id.as_deref()?)
}

/// The listed system a circuit belongs to: its own (a panel's) or the nearest panel's above,
/// except that anything below a critical operations data panel stays under 6.45.1.27, which
/// has no series Exception, whatever a panel between them is marked.
fn system_of(graph: &Graph, node: &Node) -> Option<System> {
    let mut nearest = None;
    let mut current = Some(node);
    while let Some(n) = current {
        let system = System::of(n.panel_data.as_ref().and_then(|p| p.system.as_deref()));
        if system == Some(System::CriticalOperationsData) {
            return system;
        }
        nearest = nearest.or(system);
        current = parent(graph, n);
    }
    nearest
}

/// Whether `node` is the only load on `panel`'s device: every panel from `panel` down to
/// `node` feeds just the next one, so nothing is connected in parallel with it.
fn in_series(graph: &Graph, panel: &Node, node: &Node) -> bool {
    let mut current = node;
    while let Some(up) = parent(graph, current) {
        if graph.children(&up.id).count() != 1 {
            return false;
        }
        if up.id == panel.id {
            return true;
        }
        current = up;
    }
    false
}

fn device(graph: &Graph, node: &Node, rows: &mut HashMap<String, LoadRow>) -> Device {
    let row = load_row(graph, node, rows);
    Device {
        id: node.id.clone(),
        name: node
            .schedule_name()
            .unwrap_or_else(|| row.load_description.clone()),
        at: row.at,
        af: row.ampere_frames,
    }
}
