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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unbalance: Option<f64>,
    /// Allowable ampacity of the circuit's conductors, all sets (`sizing::allowable_ampacity`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ampacity: Option<f64>,
    /// On a three-phase supply, what the circuit puts on each of its phases or line
    /// pairs, in the supply's label order (`phase_loads`); `None` where it puts nothing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase_loads: Option<[Option<f64>; 3]>,
    /// A motor's largest overload relay rating (`sizing::overload_rating`), when its
    /// nameplate current is given.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overload: Option<f64>,
    /// What the circuit adds to its panel's feeder load.
    #[serde(skip)]
    pub feeder: FeederShare,
}

/// A circuit's share of its panel's feeder load, PEC 2017 2.15.1.2(A)(1) and 4.30.2.4:
/// 125 % of its continuous and 100 % of its noncontinuous non-motor load, plus each
/// motor's full-load current. Also the motor at or below it with the highest full-load
/// current, whose extra 25 % the feeder load adds once (4.30.2.4(1)), and the one with the
/// largest branch breaker, which the breaker's ceiling takes in place of its full-load
/// current (4.30.5.2(A)); usually the same motor, not when a breaker is overridden.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct FeederShare {
    pub va: f64,
    pub current: f64,
    pub largest_motor: Option<Motor>,
    pub largest_breaker: Option<Motor>,
    /// A three-phase panel's share per phase (3P-Y) and line pair (delta), so the feeder
    /// above it carries its imbalance.
    pub phase_va: Option<PhaseVa>,
    pub pair_va: Option<PairVa>,
}

impl FeederShare {
    /// The share as the panel's supply sees it: a single-phase panel puts its motors on
    /// its own phase there; a three-phase one keeps theirs, its phases being the supply's.
    fn on(self, phase: &'static str) -> Self {
        if phase == phases::ALL_PHASES {
            return self;
        }
        let on = |motor: Option<Motor>| motor.map(|m| Motor { phase, ..m });
        FeederShare {
            largest_motor: on(self.largest_motor),
            largest_breaker: on(self.largest_breaker),
            ..self
        }
    }
}

/// A motor circuit as a feeder sees it: VA, full-load current, branch breaker, and the
/// phase it loads on the panel counting it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Motor {
    pub va: f64,
    pub current: f64,
    pub at: f64,
    pub phase: &'static str,
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
        // No conductor fits, so neither does a conduit: -1, "none in the table".
        None if conductor_size == -1.0 => Conduit::Size(-1.0),
        None => sizing::conduit_size(
            conductor_size,
            count(node.conductor_sets) * count(node.conductor_qty) + 1.0,
            Rating::of(node.conductor_insulation.as_deref()),
        ),
    }
}

/// The engineer's EGC, else Table 2.50.6.13's for `at`, grown by 2.50.6.13(B) when the
/// conductors are upsized from `minimum` (what carries the load) to `conductor_size`.
fn egc(node: &Node, at: f64, conductor_size: f64, minimum: f64) -> Egc {
    if let Some(size) = sizing::overridden(node.overrided_egc_size) {
        return Egc::Size(size);
    }
    match sizing::egc_size(at) {
        Egc::Size(table) => Egc::Size(sizing::egc_increased(table, conductor_size, minimum)),
        other => other,
    }
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
    let label = phases::label(&phase);
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
    let minimum_size = sizing::conductor_size(own_sizing);
    let conductor_size = sizing::overridden(node.overrided_conductor_size).unwrap_or(minimum_size);

    let mut row = if let Some(panel_data) = &node.panel_data {
        let panel_supply = Supply::of(node.panel_phase());
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
                    split: split(panel_supply, row.phase_va, row.pair_va),
                })
                .collect::<Vec<_>>(),
        );
        let feeder = feeder_load(node, &circuits);
        let trip = sizing::feeder_trip(feeder.load, feeder.ceiling);
        let service_at = service_rating(graph, node, trip, memo);
        let main_at = js::or(node.overrided_at, service_at);
        let main_current = js::round_js(totals.current, 2);
        let ambient_temp = js::or(panel_data.ambient_temperature, 30.0);
        let main_sizing = if feeder.share.largest_motor.is_some() {
            // 2.30.7.1(A): a service main raised to its 2.30.6.10 minimum is no motor
            // breaker, so the service conductors carry at least that rating.
            let floor = if service_at > trip { service_at } else { 0.0 };
            input(
                feeder.load.max(floor),
                main_at,
                Sizing::MotorFeeder,
                ambient_temp,
            )
        } else {
            input(main_current, main_at, Sizing::Main, ambient_temp)
        };
        let main_minimum_size = sizing::conductor_size(main_sizing);
        let main_conductor_size =
            sizing::overridden(node.overrided_conductor_size).unwrap_or(main_minimum_size);
        LoadRow {
            load_description: js::or_str(panel_data.name.as_deref(), "").to_owned(),
            voltage,
            phase,
            va: totals.va,
            at: main_at,
            current: main_current,
            conductor_size: main_conductor_size,
            // PEC 2017 Table 2.50.6.13 sizes the EGC on the overcurrent device ahead of it: the main.
            egc_size: egc(node, main_at, main_conductor_size, main_minimum_size),
            conduit_size: conduit(node, main_conductor_size),
            ampere_frames: js::or(node.overrided_ampere_frames, main_at),
            phase_va: totals.phase_va,
            pair_va: totals.pair_va,
            line_current: totals.line_current,
            balanced_current: totals.balanced_current,
            unbalance: totals.unbalance,
            ampacity: sizing::allowable_ampacity(main_conductor_size, main_sizing),
            phase_loads: None,
            overload: None,
            feeder: feeder.share.on(label),
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
            egc_size: egc(node, at, conductor_size, minimum_size),
            conduit_size: conduit(node, conductor_size),
            ampere_frames: js::or(node.overrided_ampere_frames, at),
            phase_va: None,
            pair_va: None,
            line_current: None,
            balanced_current: None,
            unbalance: None,
            ampacity: sizing::allowable_ampacity(conductor_size, own_sizing),
            phase_loads: None,
            overload: load_data
                .filter(|_| sizing::is_motor(load_type))
                .and_then(|d| {
                    Some((
                        d.nameplate_current.filter(|&c| c > 0.0)?,
                        d.nameplate_marked,
                    ))
                })
                .map(|(current, marked)| sizing::overload_rating(current, marked.unwrap_or(false))),
            feeder: if sizing::is_motor(load_type) {
                FeederShare {
                    va,
                    current,
                    largest_motor: Some(Motor {
                        va,
                        current,
                        at,
                        phase: label,
                    }),
                    largest_breaker: Some(Motor {
                        va,
                        current,
                        at,
                        phase: label,
                    }),
                    phase_va: None,
                    pair_va: None,
                }
            } else {
                // An unknown load type has no factor; it adds its VA as it is.
                let factor = sizing::load_factor(load_type, continuous).unwrap_or(1.0);
                FeederShare {
                    va: va * factor,
                    current: current * factor,
                    largest_motor: None,
                    largest_breaker: None,
                    phase_va: None,
                    pair_va: None,
                }
            },
        }
    };
    row.phase_loads = phase_loads(supply, &row);
    memo.insert(node.id.clone(), row.clone());
    row
}

