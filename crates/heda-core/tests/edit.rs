//! Tree edits planned and committed in the engine (`edit.rs`), and undo/redo.

use heda_core::dispatch::dispatch;
use heda_core::edit::MAX_COPY_NODES;
use heda_core::session::{Session, MAX_HISTORY};
use serde_json::{json, Value};

fn root(phase: &str) -> Value {
    json!({
        "id": "root", "node_type": "root", "child_ids": ["P"],
        "highest_unit_form": { "distribution_unit": "Transformer", "phase": phase }
    })
}

fn panel(id: &str, parent: &str, circuit: f64, phase: &str) -> Value {
    json!({
        "id": id, "node_type": "panel", "parent_id": parent, "circuit_number": circuit,
        "child_ids": [], "pole": "2", "conductor_qty": 2, "length": 10,
        "panel_data": { "name": id, "ambient_temperature": 30, "terminal_temperature": "standard", "phase": phase }
    })
}

fn load_data(load_type: &str, circuit: f64) -> Value {
    json!({
        "load_description": "1 - Lighting", "ambient_temperature": 30,
        "terminal_temperature": "standard", "quantity": 1, "varies": "100",
        "load_type": load_type, "config_preference": "CUSTOM", "circuit_number": circuit, "length": 5
    })
}

/// A project on `phase` with one panel `P` of that phase under the root.
fn session(phase: &str) -> Session {
    let mut session = Session::default();
    session
        .open(
            json!({ "id": "p" }),
            vec![root(phase), panel("P", "root", 1.0, phase)],
        )
        .unwrap();
    session
}

fn run(session: &mut Session, command: &str, args: Value) -> Result<Value, String> {
    dispatch(session, command, args)
}

fn doc(session: &mut Session, id: &str) -> Value {
    let snapshot = run(session, "snapshot", json!({})).unwrap();
    snapshot["nodes"]
        .as_array()
        .unwrap()
        .iter()
        .find(|node| node["id"] == id)
        .cloned()
        .unwrap_or(Value::Null)
}

fn add_load(session: &mut Session, parent: &str, load_type: &str, circuit: f64) -> String {
    let added = run(
        session,
        "add_node",
        json!({ "parent_id": parent, "node": { "load_data": load_data(load_type, circuit) } }),
    )
    .unwrap();
    added["id"].as_str().unwrap().to_owned()
}

/// PEC 2017 App. D Ex. D6: on 400Y/230 V a single-phase load is 1-pole on 2 wires and a
/// three-phase load 3-pole on 3; a 3P-Y sub-panel is 3-pole with a neutral (6.3–6.4).
#[test]
fn a_new_circuit_takes_its_systems_poles_and_wires() {
    let mut session = session("three_phase_wye");
    let lighting = add_load(&mut session, "P", "lighting_load", 1.0);
    let motor = add_load(&mut session, "P", "three_phase_equipment", 2.0);
    let sub = run(
        &mut session,
        "add_node",
        json!({ "parent_id": "P", "node": { "panel_data": {
            "name": "S", "ambient_temperature": 30, "terminal_temperature": "standard",
            "phase": "three_phase_wye", "circuit_number": 3, "length": 4
        } } }),
    )
    .unwrap();
    let sub = sub["id"].as_str().unwrap().to_owned();
    let poles = |session: &mut Session, id: &str| {
        let node = doc(session, id);
        (node["pole"].clone(), node["conductor_qty"].clone())
    };
    assert_eq!(poles(&mut session, &lighting), (json!("1"), json!(2)));
    assert_eq!(poles(&mut session, &motor), (json!("3"), json!(3)));
    assert_eq!(poles(&mut session, &sub), (json!("3"), json!(4)));

    let node = doc(&mut session, &lighting);
    assert_eq!(node["node_type"], "load");
    assert_eq!(node["parent_id"], "P");
    assert_eq!(node["circuit_number"], 1.0);
    assert_eq!(node["length"], 5);
    assert_eq!(node["kaic"], "5");
    assert_eq!(
        doc(&mut session, "P")["child_ids"],
        json!([lighting, motor, sub])
    );
}

#[test]
fn an_added_circuit_answers_its_parents_new_row() {
    let mut session = session("one_phase");
    let added = run(
        &mut session,
        "add_node",
        json!({ "parent_id": "P", "node": { "load_data": load_data("lighting_load", 1.0) } }),
    )
    .unwrap();
    let id = added["id"].as_str().unwrap();
    assert!(added["rows"][id].is_object());
    assert_eq!(added["rows"]["P"]["va"], 100.0);
    assert_eq!(added["history"], json!({ "undo": 1, "redo": 0 }));
    assert_eq!(added["nodes"].as_array().unwrap().len(), 2);
}

