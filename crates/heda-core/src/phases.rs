//! Phase rules of the three-phase systems of PEC 2017 2.20.1.5(A): 400Y/230 V wye,
//! three-phase 4-wire (Appendix D Examples D6 and D8), and 230 V delta, three-phase
//! 3-wire (the system of Examples D14 and D15).

use crate::js;
use crate::model::{phases, Node};
use crate::sizing::{
    DELTA_LINE_VOLTAGE, SQRT_3, THREE_PHASE_LOAD_TYPES, WYE_LINE_VOLTAGE, WYE_PHASE_VOLTAGE,
};
use serde::Serialize;

/// The phases of a 400Y/230 V system, in order.
pub const PHASES: [&str; 3] = ["A", "B", "C"];
/// The line pairs of a 230 V delta system, in order: a single-phase circuit there
/// connects line to line, across one pair.
pub const PAIRS: [&str; 3] = ["AB", "BC", "CA"];
/// A circuit drawing from all three phases.
pub const ALL_PHASES: &str = "ABC";

/// What a panel (or the root) supplies its circuits with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Supply {
    OnePhase,
    Wye,
    Delta,
}

impl Supply {
    pub fn of(phase: Option<&str>) -> Supply {
        match phase {
            Some(phases::THREE_PHASE_WYE) => Supply::Wye,
            Some(phases::THREE_PHASE_DELTA) => Supply::Delta,
            _ => Supply::OnePhase,
        }
    }

    /// Line-to-line voltage of its three-phase circuits (PEC 2017 2.20.1.5(A)).
    pub fn line_voltage(self) -> f64 {
        match self {
            Supply::Delta => DELTA_LINE_VOLTAGE,
            Supply::OnePhase | Supply::Wye => WYE_LINE_VOLTAGE,
        }
    }

    /// Where its single-phase circuits connect: a phase (to neutral), or a line pair on delta.
    pub fn labels(self) -> [&'static str; 3] {
        match self {
            Supply::Delta => PAIRS,
            Supply::OnePhase | Supply::Wye => PHASES,
        }
    }
}

/// The supply of the node a circuit hangs from.
pub fn supply_of(parent: Option<&Node>) -> Supply {
    Supply::of(supply_phase_of(parent))
}

/// Default phase of a single-phase circuit on a 3P-Y panelboard, by circuit
/// number. PEC 2017 App. D Ex. D6 6.1 asks for "balanced distribution of single
/// phase loads" but sets no numbering; heda rotates rows of two circuits
/// (odd/even pairs): 1–2 → A, 3–4 → B, 5–6 → C, 7–8 → A, …
pub fn default_phase_assignment(circuit_number: Option<f64>) -> &'static str {
    default_assignment(circuit_number, Supply::Wye)
}

/// The same rotation over the supply's labels: on a delta panel, 1–2 → AB, 3–4 → BC,
/// 5–6 → CA (PEC 2017 leaves the arrangement to the designer here too).
pub fn default_assignment(circuit_number: Option<f64>, supply: Supply) -> &'static str {
    let row = (((circuit_number.unwrap_or(1.0)) - 1.0) / 2.0)
        .floor()
        .max(0.0);
    supply.labels()[(row % 3.0) as usize]
}

/// The stored override when the supply has it (a phase, or a pair on delta), else
/// the circuit-number default.
pub fn phase_of(node: &Node, supply: Supply) -> &str {
    node.phase_assignment
        .as_deref()
        .filter(|phase| supply.labels().contains(phase))
        .unwrap_or_else(|| default_assignment(node.circuit_number, supply))
}

/// What to store when a user picks `next`: nothing when it matches the default.
pub fn phase_override(next: &str, circuit_number: Option<f64>) -> Option<&str> {
    (next != default_phase_assignment(circuit_number)).then_some(next)
}

pub fn is_three_phase_load_type(load_type: Option<&str>) -> bool {
    THREE_PHASE_LOAD_TYPES.contains(&load_type.unwrap_or(""))
}

/// A three-phase panel (3P-Y or delta), or a three-phase load, draws from all three phases.
pub fn is_three_phase_circuit(node: &Node) -> bool {
    matches!(
        node.panel_phase(),
        Some(phases::THREE_PHASE_WYE | phases::THREE_PHASE_DELTA)
    ) || is_three_phase_load_type(node.load_type())
}

