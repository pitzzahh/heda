//! Available fault current at every node, per unit on the transformer kVA (PEC 2017
//! App. D Ex. D13/D14), ported from `src/lib/db/queries/short-circuit-core.ts` and
//! `src/lib/utils/computations/short-circuit.ts`.

use crate::graph::Graph;
use crate::load_schedule::{load_row, LoadRow};
use crate::model::{phases as phase_names, Node};
use crate::num;
use crate::phases::is_three_phase_circuit;
use crate::sizing::{MOTOR_LOAD_TYPES, WYE_LINE_VOLTAGE, WYE_PHASE_VOLTAGE};
use crate::tables::{
    lookup, CONDUCTOR_RESISTANCE_REACTANCE, MOTOR_IMPEDANCE_PU,
    UNMARKED_BREAKER_INTERRUPTING_RATING_KA,
};
use crate::voltage_drop::{from_node_name, to_node_name};
use serde::Serialize;
use std::collections::HashMap;

/// PEC 2017 1.10.1.9 outcome; `NoSource` means the source data is missing.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum InterruptingRatingStatus {
    Ok,
    UnderRated,
    NoSource,
}

/// What the engine adds to a node's load row for its short-circuit row.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ShortCircuitRow {
    pub id: String,
    pub from_node_name: String,
    pub to_node_name: String,
    pub length: f64,
    pub conductor_z_ohm: f64,
    pub conductor_z_pu: f64,
    pub motor_z_pu: Option<f64>,
    pub supply_z_pu: Option<f64>,
    pub supply_fault_current: Option<f64>,
    pub node_fault_current: Option<f64>,
    pub interrupting_rating_ka: f64,
    pub status: InterruptingRatingStatus,
}

/// PEC 2017 App. D Ex. D14 step 5: pu Zs = kVA base / utility SC kVA.
pub fn source_impedance_pu(base_kva: f64, utility_sc_kva: f64) -> f64 {
    base_kva / utility_sc_kva
}

/// PEC 2017 App. D Ex. D14 step 6: pu Zt = impedance in percent / 100.
pub fn transformer_impedance_pu(z_percent: f64) -> f64 {
    z_percent / 100.0
}

/// Impedance of one conductor run in ohms, from PEC 2017 Table 10.1.1.9 (R and XL
/// per 305 m, by conduit) as |R + jXL|. Parallel sets divide it. The table is ohms
/// to neutral (one conductor), so a `round_trip` run, whose fault flows out on one
/// conductor and back on the other, counts twice. `None` for a size the table does
/// not list.
pub fn conductor_impedance_ohm(
    size: f64,
    conduit_type: Option<&str>,
    length: f64,
    sets: f64,
    round_trip: bool,
) -> Option<f64> {
    let row = lookup(&CONDUCTOR_RESISTANCE_REACTANCE, size)?;
    let conduit = conduit_type.unwrap_or("").to_lowercase();
    let is_steel = conduit.contains("steel");
    let r = if is_steel {
        row.r_steel
    } else if conduit.contains("alum") {
        row.r_aluminum
    } else {
        row.r_pvc
    };
    let x = if is_steel { row.xl_steel } else { row.xl };
    let per_305_m = r.hypot(x);
    Some(((per_305_m * length) / 305.0 / sets.max(1.0)) * if round_trip { 2.0 } else { 1.0 })
}

/// PEC 2017 App. D Ex. D14 step 7b: pu Zw = (ohm / kV²) × (kVA base / 1000).
pub fn ohms_to_pu(ohms: f64, voltage: f64, base_kva: f64) -> f64 {
    let kv = voltage / 1000.0;
    (ohms / (kv * kv)) * (base_kva / 1000.0)
}

/// PEC 2017 App. D Ex. D14 step 8: pu Zm = kVA base / (motor kVA / motor impedance).
pub fn motor_impedance_pu(base_kva: f64, motor_kva: f64) -> f64 {
    base_kva / (motor_kva / MOTOR_IMPEDANCE_PU)
}

/// Symmetrical fault current in amperes for a per-unit impedance up to the fault (pu voltage 1.0).
/// - Three-phase, PEC 2017 App. D Ex. D14 step 9.4: (1 / pu Zc) × base kVA × 1000 / (1.732 × V).
/// - Single-phase, PEC 2017 App. D Ex. D13: I_sec / Z, with I_sec = VA / V.
pub fn symmetrical_fault_current(
    z_pu: f64,
    base_kva: f64,
    voltage: f64,
    is_single_phase: bool,
) -> f64 {
    let base_current = (base_kva * 1000.0)
        / if is_single_phase {
            voltage
        } else {
            1.732 * voltage
        };
    base_current / z_pu
}