/// PEC 2017 2.20.1.5(A): a three-phase circuit needs a three-phase supply.
#[test]
fn refuses_a_circuit_its_panel_cannot_supply() {
    let mut session = session("one_phase");
    let refused = run(
        &mut session,
        "add_node",
        json!({ "parent_id": "P", "node": { "load_data": load_data("three_phase_equipment", 1.0) } }),
    );
    assert_eq!(
        refused,
        Err("A three-phase circuit needs a three-phase supply.".into())
    );
    assert_eq!(
        run(
            &mut session,
            "add_node",
            json!({ "parent_id": "nope", "node": { "load_data": load_data("lighting_load", 1.0) } })
        ),
        Err("Parent node with ID nope not found".into())
    );
    assert_eq!(session.history_depth().undo, 0);
}

#[test]
fn a_new_load_type_takes_its_poles_unless_the_user_changed_them() {
    let mut session = session("three_phase_wye");
    let id = add_load(&mut session, "P", "lighting_load", 1.0);
    let update = |load_type: &str| json!({ "id": id, "parent_id": "P", "node": { "load_data": load_data(load_type, 1.0) } });
    run(&mut session, "update_node", update("three_phase_equipment")).unwrap();
    assert_eq!(doc(&mut session, &id)["pole"], "3");

    // The user picks 2 poles; a later edit keeps them.
    run(
        &mut session,
        "patch_nodes",
        json!({ "patches": [{ "id": id, "set": { "pole": "2" } }] }),
    )
    .unwrap();
    run(&mut session, "update_node", update("lighting_load")).unwrap();
    assert_eq!(doc(&mut session, &id)["pole"], "2");
}

#[test]
fn an_edit_under_another_panel_moves_it_and_drops_its_phase_pick() {
    let mut session = session("three_phase_wye");
    let mut q = panel("Q", "root", 2.0, "three_phase_wye");
    q["pole"] = json!("3");
    q["conductor_qty"] = json!(4);
    session.put(vec![q]).unwrap();
    let id = add_load(&mut session, "P", "lighting_load", 1.0);
    run(
        &mut session,
        "patch_nodes",
        json!({ "patches": [{ "id": id, "set": { "phase_assignment": "C" } }] }),
    )
    .unwrap();
    run(
        &mut session,
        "update_node",
        json!({ "id": id, "parent_id": "Q", "node": { "load_data": load_data("lighting_load", 1.0) } }),
    )
    .unwrap();
    let moved = doc(&mut session, &id);
    assert_eq!(moved["parent_id"], "Q");
    assert!(moved.get("phase_assignment").is_none());
    assert_eq!(doc(&mut session, "P")["child_ids"], json!([]));
    assert_eq!(doc(&mut session, "Q")["child_ids"], json!([id]));
}

#[test]
fn a_panel_feeding_three_phase_circuits_stays_three_phase() {
    let mut session = session("three_phase_wye");
    add_load(&mut session, "P", "three_phase_equipment", 1.0);
    let refused = run(
        &mut session,
        "update_node",
        json!({ "id": "P", "parent_id": "root", "node": { "panel_data": {
            "name": "P", "ambient_temperature": 30, "terminal_temperature": "standard",
            "phase": "one_phase", "circuit_number": 1, "length": 10
        } } }),
    );
    assert_eq!(
        refused,
        Err("This panel feeds three-phase circuits, so it must stay three-phase.".into())
    );
}

#[test]
fn a_move_takes_the_next_free_circuit_number() {
    let mut session = session("one_phase");
    session
        .put(vec![panel("Q", "root", 2.0, "one_phase")])
        .unwrap();
    add_load(&mut session, "Q", "lighting_load", 1.0);
    add_load(&mut session, "Q", "lighting_load", 4.0);
    let id = add_load(&mut session, "P", "lighting_load", 1.0);
    let moved = run(
        &mut session,
        "move_node",
        json!({ "id": id, "parent_id": "Q" }),
    )
    .unwrap();
    assert_eq!(moved["renumbered_to"], 5.0);
    assert_eq!(doc(&mut session, &id)["circuit_number"], 5.0);
    assert_eq!(doc(&mut session, &id)["parent_id"], "Q");
}

