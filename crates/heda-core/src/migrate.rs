//! Brings an opened file up to the current format before it becomes the session:
//! labels older versions stored become canonical values, 3P-Y files from before
//! three-phase support get their circuit defaults, the PEC 2017 sizing revision is
//! applied once, and every document is completed with its defaults.
//!
//! Each step runs once: a file records that it ran (`wye_circuit_defaults`,
//! `pec_2017_revision`), so what the user changes afterwards survives reopening.

use crate::defaults::{self, PEC_2017_REVISION};
use crate::js;
use crate::model::{load_types, phases};
use serde_json::{json, Value};
use std::collections::HashSet;

/// An opened file, migrated: the project and nodes to open, and whether the file
/// predates the current PEC 2017 revision with circuits whose sizes may change.
pub struct Migrated {
    pub project: Value,
    pub nodes: Vec<Value>,
    pub pec_2017_migrated: bool,
}

/// Migrates a file's project and nodes. Fails, changing nothing, on two nodes with
/// one id: a tampered file must not replace one node with another.
pub fn migrate_file(mut project: Value, mut nodes: Vec<Value>) -> Result<Migrated, String> {
    let mut ids = HashSet::new();
    if !nodes.iter().all(|node| ids.insert(node["id"].as_str())) {
        return Err("Item with same id already exists".into());
    }
    let root = nodes.iter().position(|node| node["node_type"] == "root");
    let pec_2017_migrated =
        root.is_some_and(|root| revision_of(&nodes[root]) < PEC_2017_REVISION) && nodes.len() > 1;

    nodes.iter_mut().for_each(canonical_values);
    if let Some(root) = root {
        wye_defaults(&mut nodes, root);
        pec_2017_sizing(&mut nodes, root);
    }
    nodes.iter_mut().for_each(defaults::with_node_defaults);
    defaults::with_project_defaults(&mut project);
    Ok(Migrated {
        project,
        nodes,
        pec_2017_migrated,
    })
}

// Old files stored labels; each maps to its canonical value.
const LEGACY_PHASES: [(&str, &str); 3] = [
    ("1P", phases::ONE_PHASE),
    ("3P-Y", phases::THREE_PHASE_WYE),
    ("3P-Δ", phases::THREE_PHASE_DELTA),
];

const LEGACY_TERMINAL_TEMPERATURES: [(&str, &str); 1] = [("Standard Temperature", "standard")];

const LEGACY_LOAD_TYPES: [(&str, &str); 6] = [
    ("Lighting Load", load_types::LIGHTING_LOAD),
    ("Convenience Outlet", load_types::CONVENIENCE_OUTLET),
    ("General Lighting", load_types::GENERAL_LIGHTING),
    (
        "1P Motor - Rated Horse Power",
        load_types::ONE_P_MOTOR_HORSE_POWER,
    ),
    (
        "1P Motor - Rated Current",
        load_types::ONE_P_MOTOR_RATED_CURRENT,
    ),
    ("Heating Equipment", load_types::HEATING_EQUIPMENT),
];

/// Replaces a legacy label at `node[group][field]`; any other value, including one
/// from a newer version, stays as it is.
fn canonical(node: &mut Value, group: &str, field: &str, legacy: &[(&str, &str)]) {
    let Some(value) = node.get_mut(group).and_then(|group| group.get_mut(field)) else {
        return;
    };
    if let Some((_, canonical)) = legacy.iter().find(|(label, _)| value == label) {
        *value = json!(canonical);
    }
}

fn canonical_values(node: &mut Value) {
    canonical(node, "panel_data", "phase", &LEGACY_PHASES);
    canonical(
        node,
        "panel_data",
        "terminal_temperature",
        &LEGACY_TERMINAL_TEMPERATURES,
    );
    canonical(
        node,
        "load_data",
        "terminal_temperature",
        &LEGACY_TERMINAL_TEMPERATURES,
    );
    canonical(node, "load_data", "load_type", &LEGACY_LOAD_TYPES);
    canonical(node, "highest_unit_form", "phase", &LEGACY_PHASES);
}

/// Sets `node[group][field]`, creating `group` when the node has none.
fn set(node: &mut Value, group: &str, field: &str, value: Value) {
    if !node[group].is_object() {
        node[group] = json!({});
    }
    node[group][field] = value;
}

/// 3P-Y roots could be created in late 2024, before three-phase support; their
/// circuits kept the single-phase defaults (2-pole, 2 conductors). Once per file,
/// those untouched defaults become the 400Y/230 V ones (`defaults::circuit_defaults`);
/// after it, 2-pole on two wires in a 3P-Y file is the user's own choice.
fn wye_defaults(nodes: &mut [Value], root: usize) {
    let form = &nodes[root]["highest_unit_form"];
    if form["phase"] != phases::THREE_PHASE_WYE || truthy(&form["wye_circuit_defaults"]) {
        return;
    }
    set(
        &mut nodes[root],
        "highest_unit_form",
        "wye_circuit_defaults",
        json!(true),
    );
    for (index, node) in nodes.iter_mut().enumerate() {
        if index == root || node["pole"] != "2" || node["conductor_qty"] != 2 {
            continue;
        }
        if let Some((pole, qty)) = defaults::circuit_defaults(node, Some(phases::THREE_PHASE_WYE)) {
            node["pole"] = json!(pole);
            node["conductor_qty"] = json!(qty);
        }
    }
}

