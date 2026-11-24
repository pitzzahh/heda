//! Grounding and bonding at the supply, PEC 2017 Article 2.50 (#294).
//! Table values read on the rendered pages: Table 2.50.3.17 (PDF p. 136) and Table
//! 2.50.5.13(C)(1) with its notes (PDF p. 140). heda's conductors are all copper.

use heda_core::session::Session;
use heda_core::sizing::{bonding_jumper_size, gec_size, Egc};
use serde_json::{json, Value};

#[test]
fn gec_pec_2017_table_2_50_3_17_copper() {
    for (area, gec) in [
        (30.0, 8.0),
        (38.0, 14.0),
        (50.0, 14.0),
        (60.0, 22.0),
        (80.0, 22.0),
        (100.0, 30.0),
        (175.0, 30.0),
        (200.0, 50.0),
        (325.0, 50.0),
        (375.0, 60.0),
        (500.0, 60.0),
        (750.0, 80.0),
    ] {
        assert_eq!(gec_size(area), Some(gec), "{area} mm²");
    }
    assert_eq!(gec_size(0.0), None);
}

#[test]
fn bonding_jumper_pec_2017_table_2_50_5_13_c_1_copper() {
    for (area, jumper) in [
        (30.0, 8.0),
        (50.0, 14.0),
        (80.0, 22.0),
        (175.0, 30.0),
        (325.0, 50.0),
        (500.0, 60.0),
    ] {
        assert_eq!(bonding_jumper_size(area), Some(jumper), "{area} mm²");
    }
    // Note 1: over 500 mm², 12½ % of the area. 3 × 250 = 750 mm² → 93.75 mm², so 100 mm².
    assert_eq!(bonding_jumper_size(750.0), Some(100.0));
    // 4 × 500 = 2000 mm² → 250 mm² exactly.
    assert_eq!(bonding_jumper_size(2000.0), Some(250.0));
    assert_eq!(bonding_jumper_size(-1.0), None);
}

fn panel(id: &str, sets: f64, size: f64) -> Value {
    json!({
        "id": id, "node_type": "panel", "parent_id": "root", "circuit_number": 1,
        "conductor_sets": sets, "conductor_qty": 2, "pole": "2", "length": 10,
        "overrided_conductor_size": size,
        "conductor_insulation": "THHN-Cu", "egc_insulation": "TW-Cu", "conduit_type": "PVC",
        "panel_data": { "name": id, "phase": "one_phase", "ambient_temperature": 30 }
    })
}

fn supply_lines(form: Value, panels: Vec<Value>) -> Vec<String> {
    let mut session = Session::default();
    let mut nodes = vec![json!({ "id": "root", "node_type": "root", "highest_unit_form": form })];
    nodes.extend(panels);
    session.open(json!({}), nodes).unwrap();
    let layout = session.riser("root").unwrap();
    layout.boxes[0].lines.clone()
}

#[test]
fn the_service_shows_its_gec_and_main_bonding_jumper() {
    // One set of 38 mm²: Table 2.50.3.17 and Table 2.50.5.13(C)(1) both give 14 mm².
    let lines = supply_lines(
        json!({ "phase": "one_phase" }),
        vec![panel("MDP", 1.0, 38.0)],
    );
    assert_eq!(
        lines[1..3],
        ["GEC ≥ 14 mm² Cu", "Main bonding jumper ≥ 14 mm² Cu"]
    );
}

#[test]
fn parallel_sets_count_by_their_equivalent_area() {
    // 3 sets × 250 mm² = 750 mm²: GEC 80 mm²; jumper 12½ % → 100 mm² (Note 1).
    let lines = supply_lines(
        json!({ "phase": "one_phase" }),
        vec![panel("MDP", 3.0, 250.0)],
    );
    assert_eq!(
        lines[1..3],
        ["GEC ≥ 80 mm² Cu", "Main bonding jumper ≥ 100 mm² Cu"]
    );
}

#[test]
fn the_sets_of_each_service_disconnect_add_up_note_3() {
    // Two service panels of 100 mm² each: 200 mm² → GEC 50 mm², jumper 50 mm².
    let lines = supply_lines(
        json!({ "phase": "one_phase" }),
        vec![panel("MDP-1", 1.0, 100.0), panel("MDP-2", 1.0, 100.0)],
    );
    assert_eq!(
        lines[1..3],
        ["GEC ≥ 50 mm² Cu", "Main bonding jumper ≥ 50 mm² Cu"]
    );
}

