//! Solar PV systems, PEC 2017 Article 6.90, and their load-side interconnection,
//! 7.5.1.12(B). Every expected value is worked by hand from the PEC (checked on the
//! rendered pages, PDF pp. 695–697 and 735):
//! - 6.90.2.1: the maximum dc voltage is 600 V on one- and two-family dwellings, else
//!   1000 V; (A)(2) takes the series modules' rated Voc × Table 6.90.2.1(A)'s factor.
//! - 6.90.2.2(A)(1)(1): a source circuit's maximum current is Isc × 125 %; (A)(2) an
//!   output circuit's is the sum of the parallel source circuits; (A)(3) an inverter output
//!   circuit's is the inverter's continuous output current rating.
//! - 6.90.2.2(B)(1), 6.90.2.3(B)(1): conductors and overcurrent devices take 125 % of it
//!   (the FPN's 156 % of Isc on a source circuit).
//! - 7.5.1.12(B)(2)(c): 125 % of the inverter current plus the busbar's protective device
//!   within the busbar ampacity, (1), or within 120 % of it with the sources at opposite
//!   ends, (2).

use heda_core::session::Session;
use heda_core::solar::*;
use serde_json::{json, Value};

#[test]
fn table_6_90_2_1_a_corrects_below_25_c() {
    // Each row of the table, at both ends of its range.
    let rows = [
        (24.0, 20.0, 1.02),
        (19.0, 15.0, 1.04),
        (14.0, 10.0, 1.06),
        (9.0, 5.0, 1.08),
        (4.0, 0.0, 1.10),
        (-1.0, -5.0, 1.12),
        (-6.0, -10.0, 1.14),
        (-11.0, -15.0, 1.16),
        (-16.0, -20.0, 1.18),
        (-21.0, -25.0, 1.20),
        (-26.0, -30.0, 1.21),
        (-31.0, -35.0, 1.23),
        (-36.0, -40.0, 1.25),
    ];
    for (warm, cold, factor) in rows {
        assert_eq!(voltage_correction(warm), Some(factor), "{warm} °C");
        assert_eq!(voltage_correction(cold), Some(factor), "{cold} °C");
    }
    // No correction from 25 °C up; between two rows the colder one; nothing past −40 °C.
    assert_eq!(voltage_correction(25.0), Some(1.0));
    assert_eq!(voltage_correction(32.0), Some(1.0));
    assert_eq!(voltage_correction(24.5), Some(1.02));
    assert_eq!(voltage_correction(-0.5), Some(1.12));
    assert_eq!(voltage_correction(-41.0), None);
}

#[test]
fn the_max_voltage_and_its_limit_follow_6_90_2_1() {
    // 10 × 49.5 V at 18 °C (19 to 15: 1.04) = 514.8 V.
    let voltage = max_voltage(49.5, 10.0, 18.0).unwrap();
    assert!((voltage - 514.8).abs() < 1e-9);
    assert_eq!(voltage_limit(true), 600.0);
    assert_eq!(voltage_limit(false), 1000.0);
}

#[test]
fn source_circuits_size_on_156_percent_of_isc() {
    // 13.9 A × 125 % = 17.375 A; × 125 % = 21.71875 A, which is 13.9 A × 156.25 %.
    let max = source_circuit_current(13.9);
    assert!((max - 17.375).abs() < 1e-9);
    assert!((least_rating(max) - 13.9 * 1.5625).abs() < 1e-9);
}

#[test]
fn the_busbar_takes_one_of_the_7_5_1_12_b_2_c_methods() {
    // 22 A inverter on a 100 A main: 27.5 + 100 = 127.5 A.
    assert_eq!(busbar_load(22.0, 100.0), 127.5);
    assert_eq!(busbar_check(127.5, 150.0), Busbar::Anywhere);
    assert_eq!(busbar_check(127.5, 125.0), Busbar::OppositeEnd);
    // 120 % of 100 A is 120 A < 127.5 A.
    assert_eq!(busbar_check(127.5, 100.0), Busbar::Over);
    // 40 A on a 125 A main and busbar: 50 + 125 = 175 A > 150 A.
    assert_eq!(busbar_check(busbar_load(40.0, 125.0), 125.0), Busbar::Over);
    // At exactly 100 % and 120 % the rule is met ("shall not exceed").
    assert_eq!(
        busbar_check(busbar_load(16.0, 80.0), 100.0),
        Busbar::Anywhere
    );
    assert_eq!(
        busbar_check(busbar_load(16.0, 100.0), 100.0),
        Busbar::OppositeEnd
    );
}

fn riser(pv: Value, main_at: f64) -> Vec<(String, Vec<String>)> {
    let nodes = vec![
        json!({ "id": "root", "node_type": "root", "highest_unit_form":
            { "distribution_unit": "Service", "phase": "one_phase", "solar_pv": pv } }),
        json!({ "id": "MDP", "node_type": "panel", "parent_id": "root", "circuit_number": 1,
            "conductor_sets": 1, "conductor_qty": 2, "overrided_at": main_at,
            "panel_data": { "name": "MDP", "phase": "one_phase", "ambient_temperature": 30 } }),
    ];
    let mut session = Session::default();
    session.open(json!({}), nodes).unwrap();
    let layout = session.riser("root").unwrap();
    layout
        .boxes
        .iter()
        .map(|b| (b.id.clone(), b.lines.clone()))
        .collect()
}