/// The PEC 2017 sizing revision a file was migrated to. 1: the sizing tables (breaker
/// ratings, Ch. 10 conduit fill, heating at 125 %), once marked only by `pec_2017_sizing`.
/// 2: conductors by 3.10.2.6(B) and 1.10.1.14(C), continuous loads, dwelling circuits
/// and motor feeders.
fn revision_of(root: &Value) -> u32 {
    let form = &root["highest_unit_form"];
    match form["pec_2017_revision"].as_f64() {
        // A hand-edited fraction or negative reads as the revision below it.
        Some(revision) => revision.max(0.0) as u32,
        None => u32::from(truthy(&form["pec_2017_sizing"])),
    }
}

// Conduit overrides saved before the PEC 2017 audit used the Appendix C metric
// designators; each maps to the same trade size under its PEC 2017 Table 10.1.1.4
// raceway size.
const LEGACY_CONDUIT_SIZES: [(f64, u32); 13] = [
    (16.0, 15),
    (21.0, 20),
    (27.0, 25),
    (35.0, 32),
    (41.0, 40),
    (53.0, 50),
    (63.0, 65),
    (78.0, 80),
    (91.0, 90),
    (103.0, 100),
    (128.0, 130),
    (129.0, 130),
    (155.0, 150),
];

/// The dwelling-unit receptacle presets of PEC 2017 2.10.1.11(C), each a 20 A circuit,
/// with the VA the app gives them: 1500 VA for small-appliance and laundry circuits
/// (2.20.3.13(A), (B)); bathroom and garage receptacles are already in the 24 VA/m²
/// general lighting load (2.20.2.5(J)(1)). Same as the presets in `DEFAULT_LOADS`.
const DWELLING_PRESETS: [(&str, &str, &str); 4] = [
    ("Small Appliance Load", "small_appliance", "1500"),
    ("Laundry Circuit Load", "laundry", "1500"),
    ("Bathroom Branch Circuit", "bathroom", "0"),
    ("Garage Branch Circuit", "garage", "0"),
];

/// Revision 2: a load named after a dwelling-circuit preset gets its 2.10.1.11(C)
/// marker, which keeps it at 20 A. A default load also takes the preset's VA, since
/// default loads cannot edit theirs; a custom load keeps the VA the user typed.
fn dwelling_circuit(node: &mut Value) {
    let load = &node["load_data"];
    if !load.is_object() || truthy(&load["dwelling_circuit"]) {
        return;
    }
    // Stored as "<quantity> - <description>"; only the segment after the first
    // separator is the preset's name.
    let description = load["load_description"]
        .as_str()
        .and_then(|text| text.split(" - ").nth(1));
    let Some((_, circuit, varies)) = DWELLING_PRESETS
        .iter()
        .find(|(preset, _, _)| Some(*preset) == description)
    else {
        return;
    };
    let is_default = load["config_preference"] == "DEFAULT";
    node["load_data"]["dwelling_circuit"] = json!(circuit);
    if is_default {
        node["load_data"]["varies"] = json!(varies);
    }
}

/// Once per revision: brings the file's nodes up to `PEC_2017_REVISION` and records it.
fn pec_2017_sizing(nodes: &mut [Value], root: usize) {
    let revision = revision_of(&nodes[root]);
    if revision >= PEC_2017_REVISION {
        return;
    }
    set(
        &mut nodes[root],
        "highest_unit_form",
        "pec_2017_sizing",
        json!(true),
    );
    set(
        &mut nodes[root],
        "highest_unit_form",
        "pec_2017_revision",
        json!(PEC_2017_REVISION),
    );
    for (index, node) in nodes.iter_mut().enumerate() {
        if index == root {
            continue;
        }
        if revision < 1 {
            let size = node["overrided_conduit_size"].as_f64();
            if let Some((_, trade)) = LEGACY_CONDUIT_SIZES
                .iter()
                .find(|(old, _)| Some(*old) == size)
            {
                node["overrided_conduit_size"] = json!(trade);
            }
        }
        dwelling_circuit(node);
    }
}

/// JavaScript truthiness of a stored flag.
fn truthy(value: &Value) -> bool {
    match value {
        Value::Bool(flag) => *flag,
        Value::Null => false,
        Value::Number(number) => number.as_f64().is_some_and(js::truthy),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}