#[test]
fn a_transformer_is_a_separately_derived_system_with_a_system_bonding_jumper() {
    // 2.50.2.11(A)(1) and (A)(5): sized the same way, from the derived conductors.
    let lines = supply_lines(
        json!({ "phase": "one_phase", "transformer_kva": 50 }),
        vec![panel("MDP", 1.0, 60.0)],
    );
    assert!(lines.contains(&"GEC ≥ 22 mm² Cu".to_string()), "{lines:?}");
    assert!(lines.contains(&"System bonding jumper ≥ 22 mm² Cu".to_string()));
}

#[test]
fn an_upsized_feeder_grows_its_egc_pec_2017_2_50_6_13_b() {
    let mut session = Session::default();
    let mut lp = panel("LP", 1.0, 0.0);
    lp.as_object_mut()
        .unwrap()
        .remove("overrided_conductor_size");
    let load = |id: &str, size: Option<f64>, egc: Option<f64>| {
        let mut node = json!({
            "id": id, "node_type": "load", "parent_id": "LP", "circuit_number": 1,
            "conductor_sets": 1, "conductor_qty": 2, "length": 10,
            "overrided_at": 60,
            "load_data": { "load_type": "lighting_load", "quantity": 1, "varies": 400 }
        });
        if let Some(size) = size {
            node["overrided_conductor_size"] = json!(size);
        }
        if let Some(egc) = egc {
            node["overrided_egc_size"] = json!(egc);
        }
        node
    };
    session
        .open(
            json!({}),
            vec![
                json!({ "id": "root", "node_type": "root",
                        "highest_unit_form": { "phase": "one_phase" } }),
                lp,
                load("plain", None, None),
                load("upsized", Some(80.0), None),
                load("set", Some(80.0), Some(5.5)),
            ],
        )
        .unwrap();
    let rows = session.snapshot().computed.rows;
    // 60 AT: Table 2.50.6.13 gives 5.5 mm². The 60 A breaker must protect the conductor
    // (2.40.1.4): at 60 °C terminations (1.10.1.14(C)) 14 mm² carries 55 A, 22 mm² 70 A.
    assert_eq!(rows["plain"].egc_size, Egc::Size(5.5));
    assert_eq!(rows["plain"].conductor_size, 22.0);
    // Upsized to 80 mm²: 5.5 × 80 / 22 = 20 mm², so the next standard size, 22 mm².
    assert_eq!(rows["upsized"].egc_size, Egc::Size(22.0));
    // The engineer's EGC stands.
    assert_eq!(rows["set"].egc_size, Egc::Size(5.5));
}

#[test]
fn an_unsized_supply_conductor_gives_no_gec_size() {
    // 500 kVA at 230 V is 2 174 A: no conductor in Table 3.10.2.6(B)(16) carries it, so
    // the supply's equivalent area, and the GEC and jumper sized on it, are unknown.
    let mut big = panel("BIG", 1.0, 0.0);
    big.as_object_mut()
        .unwrap()
        .remove("overrided_conductor_size");
    big["circuit_number"] = json!(2);
    let load = json!({
        "id": "l", "node_type": "load", "parent_id": "BIG", "circuit_number": 1,
        "conductor_sets": 1, "conductor_qty": 2, "length": 10,
        "load_data": { "load_type": "lighting_load", "quantity": 1, "varies": 500_000 }
    });
    let mut session = Session::default();
    session
        .open(
            json!({}),
            vec![
                json!({ "id": "root", "node_type": "root",
                        "highest_unit_form": { "phase": "one_phase" } }),
                panel("MDP", 1.0, 38.0),
                big,
                load,
            ],
        )
        .unwrap();
    assert_eq!(session.snapshot().computed.rows["BIG"].conductor_size, -1.0);
    let lines = session.riser("root").unwrap().boxes[0].lines.clone();
    assert_eq!(
        lines[1..3],
        [
            "GEC: supply conductors unsized",
            "Main bonding jumper: unsized"
        ]
    );
}