/// What a circuit puts on each phase (3P-Y) or line pair (delta) of its supply, in the
/// supply's label order: all its VA on its own one; a three-phase circuit a third on
/// each, or a three-phase sub-panel its own VA on each (the split its panel's totals
/// add, PEC 2017 2.20.3.22), to 0.01 VA. `None` on a single-phase supply.
fn phase_loads(supply: Supply, row: &LoadRow) -> Option<[Option<f64>; 3]> {
    if supply == Supply::OnePhase {
        return None;
    }
    let va = if js::truthy(row.va) { row.va } else { 0.0 };
    let labels = supply.labels();
    Some(if row.phase == phases::ALL_PHASES {
        let shares = split(supply, row.phase_va, row.pair_va).unwrap_or([va / 3.0; 3]);
        shares.map(|share| Some(js::round_js(share, 2)))
    } else {
        labels.map(|label| (row.phase == label).then_some(va))
    })
}

/// The circuits of a three-phase panel (or the root) as the balancer weighs them, by
/// their computed rows: VA, what they draw from, and a three-phase sub-panel's split.
pub fn balance_circuits(
    graph: &Graph,
    panel_id: &str,
    memo: &mut HashMap<String, LoadRow>,
) -> (Supply, Vec<(String, LoadRow)>) {
    let supply = phases::supply_of(graph.get(panel_id));
    let rows = graph
        .children(panel_id)
        .map(|child| (child.id.clone(), load_row(graph, child, memo)))
        .collect();
    (supply, rows)
}

/// A circuit row's share of the balancer's input (`phases::BalanceCircuit`).
pub fn balance_circuit<'a>(
    id: &'a str,
    row: &'a LoadRow,
    supply: Supply,
) -> phases::BalanceCircuit<'a> {
    phases::BalanceCircuit {
        id,
        va: if js::truthy(row.va) { row.va } else { 0.0 },
        phase: &row.phase,
        split: split(supply, row.phase_va, row.pair_va),
    }
}

/// A panel's feeder: its `load` (2.15.1.2(A)(1), 4.30.2.4), the `ceiling` of a motor
/// feeder's breaker (4.30.5.2(A), 4.30.5.3), and what it adds to its own panel.
struct Feeder {
    load: f64,
    ceiling: f64,
    share: FeederShare,
}

