//! Opening a file migrates it once to the current format (`migrate::migrate_file`).

use heda_core::defaults::PEC_2017_REVISION;
use heda_core::dispatch::dispatch;
use heda_core::migrate::migrate_file;
use heda_core::session::Session;
use serde_json::{json, Value};

fn project() -> Value {
    json!({ "id": "project", "project_name": "Legacy", "settings": {}, "root_node_id": "root" })
}

/// A file from before canonical values: labels everywhere, no PEC 2017 revision.
fn legacy_nodes() -> Vec<Value> {
    vec![
        json!({
            "id": "root", "node_type": "root", "child_ids": ["panel", "load"],
            "highest_unit_form": { "distribution_unit": "Transformer", "phase": "1P" }
        }),
        json!({
            "id": "panel", "node_type": "panel", "parent_id": "root", "child_ids": [],
            "panel_data": {
                "name": "LP-1", "ambient_temperature": 30,
                "terminal_temperature": "Standard Temperature", "phase": "3P-Y"
            }
        }),
        json!({
            "id": "load", "node_type": "load", "parent_id": "root", "child_ids": [],
            "load_data": {
                "load_description": "10 - Lighting", "ambient_temperature": 30,
                "terminal_temperature": "Standard Temperature", "quantity": 10, "varies": "0",
                "continuous": false, "load_type": "General Lighting", "config_preference": "CUSTOM"
            }
        }),
    ]
}

fn migrate(nodes: Vec<Value>) -> Vec<Value> {
    migrate_file(project(), nodes).unwrap().nodes
}

fn by_id<'a>(nodes: &'a [Value], id: &str) -> &'a Value {
    nodes.iter().find(|node| node["id"] == id).unwrap()
}

#[test]
fn replaces_legacy_labels_with_canonical_values() {
    let nodes = migrate(legacy_nodes());
    assert_eq!(nodes[0]["highest_unit_form"]["phase"], "one_phase");
    assert_eq!(nodes[1]["panel_data"]["phase"], "three_phase_wye");
    assert_eq!(nodes[1]["panel_data"]["terminal_temperature"], "standard");
    assert_eq!(nodes[2]["load_data"]["terminal_temperature"], "standard");
    assert_eq!(nodes[2]["load_data"]["load_type"], "general_lighting");
}

#[test]
fn a_current_file_only_gains_missing_defaults() {
    let mut nodes = migrate(legacy_nodes());
    let again = migrate(nodes.clone());
    assert_eq!(again, nodes);
    // Fields the engine does not model are kept as they were.
    nodes[2]["load_data"]["future_field"] = json!("kept");
    assert_eq!(migrate(nodes)[2]["load_data"]["future_field"], "kept");
}

#[test]
fn leaves_unknown_values_for_newer_formats_alone() {
    let mut nodes = legacy_nodes();
    nodes[1]["panel_data"]["phase"] = json!("future_phase");
    nodes[2]["load_data"]["load_type"] = json!("future_load");
    let nodes = migrate(nodes);
    assert_eq!(nodes[1]["panel_data"]["phase"], "future_phase");
    assert_eq!(nodes[2]["load_data"]["load_type"], "future_load");
}

#[test]
fn completes_every_node_with_its_defaults_and_the_project_with_settings() {
    let mut nodes = legacy_nodes();
    nodes[1]["pole"] = json!("3");
    let migrated = migrate_file(json!({ "id": "project" }), nodes).unwrap();
    assert_eq!(migrated.project["settings"], json!({}));
    assert_eq!(migrated.nodes[1]["pole"], "3");
    for node in &migrated.nodes {
        assert_eq!(node["conductor_sets"], 1);
        assert_eq!(node["conductor_insulation"], "THHN-Cu");
        assert_eq!(node["egc_insulation"], "TW-Cu");
        assert_eq!(node["conduit_type"], "PVC");
        assert_eq!(node["kaic"], "5");
        assert_eq!(node["is_at_used_as_currents_value"], false);
    }
}