#[test]
fn refuses_moves_into_a_load_or_below_itself() {
    let mut session = session("one_phase");
    let sub = run(
        &mut session,
        "add_node",
        json!({ "parent_id": "P", "node": { "panel_data": {
            "name": "S", "ambient_temperature": 30, "terminal_temperature": "standard",
            "phase": "one_phase", "circuit_number": 1, "length": 4
        } } }),
    )
    .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let lighting = add_load(&mut session, &sub, "lighting_load", 1.0);
    assert_eq!(
        run(
            &mut session,
            "move_node",
            json!({ "id": "P", "parent_id": sub })
        ),
        Err("A panel cannot move into itself or a panel below it.".into())
    );
    assert_eq!(
        run(
            &mut session,
            "move_node",
            json!({ "id": "P", "parent_id": lighting })
        ),
        Err("Only a panel can supply a circuit.".into())
    );
}

#[test]
fn removing_takes_the_subtree_and_skips_roots_already_inside_it() {
    let mut session = session("one_phase");
    let a = add_load(&mut session, "P", "lighting_load", 1.0);
    let b = add_load(&mut session, "P", "lighting_load", 2.0);
    let removed = run(
        &mut session,
        "remove_nodes",
        json!({ "ids": ["P", a, "missing"] }),
    )
    .unwrap();
    let mut ids: Vec<&str> = removed["removed"]
        .as_array()
        .unwrap()
        .iter()
        .map(|id| id.as_str().unwrap())
        .collect();
    ids.sort_unstable();
    let mut expected = vec!["P", a.as_str(), b.as_str()];
    expected.sort_unstable();
    assert_eq!(ids, expected);
    assert_eq!(doc(&mut session, "root")["child_ids"], json!([]));
    assert_eq!(doc(&mut session, &b), Value::Null);
}

#[test]
fn copies_take_new_ids_and_the_next_free_numbers() {
    let mut session = session("three_phase_wye");
    let sub = run(
        &mut session,
        "add_node",
        json!({ "parent_id": "P", "node": { "panel_data": {
            "name": "S", "ambient_temperature": 30, "terminal_temperature": "standard",
            "phase": "one_phase", "circuit_number": 1, "length": 4
        } } }),
    )
    .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let inner = add_load(&mut session, &sub, "lighting_load", 3.0);
    add_load(&mut session, "P", "lighting_load", 2.0);
    run(
        &mut session,
        "patch_nodes",
        json!({ "patches": [
            { "id": sub, "set": { "phase_assignment": "C" } },
            { "id": inner, "set": { "phase_assignment": "A" } }
        ] }),
    )
    .unwrap();

    let copied = run(&mut session, "copy_nodes", json!({ "id": sub, "count": 2 })).unwrap();
    let ids: Vec<String> = copied["ids"]
        .as_array()
        .unwrap()
        .iter()
        .map(|id| id.as_str().unwrap().to_owned())
        .collect();
    assert_eq!(ids.len(), 2);
    // Circuits 1 and 2 are taken: the copies are 3 and 4.
    let numbers: Vec<Value> = ids
        .iter()
        .map(|id| doc(&mut session, id)["circuit_number"].clone())
        .collect();
    assert_eq!(numbers, [json!(3.0), json!(4.0)]);
    for id in &ids {
        let copy = doc(&mut session, id);
        assert_ne!(copy["id"], json!(sub));
        assert!(copy.get("phase_assignment").is_none());
        let child = copy["child_ids"][0].as_str().unwrap().to_owned();
        assert_ne!(child, inner);
        let child = doc(&mut session, &child);
        assert_eq!(child["parent_id"], json!(id));
        // The circuit inside keeps its own phase pick and number.
        assert_eq!(child["phase_assignment"], "A");
        assert_eq!(child["circuit_number"], 3.0);
    }
    let children = doc(&mut session, "P")["child_ids"]
        .as_array()
        .unwrap()
        .len();
    assert_eq!(children, 4);
}

#[test]
fn refuses_a_copy_past_the_node_limit() {
    let mut session = session("one_phase");
    add_load(&mut session, "P", "lighting_load", 1.0);
    let count = (MAX_COPY_NODES / 2 + 1) as f64;
    assert_eq!(
        run(
            &mut session,
            "copy_nodes",
            json!({ "id": "P", "count": count })
        ),
        Err(format!(
            "Copy would create more than {MAX_COPY_NODES} nodes"
        ))
    );
    let none = run(&mut session, "copy_nodes", json!({ "id": "P", "count": 0 })).unwrap();
    assert_eq!(none["nodes"], json!([]));
}