/// The circuits' feeder shares through the panel's own phase totals, plus once: 25 % more
/// of the highest full-load current for the load (4.30.2.4(1)), and for the ceiling the
/// largest motor branch breaker in place of that motor's full-load current (4.30.5.2(A);
/// App. D Ex. D10). Two motors with the same largest rating count one of them.
fn feeder_load(panel: &Node, circuits: &[(&Node, LoadRow)]) -> Feeder {
    let supply = Supply::of(panel.panel_phase());
    let motor = largest(circuits, |share| share.largest_motor, |m| m.current);
    let breaker = largest(circuits, |share| share.largest_breaker, |m| m.at);
    let total = |extra: Option<(Motor, f64)>| {
        let mut parts: Vec<CircuitTotal> = circuits
            .iter()
            .map(|(_, row)| CircuitTotal {
                va: row.feeder.va,
                current: row.feeder.current,
                phase: &row.phase,
                split: split(supply, row.feeder.phase_va, row.feeder.pair_va),
            })
            .collect();
        if let Some((motor, factor)) = extra {
            parts.push(CircuitTotal {
                va: motor.va * factor,
                current: motor.current * factor,
                phase: motor.phase,
                split: None,
            });
        }
        phases::panel_totals(panel, &parts)
    };
    let load = total(motor.map(|m| (m, 0.25))).current;
    let ceiling = match breaker {
        Some(m) if m.current > 0.0 => total(Some((m, m.at / m.current - 1.0))).current,
        _ => load,
    };
    let own = total(None);
    Feeder {
        load,
        ceiling: ceiling.max(load),
        share: FeederShare {
            va: circuits.iter().fold(0.0, |va, (_, row)| va + row.feeder.va),
            current: own.current,
            largest_motor: motor,
            largest_breaker: breaker,
            phase_va: own.phase_va,
            pair_va: own.pair_va,
        },
    }
}

/// The motor at or below the circuits that is largest by `key`.
fn largest(
    circuits: &[(&Node, LoadRow)],
    pick: impl Fn(&FeederShare) -> Option<Motor>,
    key: impl Fn(&Motor) -> f64,
) -> Option<Motor> {
    circuits
        .iter()
        .filter_map(|(_, row)| pick(&row.feeder))
        .fold(None, |best, m| match best {
            Some(top) if key(&top) >= key(&m) => best,
            _ => Some(m),
        })
}

/// A three-phase sub-panel's VA per phase or line pair, when it matches the supply of the
/// panel above it (a mismatch is an error the panel reports; its VA is spread then).
fn split(supply: Supply, phase_va: Option<PhaseVa>, pair_va: Option<PairVa>) -> Option<[f64; 3]> {
    match supply {
        Supply::Wye => phase_va.map(|p| [p.A, p.B, p.C]),
        Supply::Delta => pair_va.map(|p| [p.AB, p.BC, p.CA]),
        Supply::OnePhase => None,
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn row(va: f64, phase: &str) -> LoadRow {
        LoadRow {
            load_description: String::new(),
            voltage: 230.0,
            phase: phase.to_owned(),
            va,
            at: 20.0,
            current: 0.0,
            conductor_size: 3.5,
            egc_size: sizing::Egc::Size(3.5),
            conduit_size: sizing::Conduit::Size(15.0),
            ampere_frames: 20.0,
            phase_va: None,
            pair_va: None,
            line_current: None,
            balanced_current: None,
            unbalance: None,
            ampacity: None,
            phase_loads: None,
            overload: None,
            feeder: FeederShare::default(),
        }
    }

    #[test]
    fn single_phase_va_sits_on_its_own_phase_or_pair_only() {
        assert_eq!(
            phase_loads(Supply::Wye, &row(1_840.0, "B")),
            Some([None, Some(1_840.0), None])
        );
        assert_eq!(
            phase_loads(Supply::Delta, &row(2_300.0, "BC")),
            Some([None, Some(2_300.0), None])
        );
        assert_eq!(phase_loads(Supply::OnePhase, &row(1_840.0, "A")), None);
    }

    /// PEC 2017 App. D Ex. D6: the 6-kVA package ACU puts 2 000 VA on each phase.
    #[test]
    fn three_phase_va_splits_evenly() {
        assert_eq!(
            phase_loads(Supply::Wye, &row(6_000.0, "ABC")),
            Some([Some(2_000.0); 3])
        );
    }

    /// PEC 2017 2.20.3.22: a three-phase sub-panel's feeder carries its own phase loads.
    #[test]
    fn a_three_phase_sub_panel_shows_its_own_split() {
        let wye = LoadRow {
            phase_va: Some(PhaseVa {
                A: 11_960.0,
                B: 8_320.0,
                C: 0.0,
            }),
            ..row(20_280.0, "ABC")
        };
        assert_eq!(
            phase_loads(Supply::Wye, &wye),
            Some([Some(11_960.0), Some(8_320.0), Some(0.0)])
        );
        // A wye sub-panel on a delta panel has no line-pair split: a third each.
        assert_eq!(phase_loads(Supply::Delta, &wye), Some([Some(6_760.0); 3]));
        let delta = LoadRow {
            pair_va: Some(PairVa {
                AB: 100.0,
                BC: 300.0,
                CA: 500.0,
            }),
            ..row(900.0, "ABC")
        };
        assert_eq!(
            phase_loads(Supply::Delta, &delta),
            Some([Some(100.0), Some(300.0), Some(500.0)])
        );
    }

    #[test]
    fn shares_round_to_hundredths() {
        assert_eq!(
            phase_loads(Supply::Wye, &row(1_000.0, "ABC")),
            Some([Some(333.33); 3])
        );
    }
}
