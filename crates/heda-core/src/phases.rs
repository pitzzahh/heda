//! Phase rules of a 400Y/230 V wye system (PEC 2017 2.20.1.5(A) and Appendix D
//! Examples D6 and D8), ported from `src/lib/utils/computations/three-phase.ts`.

use crate::js;
use crate::model::{phases, Node};
use crate::sizing::{SQRT_3, THREE_PHASE_LOAD_TYPES, WYE_LINE_VOLTAGE, WYE_PHASE_VOLTAGE};
use serde::Serialize;

/// The phases of a 400Y/230 V system, in order.
pub const PHASES: [&str; 3] = ["A", "B", "C"];
/// A circuit drawing from all three phases.
pub const ALL_PHASES: &str = "ABC";

/// Default phase of a single-phase circuit on a 3P-Y panelboard, by circuit
/// number. PEC 2017 App. D Ex. D6 6.1 asks for "balanced distribution of single
/// phase loads" but sets no numbering; heda rotates rows of two circuits
/// (odd/even pairs): 1–2 → A, 3–4 → B, 5–6 → C, 7–8 → A, …
pub fn default_phase_assignment(circuit_number: Option<f64>) -> &'static str {
    let row = (((circuit_number.unwrap_or(1.0)) - 1.0) / 2.0)
        .floor()
        .max(0.0);
    PHASES[(row % 3.0) as usize]
}

/// The stored override, else the circuit-number default.
pub fn phase_of(node: &Node) -> &str {
    node.phase_assignment
        .as_deref()
        .unwrap_or_else(|| default_phase_assignment(node.circuit_number))
}

/// What to store when a user picks `next`: nothing when it matches the default.
pub fn phase_override(next: &str, circuit_number: Option<f64>) -> Option<&str> {
    (next != default_phase_assignment(circuit_number)).then_some(next)
}

pub fn is_three_phase_load_type(load_type: Option<&str>) -> bool {
    THREE_PHASE_LOAD_TYPES.contains(&load_type.unwrap_or(""))
}

/// A 3P-Y panel, or a load fed line-to-line, draws from all three phases.
pub fn is_three_phase_circuit(node: &Node) -> bool {
    node.panel_phase() == Some(phases::THREE_PHASE_WYE)
        || is_three_phase_load_type(node.load_type())
}

/// The phases a circuit draws from when it sits on a 3P-Y panel.
pub fn circuit_phase(node: &Node) -> &str {
    if is_three_phase_circuit(node) {
        ALL_PHASES
    } else {
        phase_of(node)
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
    va / (WYE_LINE_VOLTAGE * SQRT_3)
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
    fn get(&self, phase: &str) -> f64 {
        match phase {
            "A" => self.A,
            "B" => self.B,
            _ => self.C,
        }
    }

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

/// A computed circuit as a panel total sees it.
pub struct CircuitTotal<'a> {
    pub node: &'a Node,
    pub va: f64,
    pub current: f64,
}

/// Totals of a panel from its computed circuits.
pub struct PanelTotals {
    pub va: f64,
    pub current: f64,
    /// 3P-Y panels: VA per phase and the balanced current rounded to 0.01 A.
    pub wye: Option<(PhaseVa, f64)>,
}

/// A single-phase panel adds the circuit currents; a 3P-Y panel sums VA per phase
/// and sizes on the larger of the balanced and highest-phase currents.
pub fn panel_totals(panel: &Node, circuits: &[CircuitTotal]) -> PanelTotals {
    let va = circuits
        .iter()
        .fold(0.0, |total, c| total + js_or_zero(c.va));
    if panel.panel_phase() != Some(phases::THREE_PHASE_WYE) {
        let current = circuits
            .iter()
            .fold(0.0, |total, c| total + js_or_zero(c.current));
        return PanelTotals {
            va,
            current,
            wye: None,
        };
    }
    let phase_va = circuits.iter().fold(PhaseVa::default(), |total, c| {
        total.add(js_or_zero(c.va), circuit_phase(c.node))
    });
    let (balanced, _, design) = wye_feeder_current(phase_va);
    PanelTotals {
        va,
        current: design,
        wye: Some((phase_va, js::round_js(balanced, 2))),
    }
}

fn js_or_zero(value: f64) -> f64 {
    if js::truthy(value) {
        value
    } else {
        0.0
    }
}

/// Why `node` cannot sit under `parent` with `children` below it, else `None`.
/// Three-phase circuits (400 V loads and 3P-Y panels) need a 400Y/230 V supply
/// (PEC 2017 App. D Ex. D6, 2.20.1.5(A)); a single-phase panel has only one
/// phase and the neutral to give.
pub fn supply_error(node: &Node, parent: Option<&Node>, children: &[Node]) -> Option<&'static str> {
    if is_three_phase_circuit(node) && supply_phase_of(parent) != Some(phases::THREE_PHASE_WYE) {
        return Some("A three-phase circuit needs a 3P-Y (400Y/230 V) supply.");
    }
    if supply_phase_of(Some(node)) != Some(phases::THREE_PHASE_WYE)
        && children.iter().any(is_three_phase_circuit)
    {
        return Some("This panel feeds three-phase circuits, so it must stay 3P-Y.");
    }
    None
}

/// One circuit offered to the balancer.
pub struct BalanceCircuit<'a> {
    pub id: &'a str,
    pub va: f64,
    pub phase: &'a str,
}

/// Phases for the single-phase circuits of one 3P-Y panel, largest load first onto
/// the least loaded phase. Three-phase circuits only seed the totals. PEC 2017 App. D
/// Ex. D6 6.1 asks for "balanced distribution of single phase loads" but leaves the
/// method to the designer. Returned in assignment order.
pub fn balanced_phase_assignments<'a>(
    circuits: &[BalanceCircuit<'a>],
) -> Vec<(&'a str, &'static str)> {
    let mut totals = circuits
        .iter()
        .filter(|c| c.phase == ALL_PHASES)
        .fold(PhaseVa::default(), |total, c| total.add(c.va, c.phase));
    let mut single_phase: Vec<&BalanceCircuit> =
        circuits.iter().filter(|c| c.phase != ALL_PHASES).collect();
    // Stable, like Array.prototype.sort; `b.va - a.va` compares NaN as equal.
    single_phase.sort_by(|a, b| b.va.partial_cmp(&a.va).unwrap_or(std::cmp::Ordering::Equal));
    single_phase
        .into_iter()
        .map(|circuit| {
            // Ties go to A, then B, then C, so the result is stable.
            let phase = PHASES[1..].iter().fold(PHASES[0], |best, next| {
                if totals.get(next) < totals.get(best) {
                    next
                } else {
                    best
                }
            });
            totals = totals.add(circuit.va, phase);
            (circuit.id, phase)
        })
        .collect()
}
