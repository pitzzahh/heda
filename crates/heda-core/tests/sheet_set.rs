//! The permit sheet set (#287): PEC 2017 1.3.1.1 sheet sizes and the 1.3.2.2 title block
//! on the riser diagram, schedules of loads and computation sheets.

use heda_core::session::Session;
use serde_json::{json, Value};

fn project(sheet_size: &str) -> Value {
    json!({
        "id": "p", "root_node_id": "root", "settings": {},
        "title_block": {
            "location": "Lahug, Cebu City", "owner_name": "Maria Santos",
            "engineer_name": "Juan Dela Cruz, PEE", "prc_license_number": "0012345",
            "prc_license_validity": "2028-12-31", "ptr_number": "PTR-1", "tin": "123-456-789-000",
            "sheet_size": sheet_size
        }
    })
}

fn nodes(source: bool) -> Vec<Value> {
    let mut form = json!({ "distribution_unit": "Utility Service", "phase": "one_phase" });
    if source {
        form["utility_sc_kva"] = json!(1_000_000);
        form["transformer_kva"] = json!(100);
        form["transformer_z_percent"] = json!(2.5);
    }
    let panel = |id: &str, parent: &str, circuit: f64| {
        json!({
            "id": id, "node_type": "panel", "parent_id": parent, "circuit_number": circuit,
            "conductor_sets": 1, "conductor_qty": 2, "pole": "2", "length": 20,
            "conductor_insulation": "THHN-Cu", "egc_insulation": "TW-Cu", "conduit_type": "PVC",
            "panel_data": { "name": id, "phase": "one_phase", "ambient_temperature": 30 }
        })
    };
    let load = |id: &str, circuit: f64, extra: Value| {
        let mut node = json!({
            "id": id, "node_type": "load", "parent_id": "LP-1", "circuit_number": circuit,
            "conductor_sets": 1, "conductor_qty": 2, "pole": "1", "length": 15,
            "load_data": { "load_description": id, "load_type": "lighting_load", "quantity": 1, "varies": 400 }
        });
        for (key, value) in extra.as_object().unwrap() {
            node[key] = value.clone();
        }
        node
    };
    vec![
        json!({ "id": "root", "node_type": "root", "highest_unit_form": form }),
        panel("MDP", "root", 1.0),
        panel("LP-1", "MDP", 1.0),
        load("Lights", 1.0, json!({})),
        // The engineer set this breaker to 30 A.
        load("Outlets", 2.0, json!({ "overrided_at": 30 })),
    ]
}

fn sheets(sheet_size: &str, source: bool) -> Vec<(String, Vec<String>)> {
    let mut session = Session::default();
    session.open(project(sheet_size), nodes(source)).unwrap();
    session
        .sheet_set_texts("Sunrise Apartment".into(), "2026-11-19".into())
        .unwrap()
}

#[test]
fn every_sheet_carries_the_1_3_2_2_title_block() {
    let sheets = sheets("760x1000", true);
    let titles: Vec<&str> = sheets.iter().map(|(title, _)| title.as_str()).collect();
    assert_eq!(
        titles,
        [
            "RISER DIAGRAM",
            "SCHEDULE OF LOADS",
            "VOLTAGE DROP CALCULATION",
            "SHORT CIRCUIT CALCULATION"
        ]
    );
    let count = sheets.len();
    for (i, (title, texts)) in sheets.iter().enumerate() {
        let has = |text: &str| texts.iter().any(|t| t == text);
        // (A) project and location, (B) owner, (C) sheet title, (D) the PEE with PRC
        // license and validity, PTR and TIN, (E) scale and date, (F) sheet number.
        for text in [
            "Sunrise Apartment",
            "Lahug, Cebu City",
            "Maria Santos",
            title.as_str(),
            "Juan Dela Cruz, PEE",
            "PRC License No.: 0012345   Valid until: 2028-12-31",
            "PTR No.: PTR-1   TIN: 123-456-789-000",
            "NTS",
            "2026-11-19",
            &format!("E-{}", i + 1),
            &format!("{} of {count}", i + 1),
        ] {
            assert!(has(text), "sheet {} lacks {text:?}", i + 1);
        }
    }
}

#[test]
fn prints_each_schedule_and_marks_overrides() {
    let sheets = sheets("760x1000", true);
    let schedule = &sheets[1].1;
    let has = |text: &str| schedule.iter().any(|t| t == text);
    for heading in [
        "PANELBOARD SCHEDULE: Utility Service",
        "PANELBOARD SCHEDULE: MDP",
        "PANELBOARD SCHEDULE: LP-1",
        "SUPPLY: 1P + E, 230V, 60Hz",
        "FROM: MDP",
    ] {
        assert!(has(heading), "missing {heading:?}");
    }
    // The overridden breaker reads 30* and the sheet explains the mark.
    assert!(has("30*"));
    assert!(has(
        "* Set by the engineer (override), not the computed value."
    ));
    // Panels total their circuits; the root (the supply) does not.
    assert_eq!(schedule.iter().filter(|t| *t == "TOTAL").count(), 2);
    // Nothing on the other sheets is overridden.
    assert!(!sheets[2].1.iter().any(|t| t.starts_with("* Set by")));
}

#[test]
fn draws_the_riser_with_its_feeder_labels() {
    let sheets = sheets("760x1000", true);
    let riser = &sheets[0].1;
    assert!(riser.iter().any(|t| t == "Utility Service"));
    assert!(riser
        .iter()
        .any(|t| t.starts_with("CKT 1: ") && t.ends_with(" AF, 2P")));
    assert!(riser.iter().any(|t| t.starts_with("Ampacity/load: ")));
}

#[test]
fn skips_the_short_circuit_sheet_without_a_fault_source() {
    let sheets = sheets("760x1000", false);
    assert!(sheets
        .iter()
        .all(|(title, _)| title != "SHORT CIRCUIT CALCULATION"));
}

#[test]
fn writes_a_pdf_on_the_chosen_1_3_1_1_sheet() {
    for (size, media_box) in [
        ("760x1000", "/MediaBox[0 0 2834.6458 2154.3308]"),
        ("A3", "/MediaBox[0 0 1190.5511 841.8898]"),
    ] {
        let mut session = Session::default();
        session.open(project(size), nodes(true)).unwrap();
        let pdf = session
            .sheet_set("Sunrise Apartment".into(), "2026-11-19".into())
            .unwrap();
        if let Ok(path) = std::env::var("SHEET_SET_OUT") {
            std::fs::write(format!("{path}-{size}.pdf"), &pdf).unwrap();
        }
        assert!(pdf.starts_with(b"%PDF-"));
        let text = String::from_utf8_lossy(&pdf);
        assert!(text.contains(media_box), "{size}: no {media_box}");
    }
}

#[test]
fn prints_a_dash_for_a_conductor_beyond_the_table_on_the_short_circuit_sheet() {
    let mut nodes = nodes(true);
    // No insulation takes a 100 °C ambient (Table 3.10.2.6(B)(2)(a) has no factor): no
    // conductor size (-1) for LP-1's circuits.
    nodes[2]["panel_data"]["ambient_temperature"] = json!(100);
    let mut session = Session::default();
    session.open(project("760x1000"), nodes).unwrap();
    let sheets = session
        .sheet_set_texts("Sunrise Apartment".into(), "2026-11-19".into())
        .unwrap();
    let (_, texts) = sheets
        .iter()
        .find(|(title, _)| title == "SHORT CIRCUIT CALCULATION")
        .expect("a short circuit sheet");
    assert!(!texts.iter().any(|t| t == "-1"), "{texts:?}");
}
