//! The optional standby generator, PEC 2017 Article 7.2 and 4.45.1.13: its load is the
//! calculated load of the panels it carries (7.2.1.4(B), by Article 2.20), all of which an
//! automatically transferred source must supply ((B)(2)(a)), and its conductors carry at
//! least 115 % of its nameplate current (4.45.1.13(A)).

use heda_core::session::Session;
use heda_core::sizing::{generator_conductor_ampacity, rated_current};
use serde_json::{json, Value};

fn panel(id: &str, parent: &str, circuit: f64) -> Value {
    json!({ "id": id, "node_type": "panel", "parent_id": parent, "circuit_number": circuit,
        "conductor_sets": 1, "conductor_qty": 2,
        "panel_data": { "name": id, "phase": "one_phase", "ambient_temperature": 30 } })
}

fn lighting(id: &str, parent: &str, va: f64) -> Value {
    json!({ "id": id, "node_type": "load", "parent_id": parent, "circuit_number": 1,
        "conductor_sets": 1, "conductor_qty": 2,
        "load_data": { "load_type": "lighting_load", "quantity": 1, "varies": va } })
}

fn service_lines(source: Value) -> Vec<String> {
    let mut form = json!({ "distribution_unit": "Service", "phase": "one_phase" });
    form.as_object_mut()
        .unwrap()
        .extend(source.as_object().unwrap().clone());
    let nodes = vec![
        json!({ "id": "root", "node_type": "root", "highest_unit_form": form }),
        panel("MDP", "root", 1.0),
        panel("LP-1", "MDP", 1.0),
        panel("LP-2", "MDP", 2.0),
        panel("EP", "LP-1", 2.0),
        lighting("L1", "LP-1", 4000.0),
        lighting("L2", "LP-2", 6000.0),
        lighting("L3", "EP", 3000.0),
    ];
    let mut session = Session::default();
    session.open(json!({}), nodes).unwrap();
    session.riser("root").unwrap().boxes[0].lines.clone()
}

#[test]
fn conductors_carry_115_percent_of_the_nameplate_current() {
    // 25 kVA at 230 V is 108.7 A; × 1.15 = 125 A.
    let one = rated_current(25.0, Some("one_phase")).unwrap();
    assert_eq!(generator_conductor_ampacity(one), 125.0);
    // 100 kVA at 400 V three-phase is 144.3 A; × 1.15 = 166.0 A.
    let wye = rated_current(100.0, Some("three_phase_wye")).unwrap();
    assert!((generator_conductor_ampacity(wye) - 165.99).abs() < 0.01);
}

#[test]
fn the_standby_load_counts_each_chosen_panel_once() {
    // LP-1 (4 + 3 kVA, with EP under it) and EP chosen: 7 kVA, not 10.
    let lines = service_lines(json!({ "standby_panels": ["LP-1", "EP"] }));
    assert_eq!(lines[1..], ["Standby load: 7 kVA"]);
    let lines = service_lines(json!({ "standby_panels": ["LP-1", "LP-2"], "generator_kva": 25 }));
    assert_eq!(
        lines[1..],
        [
            "Generator: 25 kVA",
            "Standby load: 13 kVA",
            "Gen. conductors ≥ 125 A"
        ]
    );
}

#[test]
fn a_generator_too_small_for_its_panels_is_flagged() {
    let lines = service_lines(json!({ "standby_panels": ["MDP"], "generator_kva": 10 }));
    assert_eq!(lines[2], "Standby load: 13 kVA, OVER");
    assert!(service_lines(json!({}))[1..].is_empty());
}

#[test]
fn the_chosen_panels_are_marked() {
    let mut session = Session::default();
    let nodes = vec![
        json!({ "id": "root", "node_type": "root",
            "highest_unit_form": { "phase": "one_phase", "standby_panels": ["MDP"] } }),
        panel("MDP", "root", 1.0),
    ];
    session.open(json!({}), nodes).unwrap();
    let layout = session.riser("root").unwrap();
    let mdp = layout.boxes.iter().find(|b| b.id == "MDP").unwrap();
    assert_eq!(mdp.lines.last().unwrap(), "On standby generator");
}
