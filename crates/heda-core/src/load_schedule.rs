//! Load-schedule rows: what the engine adds to a node, shown in its parent's load
//! schedule and, the same values, in the node's own sidebar entry and page header.

use crate::graph::Graph;
use crate::js;
use crate::model::Node;
use crate::phases::{self, CircuitTotal, LineCurrent, PairVa, PhaseVa, Supply};
use crate::sizing::{self, ConductorInput, Conduit, Egc, Rating, Sizing};
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
    pub conduit_size: Conduit,
    pub ampere_frames: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase_va: Option<PhaseVa>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pair_va: Option<PairVa>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_current: Option<LineCurrent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balanced_current: Option<f64>,
    /// What the circuit adds to its panel's feeder load.
    #[serde(skip)]
    pub feeder: FeederShare,
}

/// A circuit's share of its panel's feeder load, PEC 2017 2.15.1.2(A)(1) and 4.30.2.4:
/// 125 % of its continuous and 100 % of its noncontinuous non-motor load, plus each
/// motor's full-load current; and the largest motor at or below it, whose extra 25 % (and,
/// for the main's breaker, branch breaker) the panel adds once.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct FeederShare {
    pub va: f64,
    pub current: f64,
    pub largest_motor: Option<Motor>,
}

/// A motor circuit as a feeder sees it: VA, full-load current and branch breaker.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Motor {
    pub va: f64,
    pub current: f64,
    pub at: f64,
}

/// Fields every circuit shares: single-phase circuits run at 230 V (line to neutral
/// on 400Y/230 V, line to line on delta), three-phase ones at the supply's
/// line-to-line voltage (PEC 2017 2.20.1.5(A); App. D Ex. D6, D14).
fn voltage_and_phase(node: &Node, supply: Supply) -> (f64, String) {
    let voltage = if phases::is_three_phase_circuit(node) {
        supply.line_voltage()
    } else {
        230.0
    };
    (voltage, phases::circuit_phase(node, supply).to_owned())
}

/// VA and current of a node's own load (0 for a panel or the root).
fn own_load(node: &Node, supply: Supply) -> (f64, f64) {
    let load_data = node.load_data.as_ref();
    let va = sizing::volt_ampere(
        node.load_type(),
        load_data.and_then(|d| d.quantity).unwrap_or(0.0),
        or_zero(js::number(load_data.and_then(|d| d.varies.as_ref()))),
        supply.line_voltage(),
    );
    let va = or_zero(va);
    let current = if phases::is_three_phase_circuit(node) {
        phases::three_phase_current_at(va, supply.line_voltage())
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
    memo: &mut HashMap<String, LoadRow>,
) -> LoadRow {
    if let Some(row) = memo.get(&node.id) {
        return row.clone();
    }
    let supply = phases::supply_of(node.parent_id.as_deref().and_then(|id| graph.get(id)));
    let (voltage, phase) = voltage_and_phase(node, supply);
    let load_type = node.load_type();
    let ambient_temp = js::or(
        node.load_data.as_ref().and_then(|d| d.ambient_temperature),
        30.0,
    );
    let (va, current) = own_load(node, supply);
    let input = |current: f64, at: f64, sizing: Sizing<'g>, ambient_temp: f64| ConductorInput {
        sets: count(node.conductor_sets),
        qty: count(node.conductor_qty),
        ambient_temp,
        sizing,
        at,
        current,
        rating: Rating::of(node.conductor_insulation.as_deref()),
    };
    let load_data = node.load_data.as_ref();
    let continuous = load_data.and_then(|d| d.continuous).unwrap_or(true);
    let dwelling_circuit = load_data
        .and_then(|d| d.dwelling_circuit.as_deref())
        .is_some_and(|c| sizing::DWELLING_CIRCUITS.contains(&c));
    let at = js::or(
        node.overrided_at,
        sizing::ampere_trip(current, load_type, continuous, dwelling_circuit),
    );
    let own_sizing = input(current, at, Sizing::of(load_type), ambient_temp);
    let conductor_size = js::or(
        node.overrided_conductor_size,
        sizing::conductor_size(own_sizing),
    );

    let row = if let Some(panel_data) = &node.panel_data {
        let circuits: Vec<(&Node, LoadRow)> = graph
            .children(&node.id)
            .map(|child| (child, load_row(graph, child, memo)))
            .collect();
        let totals = phases::panel_totals(
            node,
            &circuits
                .iter()
                .map(|(_, row)| CircuitTotal {
                    va: row.va,
                    current: row.current,
                    phase: &row.phase,
                })
                .collect::<Vec<_>>(),
        );
        let feeder = feeder_load(node, &circuits);
        let main_at = js::or(
            node.overrided_at,
            service_rating(
                graph,
                node,
                sizing::feeder_trip(feeder.load, feeder.ceiling),
                memo,
            ),
        );
        let main_current = js::round_js(totals.current, 2);
        let ambient_temp = js::or(panel_data.ambient_temperature, 30.0);
        let main_sizing = if feeder.share.largest_motor.is_some() {
            input(feeder.load, main_at, Sizing::MotorFeeder, ambient_temp)
        } else {
            input(main_current, main_at, Sizing::Main, ambient_temp)
        };
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
            conduit_size: conduit(node, main_conductor_size),
            ampere_frames: js::or(node.overrided_ampere_frames, main_at),
            phase_va: totals.phase_va,
            pair_va: totals.pair_va,
            line_current: totals.line_current,
            balanced_current: totals.balanced_current,
            feeder: feeder.share,
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
            conduit_size: conduit(node, conductor_size),
            ampere_frames: js::or(node.overrided_ampere_frames, at),
            phase_va: None,
            pair_va: None,
            line_current: None,
            balanced_current: None,
            feeder: if sizing::is_motor(load_type) {
                FeederShare {
                    va,
                    current,
                    largest_motor: Some(Motor { va, current, at }),
                }
            } else {
                // An unknown load type has no factor; it adds its VA as it is.
                let factor = sizing::load_factor(load_type, continuous).unwrap_or(1.0);
                FeederShare {
                    va: va * factor,
                    current: current * factor,
                    largest_motor: None,
                }
            },
        }
    };
    memo.insert(node.id.clone(), row.clone());
    row
}

