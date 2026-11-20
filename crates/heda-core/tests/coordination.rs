//! Selective coordination, PEC 2017 7.0.6.3, 7.1.4.3, 7.8.4.5 and 6.45.1.27 (#293).

use heda_core::coordination::{Status, System};
use heda_core::session::Session;
use serde_json::{json, Value};

fn root(form: Value) -> Value {
    json!({ "id": "root", "node_type": "root", "highest_unit_form": form })
}

fn panel(id: &str, parent: &str, at: f64, system: Option<&str>) -> Value {
    json!({
        "id": id, "node_type": "panel", "parent_id": parent, "circuit_number": 1,
        "conductor_sets": 1, "conductor_qty": 2, "pole": "2", "length": 10,
        "conductor_insulation": "THHN-Cu", "conduit_type": "PVC", "overrided_at": at,
        "panel_data": { "name": id, "phase": "one_phase", "ambient_temperature": 30, "system": system }
    })
}

fn load(id: &str, parent: &str, at: f64) -> Value {
    json!({
        "id": id, "node_type": "load", "parent_id": parent, "circuit_number": 1,
        "conductor_sets": 1, "conductor_qty": 2, "length": 10, "overrided_at": at,
        "load_data": { "load_description": id, "load_type": "lighting_load", "quantity": 1, "varies": 400 }
    })
}

fn study(nodes: Vec<Value>) -> Vec<(String, String, Status)> {
    let mut session = Session::default();
    session.open(json!({}), nodes).unwrap();
    session
        .coordination()
        .into_iter()
        .map(|p| (p.upstream.id, p.downstream.id, p.status))
        .collect()
}

fn pair(up: &str, down: &str, status: Status) -> (String, String, Status) {
    (up.into(), down.into(), status)
}

/// MDP (200 AT) feeds the emergency panel EP (100 AT) and a normal panel LP (60 AT).
fn emergency_project(extra: Vec<Value>) -> Vec<Value> {
    let mut nodes = vec![
        root(json!({ "phase": "one_phase" })),
        panel("MDP", "root", 200.0, None),
        panel("EP", "MDP", 100.0, Some("emergency")),
        load("e1", "EP", 20.0),
        load("e2", "EP", 20.0),
        panel("LP", "MDP", 60.0, None),
        load("l1", "LP", 20.0),
    ];
    nodes.extend(extra);
    nodes
}

#[test]
fn every_emergency_device_pairs_with_all_supply_side_devices_7_0_6_3() {
    use Status::NeedsDocumentation as Needs;
    assert_eq!(
        study(emergency_project(vec![])),
        [
            // EP's own device with MDP; then each branch with EP and with MDP.
            pair("MDP", "EP", Needs),
            pair("EP", "e1", Needs),
            pair("MDP", "e1", Needs),
            pair("EP", "e2", Needs),
            pair("MDP", "e2", Needs),
        ],
        "the normal panel LP is not part of the requirement"
    );
}

#[test]
fn the_engineers_documented_selection_settles_a_pair() {
    let mut nodes = emergency_project(vec![]);
    nodes[3]["coordination_reference"] = json!("  Maker X selectivity table, 2024 ed.  ");
    let documented = Status::Documented {
        reference: "Maker X selectivity table, 2024 ed.".into(),
    };
    let pairs = study(nodes);
    assert_eq!(pairs[1], pair("EP", "e1", documented.clone()));
    assert_eq!(pairs[2], pair("MDP", "e1", documented));
}

#[test]
fn a_downstream_device_rated_at_or_above_its_supply_side_one_is_not_selective() {
    // By the definition (Article 1.0), selectivity covers overloads: a 100 AT branch on a
    // 100 AT panel main cannot leave the main closed on an overload of the branch.
    let pairs = study(emergency_project(vec![load("big", "EP", 100.0)]));
    assert!(pairs.contains(&pair("EP", "big", Status::NotSelective)));
    assert!(pairs.contains(&pair("MDP", "big", Status::NeedsDocumentation)));
}

#[test]
fn devices_in_series_with_nothing_in_parallel_are_exempt() {
    // The Exception to 7.0.6.3: MDP feeds only EP, and EP only e1.
    let nodes = vec![
        root(json!({ "phase": "one_phase" })),
        panel("MDP", "root", 200.0, None),
        panel("EP", "MDP", 100.0, Some("legally_required_standby")),
        load("e1", "EP", 20.0),
    ];
    assert_eq!(
        study(nodes),
        [
            pair("MDP", "EP", Status::Exempt),
            pair("EP", "e1", Status::Exempt),
            pair("MDP", "e1", Status::Exempt),
        ]
    );
}

#[test]
fn critical_operations_data_systems_have_no_series_exception_6_45_1_27() {
    let nodes = vec![
        root(json!({ "phase": "one_phase" })),
        panel("MDP", "root", 200.0, None),
        panel("DP", "MDP", 100.0, Some("critical_operations_data")),
        load("rack", "DP", 20.0),
    ];
    let pairs = study(nodes);
    assert!(pairs
        .iter()
        .all(|(_, _, s)| *s == Status::NeedsDocumentation));
    assert_eq!(pairs.len(), 3);
}

#[test]
fn names_the_requiring_section_and_carries_the_available_fault_current() {
    let mut session = Session::default();
    let mut nodes = emergency_project(vec![]);
    nodes[0] = root(json!({
        "phase": "one_phase", "utility_sc_kva": 1_000_000,
        "transformer_kva": 100, "transformer_z_percent": 2.5
    }));
    nodes[2]["panel_data"]["system"] = json!("critical_operations_power");
    session.open(json!({}), nodes).unwrap();
    let faults = session.short_circuits();
    let pairs = session.coordination();
    let e1 = pairs.iter().find(|p| p.downstream.id == "e1").unwrap();
    assert_eq!(e1.system, System::CriticalOperationsPower);
    assert_eq!(e1.section, "7.8.4.5");
    let at_e1 = faults
        .iter()
        .find(|f| f.id == "e1")
        .unwrap()
        .node_fault_current;
    assert!(at_e1.is_some());
    assert_eq!(e1.available_fault_current, at_e1);
}

#[test]
fn a_project_without_listed_systems_has_nothing_to_coordinate() {
    let nodes = vec![
        root(json!({ "phase": "one_phase" })),
        panel("MDP", "root", 200.0, None),
        load("l1", "MDP", 20.0),
    ];
    assert!(study(nodes).is_empty());
}