#[test]
fn rewrites_untouched_single_phase_defaults_in_a_3p_y_file() {
    let mut nodes = legacy_nodes();
    nodes[0]["highest_unit_form"]["phase"] = json!("3P-Y");
    for node in &mut nodes[1..] {
        node["pole"] = json!("2");
        node["conductor_qty"] = json!(2);
    }
    let nodes = migrate(nodes);
    // LP-1 is a 3P-Y panel: 3-pole, 3 phase + neutral (PEC 2017 App. D Ex. D6 6.3–6.4);
    // the lighting load is 1P line-to-neutral (D6 6.2).
    assert_eq!(
        (&nodes[1]["pole"], &nodes[1]["conductor_qty"]),
        (&json!("3"), &json!(4))
    );
    assert_eq!(
        (&nodes[2]["pole"], &nodes[2]["conductor_qty"]),
        (&json!("1"), &json!(2))
    );
    assert_eq!(nodes[0]["highest_unit_form"]["wye_circuit_defaults"], true);
}

#[test]
fn rewrites_3p_y_defaults_only_once() {
    let mut nodes = legacy_nodes();
    nodes[0]["highest_unit_form"]["phase"] = json!("three_phase_wye");
    let mut nodes = migrate(nodes);
    // The user then picks 2-pole on two wires, saves and reopens.
    nodes[2]["pole"] = json!("2");
    nodes[2]["conductor_qty"] = json!(2);
    let reopened = migrate(nodes);
    assert_eq!(reopened[2]["pole"], "2");
    assert_eq!(reopened[2]["conductor_qty"], 2);
}

#[test]
fn keeps_poles_a_user_changed_and_single_phase_files_as_they_are() {
    let mut wye = legacy_nodes();
    wye[0]["highest_unit_form"]["phase"] = json!("three_phase_wye");
    wye[2]["pole"] = json!("2");
    wye[2]["conductor_qty"] = json!(3);
    assert_eq!(migrate(wye)[2]["pole"], "2");

    let mut single = legacy_nodes();
    single[2]["pole"] = json!("2");
    single[2]["conductor_qty"] = json!(2);
    assert_eq!(migrate(single)[2]["pole"], "2");
}

#[test]
fn flags_a_pre_pec_file_for_the_notice_then_marks_it_once() {
    let migrated = migrate_file(project(), legacy_nodes()).unwrap();
    assert!(migrated.pec_2017_migrated);
    let form = &migrated.nodes[0]["highest_unit_form"];
    assert_eq!(form["pec_2017_sizing"], true);
    assert_eq!(form["pec_2017_revision"], PEC_2017_REVISION);
    assert!(
        !migrate_file(project(), migrated.nodes)
            .unwrap()
            .pec_2017_migrated
    );
}

#[test]
fn flags_a_file_at_the_first_revision() {
    let mut nodes = legacy_nodes();
    nodes[0]["highest_unit_form"]["pec_2017_sizing"] = json!(true);
    let migrated = migrate_file(project(), nodes).unwrap();
    assert!(migrated.pec_2017_migrated);
    assert_eq!(
        migrated.nodes[0]["highest_unit_form"]["pec_2017_revision"],
        PEC_2017_REVISION
    );
}

#[test]
fn skips_the_notice_for_a_file_with_only_its_root() {
    let mut nodes = legacy_nodes();
    nodes.truncate(1);
    nodes[0]["child_ids"] = json!([]);
    assert!(!migrate_file(project(), nodes).unwrap().pec_2017_migrated);
}