/// A panel's feeder: its `load` (2.15.1.2(A)(1), 4.30.2.4), the `ceiling` of a motor
/// feeder's breaker (4.30.5.2(A), 4.30.5.3), and what it adds to its own panel.
struct Feeder {
    load: f64,
    ceiling: f64,
    share: FeederShare,
}

/// The circuits' feeder shares through the panel's own phase totals, plus the largest
/// motor once: 25 % more of its full-load current for the load, and its branch breaker in
/// place of that current for the ceiling (App. D Ex. D10).
// shortcut: the largest motor is the one with the highest full-load current (4.30.2.4(1)),
// whose breaker 4.30.5.2(A) then takes as the largest; true unless a smaller motor has a
// larger breaker override.
fn feeder_load(panel: &Node, circuits: &[(&Node, LoadRow)]) -> Feeder {
    let motor = largest(circuits);
    let total = |extra: f64| {
        let mut parts: Vec<CircuitTotal> = circuits
            .iter()
            .map(|(_, row)| CircuitTotal {
                va: row.feeder.va,
                current: row.feeder.current,
                phase: &row.phase,
            })
            .collect();
        if let Some((motor, phase)) = motor {
            parts.push(CircuitTotal {
                va: motor.va * extra,
                current: motor.current * extra,
                phase,
            });
        }
        phases::panel_totals(panel, &parts).current
    };
    let load = total(0.25);
    let ceiling = match motor {
        Some((motor, _)) if motor.current > 0.0 => total(motor.at / motor.current - 1.0),
        _ => load,
    };
    Feeder {
        load,
        ceiling: ceiling.max(load),
        share: FeederShare {
            va: circuits.iter().fold(0.0, |va, (_, row)| va + row.feeder.va),
            current: total(0.0),
            largest_motor: motor.map(|(motor, _)| motor),
        },
    }
}

/// The motor with the highest full-load current at or below the circuits, and the phase
/// of the circuit it is on.
fn largest<'r>(circuits: &'r [(&Node, LoadRow)]) -> Option<(Motor, &'r str)> {
    circuits
        .iter()
        .filter_map(|(_, row)| row.feeder.largest_motor.map(|m| (m, row.phase.as_str())))
        .fold(None, |best, (motor, phase)| match best {
            Some((top, _)) if top.current >= motor.current => best,
            _ => Some((motor, phase)),
        })
}

/// The rating of `panel`'s main when it is the service disconnecting means: the first
/// panel the utility service feeds. PEC 2017 2.30.6.10 sets its minimum (30 A for no
/// more than two 2-wire branch circuits, (C); 60 A otherwise, (D) and (E)), and
/// 2.30.6.11 lets every disconnect on the service count toward it, so this one makes
/// up what the others lack. Any other panel keeps `at`.
fn service_rating(
    graph: &Graph,
    panel: &Node,
    at: f64,
    memo: &mut HashMap<String, LoadRow>,
) -> f64 {
    let Some(supply) = panel.parent_id.as_deref().and_then(|id| graph.get(id)) else {
        return at;
    };
    let is_service = supply.node_type == "root"
        && supply.highest_unit_form.as_ref().and_then(|f| f.is_service) != Some(false);
    let is_first_panel = graph
        .children(&supply.id)
        .find(|child| child.panel_data.is_some())
        .is_some_and(|first| first.id == panel.id);
    if !is_service || !is_first_panel {
        return at;
    }
    let branch_circuits: Vec<&Node> = graph
        .preorder(supply)
        .into_iter()
        .filter(|node| node.load_data.is_some() && node.panel_data.is_none())
        .collect();
    let minimum = if branch_circuits.len() <= 2
        && branch_circuits.iter().all(|c| c.conductor_qty == Some(2.0))
    {
        30.0
    } else {
        60.0
    };
    let others: f64 = graph
        .children(&supply.id)
        .filter(|child| child.id != panel.id)
        .map(|child| load_row(graph, child, memo).at)
        .sum();
    let needed = minimum - others;
    if at >= needed {
        return at;
    }
    crate::tables::STANDARD_AMPERE_RATINGS
        .into_iter()
        .find(|rating| *rating >= needed)
        .unwrap_or(at)
}