fn dwelling_array() -> Value {
    json!({ "module_voc": 49.5, "module_isc": 13.9, "modules_per_string": 10, "strings": 2,
        "lowest_ambient": 18, "dwelling": true, "inverter_current": 22,
        "panel": "MDP", "busbar_rating": 100 })
}

fn lines_of(boxes: &[(String, Vec<String>)], id: &str) -> Vec<String> {
    boxes.iter().find(|(b, _)| b == id).unwrap().1.clone()
}

#[test]
fn the_riser_shows_the_pv_circuits_on_the_service() {
    let boxes = riser(dwelling_array(), 100.0);
    let service = lines_of(&boxes, "root");
    let start = service
        .iter()
        .position(|l| l.starts_with("Solar PV"))
        .unwrap();
    assert_eq!(
        service[start..],
        [
            "Solar PV: 2 × 10 modules",
            "PV max voltage: 514.8 V",
            // 6.90.2.5: 514.8 V is 80 V dc or more.
            "PV dc arc-fault protection required",
            // 17.375 A, 21.71875 A; output 2 × 17.375 = 34.75 A, × 125 % = 43.4375 A.
            "PV source circuit: 17.38 A",
            "PV source cond./OCPD ≥ 21.72 A",
            "PV output circuit: 34.75 A",
            "PV output cond./OCPD ≥ 43.44 A",
            // 22 A × 125 % = 27.5 A; the next standard rating (Table 2.40.1.6(A)) is 30 A.
            "Inverter output: 22 A",
            "Inverter cond. ≥ 27.5 A, OCPD 30 A",
        ]
    );
}

#[test]
fn the_back_fed_panel_shows_its_busbar_check() {
    let boxes = riser(dwelling_array(), 100.0);
    // 27.5 + 100 = 127.5 A is over 120 % of the 100 A busbar (120 A).
    assert_eq!(
        lines_of(&boxes, "MDP").last().unwrap(),
        "PV on busbar: 127.5 A of 100 A, OVER"
    );
    // On an 80 A main: 27.5 + 80 = 107.5 A, within 120 % of 100 A only.
    let boxes = riser(dwelling_array(), 80.0);
    let mdp = lines_of(&boxes, "MDP");
    assert_eq!(
        mdp[mdp.len() - 2..],
        [
            "PV on busbar: 107.5 A of 100 A",
            "PV CB at end opposite main"
        ]
    );
    let mut pv = dwelling_array();
    pv["busbar_rating"] = json!(150);
    assert_eq!(
        lines_of(&riser(pv, 80.0), "MDP").last().unwrap(),
        "PV on busbar: 107.5 A of 150 A"
    );
}

#[test]
fn twelve_modules_are_over_600_v_on_a_dwelling_only() {
    // 12 × 49.5 V × 1.04 = 617.76 V.
    let mut pv = dwelling_array();
    pv["modules_per_string"] = json!(12);
    let service = lines_of(&riser(pv.clone(), 100.0), "root");
    assert!(service.contains(&"PV max voltage: 617.76 V, OVER 600 V".to_string()));
    pv["dwelling"] = json!(false);
    let service = lines_of(&riser(pv, 100.0), "root");
    assert!(service.contains(&"PV max voltage: 617.76 V".to_string()));
}

#[test]
fn a_partial_system_shows_only_what_its_inputs_give() {
    let boxes = riser(json!({ "panel": "MDP" }), 100.0);
    assert!(!lines_of(&boxes, "root").iter().any(|l| l.contains("PV")));
    assert_eq!(lines_of(&boxes, "MDP").last().unwrap(), "PV back-fed");
    let boxes = riser(json!({ "panel": "MDP", "inverter_current": 22 }), 100.0);
    assert_eq!(
        lines_of(&boxes, "MDP").last().unwrap(),
        "PV back-fed, busbar rating not set"
    );
    // One string: no output circuit line.
    let service = lines_of(&riser(json!({ "module_isc": 13.9 }), 100.0), "root");
    assert!(!service.iter().any(|l| l.starts_with("PV output")));
}

#[test]
fn arc_fault_protection_starts_at_80_v_dc() {
    // 6.90.2.5: "80 volts dc or greater".
    assert!(needs_arc_fault_protection(80.0));
    assert!(!needs_arc_fault_protection(79.99));
    // 2 × 40 V at 25 °C (no correction) is exactly 80 V; 2 × 39 V × 1.02 at 20 °C is 79.56 V.
    let service = lines_of(
        &riser(
            json!({ "module_voc": 40, "modules_per_string": 2, "lowest_ambient": 25 }),
            100.0,
        ),
        "root",
    );
    assert!(service.contains(&"PV dc arc-fault protection required".to_string()));
    let service = lines_of(
        &riser(
            json!({ "module_voc": 39, "modules_per_string": 2, "lowest_ambient": 20 }),
            100.0,
        ),
        "root",
    );
    assert!(!service.iter().any(|l| l.contains("arc-fault")));
}