/// What a circuit draws from on its supply: all three phases, else its phase or pair.
pub fn circuit_phase(node: &Node, supply: Supply) -> &str {
    if is_three_phase_circuit(node) {
        ALL_PHASES
    } else {
        phase_of(node, supply)
    }
}

/// The phase a node supplies to its circuits: the project's supply at the root, else the panel's.
pub fn supply_phase_of(node: Option<&Node>) -> Option<&str> {
    let node = node?;
    if node.node_type == "root" {
        node.highest_unit_form.as_ref()?.phase.as_deref()
    } else {
        node.panel_phase()
    }
}

/// PEC 2017 App. D Ex. D6 6.3 / D8 8.6: I = VA ÷ (400 V × 1.732).
pub fn three_phase_current(va: f64) -> f64 {
    three_phase_current_at(va, WYE_LINE_VOLTAGE)
}

/// I = VA ÷ (V × 1.732) at a line-to-line voltage (400 V wye, 230 V delta).
pub fn three_phase_current_at(va: f64, line_voltage: f64) -> f64 {
    va / (line_voltage * SQRT_3)
}

/// Line-to-neutral current of a single-phase 230 V load.
pub fn single_phase_current(va: f64) -> f64 {
    va / WYE_PHASE_VOLTAGE
}

/// VA on each phase of a 3P-Y panel.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize)]
#[allow(non_snake_case)]
pub struct PhaseVa {
    pub A: f64,
    pub B: f64,
    pub C: f64,
}

impl PhaseVa {
    /// Adds one circuit: a three-phase circuit loads all three phases equally, a
    /// single-phase one only its own phase.
    pub fn add(self, va: f64, phase: &str) -> PhaseVa {
        match phase {
            ALL_PHASES => {
                let share = va / 3.0;
                PhaseVa {
                    A: self.A + share,
                    B: self.B + share,
                    C: self.C + share,
                }
            }
            "A" => PhaseVa {
                A: self.A + va,
                ..self
            },
            "B" => PhaseVa {
                B: self.B + va,
                ..self
            },
            "C" => PhaseVa {
                C: self.C + va,
                ..self
            },
            // Only a hand-edited file stores another phase; the app's spread would add an
            // extra key there, which no total reads.
            _ => self,
        }
    }
}

/// Current of a 3P-Y feeder: `balanced` is PEC 2017 App. D Ex. D6 6.3 / D8 8.6
/// (total VA ÷ (400 × 1.732)); `highest_phase` is the most loaded phase at
/// 230 V, which is also the neutral's maximum unbalance (PEC 2017 2.20.3.22(A)).
/// Conductors and the breaker are sized on the larger of the two (`design`).
pub fn wye_feeder_current(phase_va: PhaseVa) -> (f64, f64, f64) {
    let balanced = three_phase_current(phase_va.A + phase_va.B + phase_va.C);
    let highest_phase = single_phase_current(js::max(js::max(phase_va.A, phase_va.B), phase_va.C));
    (balanced, highest_phase, js::max(balanced, highest_phase))
}

/// VA on each line pair of a delta panel.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize)]
#[allow(non_snake_case)]
pub struct PairVa {
    pub AB: f64,
    pub BC: f64,
    pub CA: f64,
}

impl PairVa {
    /// Adds one circuit: a three-phase circuit is a balanced delta load, a third of its
    /// VA across each pair; a single-phase one loads only its own pair.
    pub fn add(self, va: f64, pair: &str) -> PairVa {
        match pair {
            ALL_PHASES => {
                let share = va / 3.0;
                PairVa {
                    AB: self.AB + share,
                    BC: self.BC + share,
                    CA: self.CA + share,
                }
            }
            "AB" => PairVa {
                AB: self.AB + va,
                ..self
            },
            "BC" => PairVa {
                BC: self.BC + va,
                ..self
            },
            "CA" => PairVa {
                CA: self.CA + va,
                ..self
            },
            _ => self,
        }
    }
}