#[test]
fn patches_set_remove_and_merge_fields() {
    let mut session = session("one_phase");
    run(
        &mut session,
        "patch_nodes",
        json!({ "patches": [
            { "id": "P", "set": { "overrided_at": 30, "length": null } },
            { "id": "root", "merge": { "highest_unit_form": { "is_service": false } } },
            { "id": "missing", "set": { "pole": "1" } }
        ] }),
    )
    .unwrap();
    let p = doc(&mut session, "P");
    assert_eq!(p["overrided_at"], 30);
    assert!(p.get("length").is_none());
    let form = &doc(&mut session, "root")["highest_unit_form"];
    assert_eq!(form["is_service"], false);
    assert_eq!(form["phase"], "one_phase");
}

#[test]
fn undo_puts_every_touched_node_back_and_redo_makes_it_again() {
    let mut session = session("one_phase");
    let before_p = doc(&mut session, "P");
    let a = add_load(&mut session, "P", "lighting_load", 1.0);
    let after_p = doc(&mut session, "P");

    let undone = run(&mut session, "undo", json!({})).unwrap();
    assert_eq!(undone["removed"], json!([a]));
    assert_eq!(undone["history"], json!({ "undo": 0, "redo": 1 }));
    assert_eq!(doc(&mut session, "P"), before_p);
    assert_eq!(doc(&mut session, &a), Value::Null);
    assert_eq!(undone["rows"]["P"]["va"], 0.0);

    let redone = run(&mut session, "redo", json!({})).unwrap();
    assert_eq!(redone["history"], json!({ "undo": 1, "redo": 0 }));
    assert_eq!(doc(&mut session, "P"), after_p);
    assert_eq!(doc(&mut session, &a)["parent_id"], "P");
}

#[test]
fn undo_brings_back_a_removed_subtree_exactly() {
    let mut session = session("one_phase");
    let a = add_load(&mut session, "P", "lighting_load", 1.0);
    run(
        &mut session,
        "patch_nodes",
        json!({ "patches": [{ "id": a, "set": { "overrided_at": 20 } }] }),
    )
    .unwrap();
    let before = run(&mut session, "snapshot", json!({})).unwrap();
    run(&mut session, "remove_nodes", json!({ "ids": ["P"] })).unwrap();
    run(&mut session, "undo", json!({})).unwrap();
    let after = run(&mut session, "snapshot", json!({})).unwrap();
    let sorted = |snapshot: &Value| {
        let mut nodes = snapshot["nodes"].as_array().unwrap().clone();
        nodes.sort_by_key(|node| node["id"].as_str().unwrap().to_owned());
        nodes
    };
    assert_eq!(sorted(&after), sorted(&before));
    assert_eq!(after["rows"], before["rows"]);
}

#[test]
fn a_new_edit_clears_redo_but_a_no_op_does_not() {
    let mut session = session("one_phase");
    add_load(&mut session, "P", "lighting_load", 1.0);
    run(&mut session, "undo", json!({})).unwrap();
    let pole = |pole: &str| json!({ "patches": [{ "id": "P", "set": { "pole": pole } }] });
    // P already has 2 poles: nothing changes, nothing is recorded.
    let same = run(&mut session, "patch_nodes", pole("2")).unwrap();
    assert_eq!(same["history"], json!({ "undo": 0, "redo": 1 }));
    let changed = run(&mut session, "patch_nodes", pole("1")).unwrap();
    assert_eq!(changed["history"], json!({ "undo": 1, "redo": 0 }));
    // Nothing left to redo, nothing written.
    let nothing = run(&mut session, "redo", json!({})).unwrap();
    assert_eq!(nothing["nodes"], json!([]));
}

#[test]
fn history_keeps_the_last_edits_only_and_a_new_file_starts_without_it() {
    let mut session = session("one_phase");
    for at in 0..(MAX_HISTORY + 5) {
        run(
            &mut session,
            "patch_nodes",
            json!({ "patches": [{ "id": "P", "set": { "overrided_at": at + 15 } }] }),
        )
        .unwrap();
    }
    assert_eq!(session.history_depth().undo, MAX_HISTORY);
    let reopened = run(
        &mut session,
        "open_file",
        json!({ "project": { "id": "p" }, "nodes": [root("one_phase")] }),
    )
    .unwrap();
    assert_eq!(reopened["history"], json!({ "undo": 0, "redo": 0 }));
    assert_eq!(session.history_depth().undo, 0);
}

#[test]
fn a_copy_of_the_session_carries_no_history() {
    let mut session = session("one_phase");
    add_load(&mut session, "P", "lighting_load", 1.0);
    assert_eq!(session.clone().history_depth().undo, 0);
    assert_eq!(session.history_depth().undo, 1);
}