/// PEC 2017 1.10.1.9 against the breaker's rating; unmarked breakers are 5 kA (2.40.7.4(C)).
pub fn interrupting_rating_status(
    fault_current: Option<f64>,
    rating_ka: f64,
) -> InterruptingRatingStatus {
    match fault_current {
        None => InterruptingRatingStatus::NoSource,
        Some(current) if current > rating_ka * 1000.0 => InterruptingRatingStatus::UnderRated,
        Some(_) => InterruptingRatingStatus::Ok,
    }
}

struct Source {
    utility_sc_kva: f64,
    transformer_kva: f64,
    transformer_z_percent: f64,
}

fn read_source(root: &Node) -> Option<Source> {
    let form = root.highest_unit_form.as_ref()?;
    let positive = num::positive;
    Some(Source {
        utility_sc_kva: positive(form.utility_sc_kva)?,
        transformer_kva: positive(form.transformer_kva)?,
        transformer_z_percent: positive(form.transformer_z_percent)?,
    })
}

fn is_single_phase(phase: Option<&str>) -> bool {
    phase.is_none_or(|phase| phase.is_empty() || phase == phase_names::ONE_PHASE)
}

/// At each bus the Thevenin impedance combines the path back to the source with every
/// motor below it in parallel, as D14 step 10.2 does. A node's breaker sits on its
/// supply bus, so its interrupting rating is checked against that bus (PEC 2017
/// 1.10.1.9: the current available at the line terminals). Rows come in preorder.
pub fn short_circuits(graph: &Graph, memo: &mut HashMap<String, LoadRow>) -> Vec<ShortCircuitRow> {
    let Some(root) = graph.root() else {
        return Vec::new();
    };
    let source = read_source(root);
    let root_phase = root
        .highest_unit_form
        .as_ref()
        .and_then(|h| h.phase.as_deref());
    let single_phase_system = is_single_phase(root_phase);
    // A 3P-Y system is per unit at its 400 V line voltage (2.20.1.5(A); App. D Ex. D6, D8),
    // a delta one at its 230 V, as D14 itself is; both take the bolted three-phase fault
    // at every bus. On 3P-Y a 230 V single-phase circuit can only fault line to neutral:
    // its run counts out on the phase and back on the neutral, as in D13, and the rest of
    // the path is the three-phase impedance per phase (heda takes the transformer's
    // zero-sequence impedance equal to its positive one, as for the usual delta-wye unit).
    // On delta a single-phase circuit faults line to line, V / (2·(Zs + Zc)); heda shows
    // the three-phase value with the run counted once, V / (√3·(Zs + Zc)), never less.
    let is_wye_system = root_phase == Some(phase_names::THREE_PHASE_WYE);
    let system_voltage = if is_wye_system {
        WYE_LINE_VOLTAGE
    } else {
        230.0
    };
    let base_kva = source.as_ref().map_or(0.0, |s| s.transformer_kva);

    let order = graph.preorder(root);
    let mut conductor_ohm: HashMap<&str, f64> = HashMap::new();
    let mut conductor_pu: HashMap<&str, f64> = HashMap::new();
    let mut motor_pu: HashMap<&str, f64> = HashMap::new();

    for node in &order {
        let computed = load_row(graph, node, memo);
        // Unlisted sizes count as zero impedance: that overstates fault current, the safe side.
        let ohms = conductor_impedance_ohm(
            num::positive(node.overrided_conductor_size).unwrap_or(computed.conductor_size),
            node.conduit_type.as_deref(),
            num::positive(node.overrided_length)
                .or(num::positive(node.length))
                .unwrap_or(0.0),
            num::positive(node.conductor_sets).unwrap_or(1.0),
            single_phase_system || (is_wye_system && !is_three_phase_circuit(node)),
        )
        .unwrap_or(0.0);
        conductor_ohm.insert(&node.id, ohms);
        if source.is_none() {
            continue;
        }
        conductor_pu.insert(&node.id, ohms_to_pu(ohms, system_voltage, base_kva));
        // A 230 V motor on a 3P-Y system feeds one phase at its own 230 V impedance. PEC only
        // works three-phase motors (D14), so this follows IEEE practice: low-voltage breakers
        // are rated on first-cycle current, where every motor counts at 4 × rated current
        // (0.25 pu, the value D14 step 8 takes from IEEE Std 141). The kVA is scaled by (400/230)² to put the
        // motor's real ohms on the 400 V base, and every phase is charged with it.
        let line_to_neutral_scale = if is_wye_system && !is_three_phase_circuit(node) {
            let ratio = WYE_LINE_VOLTAGE / WYE_PHASE_VOLTAGE;
            ratio * ratio
        } else {
            1.0
        };
        let motor_kva = if MOTOR_LOAD_TYPES.contains(&node.load_type().unwrap_or("")) {
            (computed.va / 1000.0) * line_to_neutral_scale
        } else {
            0.0
        };
        if motor_kva > 0.0 {
            motor_pu.insert(&node.id, motor_impedance_pu(base_kva, motor_kva));
        }
    }

    let row = |node: &Node, result: Option<FaultResult>| {
        let interrupting_rating_ka = num::positive(num::stored(node.kaic.as_ref()))
            .unwrap_or(UNMARKED_BREAKER_INTERRUPTING_RATING_KA);
        let supply_fault_current = result.as_ref().map(|r| r.supply_fault_current);
        ShortCircuitRow {
            id: node.id.clone(),
            from_node_name: from_node_name(node.parent_id.as_deref().and_then(|id| graph.get(id))),
            to_node_name: to_node_name(node),
            length: num::positive(node.overrided_length)
                .or(num::positive(node.length))
                .unwrap_or(0.0),
            conductor_z_ohm: conductor_ohm.get(node.id.as_str()).copied().unwrap_or(0.0),
            conductor_z_pu: result.as_ref().map_or(0.0, |r| r.conductor_z_pu),
            motor_z_pu: result.as_ref().and_then(|r| r.motor_z_pu),
            supply_z_pu: result.as_ref().map(|r| r.supply_z_pu),
            supply_fault_current,
            node_fault_current: result.as_ref().map(|r| r.node_fault_current),
            interrupting_rating_ka,
            status: interrupting_rating_status(supply_fault_current, interrupting_rating_ka),
        }
    };

    let Some(source) = source else {
        return order.iter().map(|node| row(node, None)).collect();
    };

    // Pass 1, leaves up: admittance of the motors below each bus, seen from that bus.
    let mut down_admittance: HashMap<&str, f64> = HashMap::new();
    let branch_admittance = |node: &Node, down: &HashMap<&str, f64>| {
        let below = down.get(node.id.as_str()).copied().unwrap_or(0.0);
        if below == 0.0 {
            0.0
        } else {
            1.0 / (conductor_pu.get(node.id.as_str()).copied().unwrap_or(0.0) + 1.0 / below)
        }
    };
    for node in order.iter().rev().copied().chain(std::iter::once(root)) {
        let motor = motor_pu.get(node.id.as_str()).map_or(0.0, |z| 1.0 / z);
        let children = graph.children(&node.id).fold(0.0, |total, child| {
            total + branch_admittance(child, &down_admittance)
        });
        down_admittance.insert(&node.id, motor + children);
    }

    // Pass 2, root down: impedance back to the source, and the Thevenin impedance at each bus.
    let mut up_pu: HashMap<&str, f64> = HashMap::new();
    up_pu.insert(
        &root.id,
        source_impedance_pu(base_kva, source.utility_sc_kva)
            + transformer_impedance_pu(source.transformer_z_percent),
    );
    let bus_pu = |node: &Node, up: &HashMap<&str, f64>| {
        1.0 / (1.0 / up[node.id.as_str()]
            + down_admittance
                .get(node.id.as_str())
                .copied()
                .unwrap_or(0.0))
    };
    let current =
        |z_pu: f64| symmetrical_fault_current(z_pu, base_kva, system_voltage, single_phase_system);

    order
        .iter()
        .map(|node| {
            let parent = node
                .parent_id
                .as_deref()
                .and_then(|id| graph.get(id))
                .unwrap_or(root);
            let supply_admittance = 1.0 / up_pu[parent.id.as_str()]
                + down_admittance
                    .get(parent.id.as_str())
                    .copied()
                    .unwrap_or(0.0)
                - branch_admittance(node, &down_admittance);
            let conductor = conductor_pu.get(node.id.as_str()).copied().unwrap_or(0.0);
            up_pu.insert(&node.id, conductor + 1.0 / supply_admittance);
            let supply_z_pu = bus_pu(parent, &up_pu);
            let result = FaultResult {
                conductor_z_pu: conductor,
                motor_z_pu: motor_pu.get(node.id.as_str()).copied(),
                supply_z_pu,
                supply_fault_current: current(supply_z_pu),
                node_fault_current: current(bus_pu(node, &up_pu)),
            };
            row(node, Some(result))
        })
        .collect()
}

struct FaultResult {
    conductor_z_pu: f64,
    motor_z_pu: Option<f64>,
    supply_z_pu: f64,
    supply_fault_current: f64,
    node_fault_current: f64,
}