/// Current in each line of a delta panel.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize)]
#[allow(non_snake_case)]
pub struct LineCurrent {
    pub A: f64,
    pub B: f64,
    pub C: f64,
}

/// Line currents of a 230 V delta feeder from the VA on its pairs. PEC 2017 gives no
/// method for unbalanced delta loads, so this is the standard phasor sum: with every
/// load at the same power factor the pair currents are 120° apart, and each line
/// carries the difference of its two pairs, I_A = |I_AB − I_CA| =
/// √(I_AB² + I_CA² + I_AB·I_CA). Balanced, that is √3 × the pair current.
pub fn delta_line_currents(pair_va: PairVa) -> LineCurrent {
    let ab = pair_va.AB / DELTA_LINE_VOLTAGE;
    let bc = pair_va.BC / DELTA_LINE_VOLTAGE;
    let ca = pair_va.CA / DELTA_LINE_VOLTAGE;
    let line = |x: f64, y: f64| (x * x + y * y + x * y).sqrt();
    LineCurrent {
        A: line(ab, ca),
        B: line(bc, ab),
        C: line(ca, bc),
    }
}

/// Current of a delta feeder: `balanced` is total VA ÷ (230 V × 1.732), the
/// three-phase formula of PEC 2017 App. D Ex. D6 6.3 at the delta voltage; the most
/// loaded line can carry more when the pairs are unbalanced. Conductors and the
/// breaker are sized on the larger of the two (`design`), as for wye.
pub fn delta_feeder_current(pair_va: PairVa) -> (f64, LineCurrent, f64) {
    let balanced = three_phase_current_at(pair_va.AB + pair_va.BC + pair_va.CA, DELTA_LINE_VOLTAGE);
    let lines = delta_line_currents(pair_va);
    let highest_line = js::max(js::max(lines.A, lines.B), lines.C);
    (balanced, lines, js::max(balanced, highest_line))
}

/// A computed circuit as a panel total sees it.
pub struct CircuitTotal<'a> {
    pub va: f64,
    pub current: f64,
    /// What it draws from on the panel (`LoadRow::phase`).
    pub phase: &'a str,
    /// A three-phase sub-panel's own VA per phase (3P-Y) or line pair (delta), which its
    /// feeder carries as it is rather than spread evenly over the three.
    pub split: Option<[f64; 3]>,
}

/// The `'static` label of a circuit phase: a phase, a line pair or all three; "" (no
/// total reads it) for anything else.
pub fn label(phase: &str) -> &'static str {
    PHASES
        .iter()
        .chain(&PAIRS)
        .chain(&[ALL_PHASES])
        .find(|label| **label == phase)
        .copied()
        .unwrap_or("")
}

/// Totals of a panel from its computed circuits.
#[derive(Debug, Default)]
pub struct PanelTotals {
    pub va: f64,
    pub current: f64,
    /// 3P-Y panels: VA per phase.
    pub phase_va: Option<PhaseVa>,
    /// Delta panels: VA per line pair and the current of each line (to 0.01 A).
    pub pair_va: Option<PairVa>,
    pub line_current: Option<LineCurrent>,
    /// Three-phase panels: the balanced current, rounded to 0.01 A like the table.
    pub balanced_current: Option<f64>,
}