#[test]
fn removing_a_standby_panel_drops_it_from_the_supply_in_one_step() {
    let mut session = Session::default();
    let mut supply = root("one_phase");
    supply["child_ids"] = json!(["P", "Q"]);
    supply["highest_unit_form"]["standby_panels"] = json!(["P", "Q"]);
    session
        .open(
            json!({ "id": "p" }),
            vec![
                supply,
                panel("P", "root", 1.0, "one_phase"),
                panel("Q", "root", 2.0, "one_phase"),
            ],
        )
        .unwrap();
    run(&mut session, "remove_nodes", json!({ "ids": ["P"] })).unwrap();
    let root = doc(&mut session, "root");
    assert_eq!(root["highest_unit_form"]["standby_panels"], json!(["Q"]));
    assert_eq!(root["child_ids"], json!(["Q"]));
    run(&mut session, "undo", json!({})).unwrap();
    let root = doc(&mut session, "root");
    assert_eq!(
        root["highest_unit_form"]["standby_panels"],
        json!(["P", "Q"])
    );
}

/// A sub-panel `S` with one load under `P`, each with a documented selection (PEC 2017 7.0.6.3).
fn documented_subpanel(session: &mut Session) -> (String, String) {
    let sub = run(
        session,
        "add_node",
        json!({ "parent_id": "P", "node": { "panel_data": {
            "name": "S", "ambient_temperature": 30, "terminal_temperature": "standard",
            "phase": "one_phase", "circuit_number": 1, "length": 4
        } } }),
    )
    .unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let inner = add_load(session, &sub, "lighting_load", 1.0);
    run(
        session,
        "patch_nodes",
        json!({ "patches": [
            { "id": sub, "set": { "coordination_reference": "Table A" } },
            { "id": inner, "set": { "coordination_reference": "Table B" } }
        ] }),
    )
    .unwrap();
    (sub, inner)
}

#[test]
fn copies_drop_the_documented_selection_7_0_6_3() {
    let mut session = session("one_phase");
    let (sub, _) = documented_subpanel(&mut session);
    let copied = run(&mut session, "copy_nodes", json!({ "id": sub, "count": 1 })).unwrap();
    let copy = doc(&mut session, copied["ids"][0].as_str().unwrap());
    assert!(copy.get("coordination_reference").is_none());
    let child = doc(&mut session, copy["child_ids"][0].as_str().unwrap());
    assert!(child.get("coordination_reference").is_none());
    assert_eq!(doc(&mut session, &sub)["coordination_reference"], "Table A");
}

#[test]
fn a_move_drops_the_documented_selection_below_it_7_0_6_3() {
    let mut session = session("one_phase");
    session
        .put(vec![panel("Q", "root", 2.0, "one_phase")])
        .unwrap();
    let (sub, inner) = documented_subpanel(&mut session);
    let node = doc(&mut session, &sub);
    run(
        &mut session,
        "update_node",
        json!({ "id": sub, "parent_id": "Q", "node": { "panel_data": node["panel_data"] } }),
    )
    .unwrap();
    assert!(doc(&mut session, &sub)
        .get("coordination_reference")
        .is_none());
    assert!(doc(&mut session, &inner)
        .get("coordination_reference")
        .is_none());
}

#[test]
fn a_dragged_move_drops_the_documented_selection_below_it_7_0_6_3() {
    // The sidebar's drag and drop moves through `move_node`; like a form move, the
    // circuits it carries now have other supply-side devices.
    let mut session = session("one_phase");
    session
        .put(vec![panel("Q", "root", 2.0, "one_phase")])
        .unwrap();
    let (sub, inner) = documented_subpanel(&mut session);
    run(
        &mut session,
        "move_node",
        json!({ "id": sub, "parent_id": "Q" }),
    )
    .unwrap();
    assert!(doc(&mut session, &sub)
        .get("coordination_reference")
        .is_none());
    assert!(doc(&mut session, &inner)
        .get("coordination_reference")
        .is_none());
}

#[test]
fn an_edit_in_place_keeps_the_documented_selection() {
    let mut session = session("one_phase");
    let (sub, inner) = documented_subpanel(&mut session);
    let node = doc(&mut session, &sub);
    run(
        &mut session,
        "update_node",
        json!({ "id": sub, "parent_id": "P", "node": { "panel_data": node["panel_data"] } }),
    )
    .unwrap();
    assert_eq!(doc(&mut session, &sub)["coordination_reference"], "Table A");
    assert_eq!(
        doc(&mut session, &inner)["coordination_reference"],
        "Table B"
    );
}