/// PEC 2017 2.10.1.11(C): small-appliance, laundry, bathroom and garage receptacle
/// circuits are 20 A; bathroom receptacles add no load by 2.20.2.5(J)(1).
#[test]
fn marks_dwelling_circuit_presets() {
    let mut nodes = legacy_nodes();
    nodes[0]["highest_unit_form"]["pec_2017_sizing"] = json!(true);
    let preset = |id: &str, description: &str, preference: &str| {
        let mut node = nodes[2].clone();
        node["id"] = json!(id);
        node["load_data"]["load_description"] = json!(format!("1 - {description}"));
        node["load_data"]["varies"] = json!("1500");
        node["load_data"]["load_type"] = json!("convenience_outlet");
        node["load_data"]["config_preference"] = json!(preference);
        node
    };
    let added = [
        preset("bath", "Bathroom Branch Circuit", "DEFAULT"),
        preset("kitchen", "Small Appliance Load", "DEFAULT"),
        // A custom load keeps the VA the user typed, but is still the 20 A garage circuit.
        preset("custom", "Garage Branch Circuit", "CUSTOM"),
        preset("other", "Kitchen Outlets", "CUSTOM"),
    ];
    nodes.extend(added);
    let nodes = migrate(nodes);
    let load = |id| &by_id(&nodes, id)["load_data"];
    assert_eq!(
        (&load("bath")["dwelling_circuit"], &load("bath")["varies"]),
        (&json!("bathroom"), &json!("0"))
    );
    assert_eq!(load("kitchen")["dwelling_circuit"], "small_appliance");
    assert_eq!(load("kitchen")["varies"], "1500");
    assert_eq!(load("custom")["dwelling_circuit"], "garage");
    assert_eq!(load("custom")["varies"], "1500");
    assert!(load("other").get("dwelling_circuit").is_none());
}

#[test]
fn marks_dwelling_circuits_only_once() {
    let mut nodes = legacy_nodes();
    nodes[2]["load_data"]["load_description"] = json!("1 - Laundry Circuit Load");
    nodes[2]["load_data"]["config_preference"] = json!("DEFAULT");
    let mut nodes = migrate(nodes);
    assert_eq!(nodes[2]["load_data"]["dwelling_circuit"], "laundry");
    // The user then sets it to none.
    nodes[2]["load_data"]
        .as_object_mut()
        .unwrap()
        .remove("dwelling_circuit");
    assert!(migrate(nodes)[2]["load_data"]
        .get("dwelling_circuit")
        .is_none());
}

/// Old Appendix C metric designators become the PEC 2017 Table 10.1.1.4 trade sizes.
#[test]
fn maps_old_conduit_overrides_to_trade_sizes() {
    let mut nodes = legacy_nodes();
    nodes[1]["overrided_conduit_size"] = json!(21);
    nodes[2]["overrided_conduit_size"] = json!(155);
    let nodes = migrate(nodes);
    assert_eq!(nodes[1]["overrided_conduit_size"], 20);
    assert_eq!(nodes[2]["overrided_conduit_size"], 150);
}

#[test]
fn maps_conduit_overrides_only_once() {
    let mut nodes = legacy_nodes();
    nodes[0]["highest_unit_form"]["pec_2017_sizing"] = json!(true);
    nodes[1]["overrided_conduit_size"] = json!(16);
    assert_eq!(migrate(nodes)[1]["overrided_conduit_size"], 16);
}

#[test]
fn rejects_two_nodes_with_one_id() {
    let mut nodes = legacy_nodes();
    nodes.push(nodes[1].clone());
    assert_eq!(
        migrate_file(project(), nodes).err().as_deref(),
        Some("Item with same id already exists")
    );
}

#[test]
fn open_file_answers_the_migrated_session_and_a_rejected_file_empties_it() {
    let mut session = Session::default();
    let opened = dispatch(
        &mut session,
        "open_file",
        json!({ "project": project(), "nodes": legacy_nodes() }),
    )
    .unwrap();
    assert_eq!(opened["pec_2017_migrated"], true);
    assert_eq!(opened["project"]["id"], "project");
    let ids: Vec<&str> = opened["nodes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| n["id"].as_str().unwrap())
        .collect();
    assert_eq!(ids, ["root", "panel", "load"]);
    assert_eq!(opened["nodes"][1]["panel_data"]["phase"], "three_phase_wye");
    assert!(opened["rows"]["load"].is_object());

    let mut nodes = legacy_nodes();
    nodes.push(nodes[2].clone());
    let rejected = dispatch(
        &mut session,
        "open_file",
        json!({ "project": project(), "nodes": nodes }),
    );
    assert!(rejected.is_err());
    let snapshot = dispatch(&mut session, "snapshot", json!({})).unwrap();
    assert_eq!(snapshot["nodes"], json!([]));
    assert_eq!(snapshot["project"], Value::Null);
}