/// A single-phase panel adds the circuit currents; a three-phase panel sums VA per
/// phase (3P-Y) or per line pair (delta) and sizes on the larger of the balanced
/// and the most loaded phase or line current.
pub fn panel_totals(panel: &Node, circuits: &[CircuitTotal]) -> PanelTotals {
    let va = circuits
        .iter()
        .fold(0.0, |total, c| total + js_or_zero(c.va));
    match Supply::of(panel.panel_phase()) {
        Supply::OnePhase => PanelTotals {
            va,
            current: circuits
                .iter()
                .fold(0.0, |total, c| total + js_or_zero(c.current)),
            ..PanelTotals::default()
        },
        Supply::Wye => {
            let phase_va = circuits
                .iter()
                .fold(PhaseVa::default(), |total, c| match c.split {
                    Some([a, b, c]) => PhaseVa {
                        A: total.A + a,
                        B: total.B + b,
                        C: total.C + c,
                    },
                    None => total.add(js_or_zero(c.va), c.phase),
                });
            let (balanced, _, design) = wye_feeder_current(phase_va);
            PanelTotals {
                va,
                current: design,
                phase_va: Some(phase_va),
                balanced_current: Some(js::round_js(balanced, 2)),
                ..PanelTotals::default()
            }
        }
        Supply::Delta => {
            let pair_va = circuits
                .iter()
                .fold(PairVa::default(), |total, c| match c.split {
                    Some([ab, bc, ca]) => PairVa {
                        AB: total.AB + ab,
                        BC: total.BC + bc,
                        CA: total.CA + ca,
                    },
                    None => total.add(js_or_zero(c.va), c.phase),
                });
            let (balanced, lines, design) = delta_feeder_current(pair_va);
            PanelTotals {
                va,
                current: design,
                pair_va: Some(pair_va),
                line_current: Some(LineCurrent {
                    A: js::round_js(lines.A, 2),
                    B: js::round_js(lines.B, 2),
                    C: js::round_js(lines.C, 2),
                }),
                balanced_current: Some(js::round_js(balanced, 2)),
                ..PanelTotals::default()
            }
        }
    }
}

fn js_or_zero(value: f64) -> f64 {
    if js::truthy(value) {
        value
    } else {
        0.0
    }
}

/// Why `node` cannot sit under `parent` with `children` below it, else `None`
/// (PEC 2017 2.20.1.5(A)). A three-phase circuit needs a three-phase supply; a 3P-Y
/// panel needs a 400Y/230 V one and a delta panel a 230 V delta one, since heda
/// models no transformer between them; a single-phase panel (230 V, on a phase or a
/// line pair) goes anywhere but has only one phase to give its circuits.
pub fn supply_error(node: &Node, parent: Option<&Node>, children: &[Node]) -> Option<&'static str> {
    let supply = supply_of(parent);
    match Supply::of(node.panel_phase()) {
        Supply::Wye if supply != Supply::Wye => {
            return Some("A 3P-Y panel needs a 3P-Y (400Y/230 V) supply.");
        }
        Supply::Delta if supply != Supply::Delta => {
            return Some("A 3P-Δ panel needs a 3P-Δ (230 V) supply.");
        }
        _ => {}
    }
    if is_three_phase_circuit(node) && supply == Supply::OnePhase {
        return Some("A three-phase circuit needs a three-phase supply.");
    }
    if supply_of(Some(node)) == Supply::OnePhase && children.iter().any(is_three_phase_circuit) {
        return Some("This panel feeds three-phase circuits, so it must stay three-phase.");
    }
    None
}

/// One circuit offered to the balancer.
pub struct BalanceCircuit<'a> {
    pub id: &'a str,
    pub va: f64,
    pub phase: &'a str,
}

/// Phases (or line pairs, on delta) for the single-phase circuits of one three-phase
/// panel, largest load first onto the least loaded phase. Three-phase circuits only
/// seed the totals. PEC 2017 App. D Ex. D6 6.1 asks for "balanced distribution of
/// single phase loads" but leaves the method to the designer. Returned in
/// assignment order.
pub fn balanced_phase_assignments<'a>(
    circuits: &[BalanceCircuit<'a>],
    supply: Supply,
) -> Vec<(&'a str, &'static str)> {
    let labels = supply.labels();
    let mut totals = [0.0_f64; 3];
    for circuit in circuits.iter().filter(|c| c.phase == ALL_PHASES) {
        for total in &mut totals {
            *total += circuit.va / 3.0;
        }
    }
    let mut single_phase: Vec<&BalanceCircuit> =
        circuits.iter().filter(|c| c.phase != ALL_PHASES).collect();
    // Stable, like Array.prototype.sort; `b.va - a.va` compares NaN as equal.
    single_phase.sort_by(|a, b| b.va.partial_cmp(&a.va).unwrap_or(std::cmp::Ordering::Equal));
    single_phase
        .into_iter()
        .map(|circuit| {
            // Ties go to the first label, then the second, so the result is stable.
            let index = (1..3).fold(0, |best, next| {
                if totals[next] < totals[best] {
                    next
                } else {
                    best
                }
            });
            totals[index] += circuit.va;
            (circuit.id, labels[index])
        })
        .collect()
}
