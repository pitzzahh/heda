//! Solar PV systems, PEC 2017 Article 6.90, and their load-side interconnection,
//! 7.5.1.12(B). Every expected value is worked by hand from the PEC (checked on the
//! rendered pages, PDF pp. 695–697 and 735):
//! - 6.90.2.1: the maximum dc voltage is 600 V on one- and two-family dwellings, 1000 V
//!   on other buildings, 1500 V for listed equipment away from buildings; (A)(2) takes the series modules' rated Voc × Table 6.90.2.1(A)'s factor.
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
    assert_eq!(voltage_limit("one_two_family"), Some(600.0));
    assert_eq!(voltage_limit("multifamily"), Some(1000.0));
    assert_eq!(voltage_limit("other"), Some(1000.0));
    // Not on or in a building: listed equipment up to 1500 V.
    assert_eq!(voltage_limit("none"), Some(1500.0));
    assert_eq!(voltage_limit(""), None);
}

#[test]
fn source_circuits_size_on_156_percent_of_isc() {
    // 13.9 A × 125 % = 17.375 A; × 125 % = 21.71875 A, which is 13.9 A × 156.25 %.
    let max = source_circuit_current(13.9);
    assert!((max - 17.375).abs() < 1e-9);
    assert!((least_rating(max) - 13.9 * 1.5625).abs() < 1e-9);
}

fn back_fed(inverter_current: f64, main_at: f64, busbar_rating: f64) -> BackFed {
    BackFed {
        inverter_current,
        main_at,
        busbar_rating,
        load_ocpds: 0.0,
        center_fed: false,
        dwelling: false,
        load_current: 0.0,
        engineered: false,
    }
}

#[test]
fn the_busbar_takes_one_of_the_7_5_1_12_b_2_c_methods() {
    // 22 A inverter on a 100 A main: 27.5 + 100 = 127.5 A; its breaker is 30 A.
    assert_eq!(busbar_load(22.0, 100.0), 127.5);
    assert_eq!(inverter_ocpd(22.0), 30.0);
    // (1): 127.5 A ≤ 150 A.
    assert_eq!(
        busbar_method(back_fed(22.0, 100.0, 150.0)),
        Busbar::Anywhere
    );
    // (2): 127.5 A ≤ 120 % × 125 A = 150 A.
    assert_eq!(
        busbar_method(back_fed(22.0, 100.0, 125.0)),
        Busbar::OppositeEnd
    );
    // At exactly 100 % and 120 % the rule is met ("shall not exceed"): 20 + 80, 20 + 100.
    assert_eq!(busbar_method(back_fed(16.0, 80.0, 100.0)), Busbar::Anywhere);
    assert_eq!(
        busbar_method(back_fed(16.0, 100.0, 100.0)),
        Busbar::OppositeEnd
    );
}

#[test]
fn a_center_fed_panel_takes_method_4_in_a_dwelling_only() {
    // 27.5 + 80 = 107.5 A ≤ 120 A, but a center-fed busbar has no end opposite its main.
    let center = BackFed {
        center_fed: true,
        load_ocpds: 80.0,
        ..back_fed(22.0, 80.0, 100.0)
    };
    // Not a dwelling: (3) is left, 80 + 30 = 110 A > 100 A.
    assert_eq!(busbar_method(center), Busbar::Over);
    // (4): in a dwelling, at either end but not both, within 120 %.
    let dwelling = BackFed {
        dwelling: true,
        ..center
    };
    assert_eq!(busbar_method(dwelling), Busbar::EitherEnd);
}

#[test]
fn method_3_sums_every_breaker_but_the_main() {
    // 127.5 A > 120 A rules out (1) and (2); 70 A of load breakers + the 30 A inverter
    // breaker = 100 A, not over the 100 A busbar, and the 100 A main is within its rating.
    let panel = BackFed {
        load_ocpds: 70.0,
        ..back_fed(22.0, 100.0, 100.0)
    };
    assert_eq!(busbar_method(panel), Busbar::SumOfDevices);
    let full = BackFed {
        load_ocpds: 80.0,
        ..panel
    };
    assert_eq!(busbar_method(full), Busbar::Over);
    // The main may not exceed the busbar rating: 125 A on a 100 A busbar, 20 + 125 = 145 A.
    let main_over = BackFed {
        load_ocpds: 40.0,
        ..back_fed(16.0, 125.0, 100.0)
    };
    assert_eq!(busbar_method(main_over), Busbar::Over);
}

fn riser(pv: Value, main_at: f64) -> Vec<(String, Vec<String>)> {
    let nodes = vec![
        json!({ "id": "root", "node_type": "root", "highest_unit_form":
            { "distribution_unit": "Service", "phase": "one_phase", "solar_pv": pv } }),
        json!({ "id": "MDP", "node_type": "panel", "parent_id": "root", "circuit_number": 1,
            "conductor_sets": 1, "conductor_qty": 2, "overrided_at": main_at,
            "panel_data": { "name": "MDP", "phase": "one_phase", "ambient_temperature": 30 } }),
        // Two 40 A branch breakers: 80 A of load devices for method (3).
        light("L1", 1.0),
        light("L2", 2.0),
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

fn light(id: &str, circuit: f64) -> Value {
    json!({ "id": id, "node_type": "load", "parent_id": "MDP", "circuit_number": circuit,
        "conductor_sets": 1, "conductor_qty": 2, "overrided_at": 40,
        "load_data": { "load_type": "lighting_load", "quantity": 1, "varies": 1000 } })
}

fn dwelling_array() -> Value {
    json!({ "module_voc": 49.5, "module_isc": 13.9, "modules_per_string": 10, "strings": 2,
        "lowest_ambient": 18, "building": "one_two_family", "inverter_current": 22,
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
            "PV max dc: 514.8 V",
            // 6.90.2.5: 514.8 V is 80 V dc or more.
            "PV dc arc-fault protection required",
            // 17.375 A, 21.71875 A. The other string can feed this one (6.90.2.3(A)), and
            // with no module rating given Exception (2) cannot apply: a device of at least
            // 21.72 A, the 25 A of Table 2.40.1.6(A).
            "PV source circuit: 17.38 A",
            "PV source cond. ≥ 21.72 A",
            "PV source OCPD: 25 A",
            // Output 2 × 17.375 = 34.75 A, × 125 % = 43.4375 A; fed by the array alone, so a
            // conductor carrying it needs no device (6.90.2.3(A)).
            "PV output circuit: 34.75 A",
            "PV output cond. ≥ 43.44 A, no OCPD",
            // 22 A × 125 % = 27.5 A; the next standard rating (Table 2.40.1.6(A)) is 30 A.
            "Inverter output: 22 A",
            "Inverter cond. ≥ 27.5 A, OCPD 30 A",
            // In MDP's 30 °C: (B)(1) 27.5 A, 3.5 mm² 20 A, 5.5 mm² 30 A at 60 °C terminations;
            // (B)(2) 40 A ≥ 22 A; the 30 A breaker ≤ 30 A.
            "Inverter cond.: 5.5 mm² Cu",
        ]
    );
}

/// The back-fed panel's PV lines, from its first.
fn pv_lines(boxes: &[(String, Vec<String>)], id: &str) -> Vec<String> {
    let lines = lines_of(boxes, id);
    let start = lines.iter().position(|l| l.starts_with("PV")).unwrap();
    lines[start..].to_vec()
}

const MARK: &str = "Mark: all power sources";

#[test]
fn the_back_fed_panel_shows_its_busbar_check() {
    // 27.5 + 100 = 127.5 A is over 120 % of the 100 A busbar (120 A), and the breakers but
    // the main, 80 + 30 = 110 A, are over 100 A (method (3)). Every back-fed panel is
    // marked with all its sources (7.5.1.12(B)(3)).
    let boxes = riser(dwelling_array(), 100.0);
    assert_eq!(
        pv_lines(&boxes, "MDP"),
        ["PV on busbar: 127.5 A of 100 A, OVER", MARK]
    );
    // On an 80 A main: 27.5 + 80 = 107.5 A, within 120 % of 100 A only: (2), with its label.
    let boxes = riser(dwelling_array(), 80.0);
    assert_eq!(
        pv_lines(&boxes, "MDP"),
        [
            "PV on busbar: 107.5 A of 100 A",
            "PV CB at end opposite main",
            "Label: do not relocate PV CB",
            MARK
        ]
    );
    let mut pv = dwelling_array();
    pv["busbar_rating"] = json!(150);
    assert_eq!(
        pv_lines(&riser(pv, 80.0), "MDP"),
        ["PV on busbar: 107.5 A of 150 A", MARK]
    );
    // Center-fed in a dwelling: (4).
    let mut pv = dwelling_array();
    pv["center_fed"] = json!(true);
    assert_eq!(
        pv_lines(&riser(pv.clone(), 80.0), "MDP"),
        [
            "PV on busbar: 107.5 A of 100 A",
            "PV CB at one end, not both",
            MARK
        ]
    );
    // Center-fed elsewhere, on a 125 A busbar: 127.5 A > 125 A, and (2) needs ends, so (3):
    // 110 A ≤ 125 A with the 100 A main within it, with its label.
    pv["building"] = json!("other");
    pv["busbar_rating"] = json!(125);
    assert_eq!(
        pv_lines(&riser(pv.clone(), 100.0), "MDP"),
        [
            "PV on busbar: 127.5 A of 125 A",
            "CBs but main: 110 A of 125 A",
            "Label: multiple sources, CB total",
            MARK
        ]
    );
    // (5): an engineered multiple-ampacity busbar, where no other method is met.
    pv["busbar_rating"] = json!(100);
    pv["engineered_busbar"] = json!(true);
    assert_eq!(
        pv_lines(&riser(pv, 100.0), "MDP"),
        [
            "PV on busbar: 127.5 A of 100 A",
            "Busbar by engineering design",
            MARK
        ]
    );
}

#[test]
fn method_2_needs_the_busbar_sized_for_its_load() {
    // 127.5 A ≤ 150 A (120 % of 125 A), but a 130 A Article 2.20 load is over the 125 A
    // busbar, so (2) fails; (3) still holds, 0 + 30 A ≤ 125 A.
    let panel = BackFed {
        load_current: 130.0,
        ..back_fed(22.0, 100.0, 125.0)
    };
    assert_eq!(busbar_method(panel), Busbar::SumOfDevices);
    let at_rating = BackFed {
        load_current: 125.0,
        ..panel
    };
    assert_eq!(busbar_method(at_rating), Busbar::OppositeEnd);
    // (5) only where nothing else is met.
    let engineered = BackFed {
        engineered: true,
        load_ocpds: 200.0,
        ..panel
    };
    assert_eq!(busbar_method(engineered), Busbar::Engineered);
    assert_eq!(
        busbar_method(BackFed {
            engineered: true,
            ..back_fed(22.0, 100.0, 150.0)
        }),
        Busbar::Anywhere
    );
}

#[test]
fn twelve_modules_are_over_600_v_on_a_dwelling_only() {
    // 12 × 49.5 V × 1.04 = 617.76 V.
    let mut pv = dwelling_array();
    pv["modules_per_string"] = json!(12);
    let service = lines_of(&riser(pv.clone(), 100.0), "root");
    assert!(service.contains(&"PV max dc: 617.76 V, OVER 600 V".to_string()));
    pv["building"] = json!("other");
    let service = lines_of(&riser(pv, 100.0), "root");
    assert!(service.contains(&"PV max dc: 617.76 V".to_string()));
}

#[test]
fn a_partial_system_shows_only_what_its_inputs_give() {
    let boxes = riser(json!({ "panel": "MDP" }), 100.0);
    assert!(!lines_of(&boxes, "root").iter().any(|l| l.contains("PV")));
    // A back-fed panel is marked with all its sources (7.5.1.12(B)(3)) before its inputs
    // are complete.
    assert_eq!(pv_lines(&boxes, "MDP"), ["PV back-fed", MARK]);
    let boxes = riser(json!({ "panel": "MDP", "inverter_current": 22 }), 100.0);
    assert_eq!(
        pv_lines(&boxes, "MDP"),
        ["PV back-fed, busbar rating not set", MARK]
    );
    // A feeder connection is marked the same way before its inputs are complete.
    let boxes = riser(json!({ "panel": "MDP", "on_feeder": true }), 100.0);
    assert_eq!(pv_lines(&boxes, "MDP"), ["PV on feeder", MARK]);
    let pv = heda_core::model::SolarPv {
        inverter_current: Some(22.0),
        ..Default::default()
    };
    assert_eq!(
        heda_core::solar::feeder_lines(&pv, 100.0, None),
        ["PV on feeder, ampacity unknown", MARK]
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

#[test]
fn a_supply_side_connection_stays_within_the_service_rating() {
    // 7.5.1.12(A): the 30 A inverter breaker (22 A × 125 % = 27.5 A) within the 100 A
    // service disconnect, the one main on the supply (2.30.6.11).
    let pv = json!({ "inverter_current": 22, "supply_side": true });
    let service = lines_of(&riser(pv, 100.0), "root");
    assert_eq!(service.last().unwrap(), "PV CB 30 A ≤ 100 A service");
    // 80 A × 125 % = 100 A, a 100 A breaker: not over a 100 A service ("shall not exceed");
    // 82 A × 125 % = 102.5 A takes 110 A, over it.
    let pv = json!({ "inverter_current": 80, "supply_side": true });
    assert_eq!(
        lines_of(&riser(pv, 100.0), "root").last().unwrap(),
        "PV CB 100 A ≤ 100 A service"
    );
    let pv = json!({ "inverter_current": 82, "supply_side": true });
    assert_eq!(
        lines_of(&riser(pv, 100.0), "root").last().unwrap(),
        "PV CB 110 A > 100 A service, OVER"
    );
}

#[test]
fn a_supply_side_connection_needs_a_service() {
    let nodes = vec![
        json!({ "id": "root", "node_type": "root", "highest_unit_form": {
        "phase": "one_phase", "is_service": false,
        "solar_pv": { "inverter_current": 22, "supply_side": true } } }),
    ];
    let mut session = Session::default();
    session.open(json!({}), nodes).unwrap();
    let lines = session.riser("root").unwrap().boxes[0].lines.clone();
    assert_eq!(
        lines.last().unwrap(),
        "PV supply side: supply is not a service"
    );
}

fn feeder_lines(inverter_current: f64, main_at: f64) -> Vec<String> {
    // MDP fed by 22 mm² THHN: up to 100 A the terminations take the 60 °C column, 70 A
    // (Table 3.10.2.6(B)(16), 1.10.1.14(C)); at 90 °C, 30 °C ambient, it carries 95 A.
    let nodes = vec![
        json!({ "id": "root", "node_type": "root", "highest_unit_form": {
            "phase": "one_phase", "solar_pv": { "inverter_current": inverter_current,
                "panel": "MDP", "on_feeder": true } } }),
        json!({ "id": "MDP", "node_type": "panel", "parent_id": "root", "circuit_number": 1,
            "conductor_sets": 1, "conductor_qty": 2, "overrided_at": main_at,
            "overrided_conductor_size": 22,
            "panel_data": { "name": "MDP", "phase": "one_phase", "ambient_temperature": 30 } }),
    ];
    let mut session = Session::default();
    session.open(json!({}), nodes).unwrap();
    let layout = session.riser("root").unwrap();
    let mdp = layout.boxes.iter().find(|b| b.id == "MDP").unwrap();
    let start = mdp.lines.iter().position(|l| l.starts_with("PV")).unwrap();
    mdp.lines[start..].to_vec()
}

#[test]
fn a_feeder_connection_needs_the_ampacity_or_a_load_side_breaker() {
    // 7.5.1.12(B)(2)(a)(1): 50 A feeder breaker + 16 A × 125 % = 70 A, not over 70 A.
    // (b): taps sized on the same 70 A, 3 m ≥ 70 / 10 = 7 A, 7.5 m ≥ 70 / 3 = 23.34 A
    // (2.40.2.1(B)(1)(4), (B)(2)(1)).
    assert_eq!(
        feeder_lines(16.0, 50.0),
        [
            "PV on feeder: 70 A of 70 A",
            "Taps: 3 m ≥ 7 A, 7.5 m ≥ 23.34 A",
            MARK
        ]
    );
    // 50 + 17 × 125 % = 71.25 A > 70 A: (2), a load-side breaker no larger than 70 A.
    assert_eq!(
        feeder_lines(17.0, 50.0),
        [
            "PV on feeder: 71.25 A of 70 A",
            "Needs load-side CB ≤ 70 A",
            // 71.25 / 10 = 7.125 A, 71.25 / 3 = 23.75 A.
            "Taps: 3 m ≥ 7.13 A, 7.5 m ≥ 23.75 A",
            MARK
        ]
    );
}

#[test]
fn dc_conductors_meet_6_90_2_2_b_in_the_corrected_ambient() {
    // 2 strings of Isc 13.9 A, dc wiring at 34 °C (Table 3.10.2.6(B)(2)(a), 31–35 °C, 90 °C:
    // 0.96). Source circuit: 17.375 A, 125 % = 21.72 A, 25 A device; 4 current-carrying
    // conductors in one raceway, 80 % (Table 3.10.2.6(B)(3)(a)). (B)(1) at the 60 °C
    // terminations (≤ 100 A, 1.10.1.14(C)): 3.5 mm² 20 A < 21.72 A, 5.5 mm² 30 A. (B)(2):
    // 40 × 0.96 × 0.8 = 30.72 A ≥ 17.375 A. 2.40.1.4: 25 A ≤ 30 A.
    // Output circuit, no device: (B)(1) 43.44 A: 8.0 mm² 40 A, 14 mm² 55 A; (B)(2) 75 × 0.96
    // = 72 A ≥ 34.75 A.
    let mut pv = dwelling_array();
    pv["dc_ambient"] = json!(34);
    let service = lines_of(&riser(pv.clone(), 100.0), "root");
    assert!(service.contains(&"PV source cond.: 5.5 mm² Cu".to_string()));
    assert!(service.contains(&"PV output cond.: 14 mm² Cu".to_string()));
    // Less than 23 mm above the roof: 34 + 33 = 67 °C (66–70 °C, 90 °C: 0.58).
    // Source: 5.5 mm² 40 × 0.58 × 0.8 = 18.56 A carries 17.375 A, but the 25 A device is above
    // the next standard rating over 18.56 A, 20 A (2.40.1.4(B)); 8.0 mm²: 55 × 0.58 × 0.8 =
    // 25.52 A ≥ 25 A. Output: 14 mm² 75 × 0.58 = 43.5 A ≥ 34.75 A, terminations 55 A ≥ 43.44 A.
    pv["near_roof"] = json!(true);
    let service = lines_of(&riser(pv, 100.0), "root");
    assert!(service.contains(&"PV source cond.: 8 mm² Cu".to_string()));
    assert!(service.contains(&"PV output cond.: 14 mm² Cu".to_string()));
}

#[test]
fn a_string_needs_a_device_only_where_other_sources_can_feed_it() {
    // 6.90.2.3(A) Exception (1): one string and no backfeed.
    assert_eq!(
        source_protection(13.9, 1.0, 0.0, None),
        SourceProtection::NotRequired { available: 17.375 }
    );
    // Exception (2): the other string's 17.375 A within the module's listed 25 A.
    assert_eq!(
        source_protection(13.9, 2.0, 0.0, Some(25.0)),
        SourceProtection::NotRequired { available: 17.375 }
    );
    // Three strings: 2 × 17.375 = 34.75 A > 25 A, a 25 A device (≥ 21.72 A, ≤ the module's 25 A).
    assert_eq!(
        source_protection(13.9, 3.0, 0.0, Some(25.0)),
        SourceProtection::Device {
            rating: 25.0,
            fuse: false
        }
    );
    // A module listed for 20 A cannot take the 25 A device the 21.72 A needs.
    assert_eq!(
        source_protection(13.9, 3.0, 0.0, Some(20.0)),
        SourceProtection::Over { needed: Some(25.0) }
    );
    // Inverter backfeed is an external source even on one string: 5 A within 25 A, and the
    // conductor carries the larger of the two.
    assert_eq!(
        source_protection(13.9, 1.0, 5.0, Some(25.0)),
        SourceProtection::NotRequired { available: 17.375 }
    );
    assert_eq!(
        source_protection(13.9, 1.0, 30.0, Some(30.0)),
        SourceProtection::NotRequired { available: 30.0 }
    );
    // Isc 5 A: 6.25 A × 125 % = 7.81 A; 2.40.1.6(A)'s fuse-only 10 A is below the 15 A breaker.
    assert_eq!(
        source_protection(5.0, 2.0, 0.0, None),
        SourceProtection::Device {
            rating: 10.0,
            fuse: true
        }
    );
}

#[test]
fn a_device_protects_up_to_the_next_standard_rating_2_40_1_4_b() {
    // 23.5 A is not a standard rating; the next above it is 25 A.
    assert!(protects(25.0, 23.5));
    assert!(!protects(30.0, 23.5));
    // 20 A is a standard rating, so (B)(2) does not apply.
    assert!(!protects(25.0, 20.0));
    assert!(protects(20.0, 20.0));
    // 750 A: the next is 800 A; over 800 A (B)(3) gives no next size up.
    assert!(protects(800.0, 750.0));
    assert!(!protects(1000.0, 950.0));
    // 7 A: the next is the 10 A fuse rating, so a 15 A device may not protect it.
    assert!(protects(10.0, 7.0));
    assert!(!protects(15.0, 7.0));
}

#[test]
fn the_riser_shows_an_unprotected_string_and_its_fuse() {
    // One string: no device.
    let service = lines_of(&riser(json!({ "module_isc": 13.9 }), 100.0), "root");
    assert!(service.contains(&"PV source cond. ≥ 21.72 A, no OCPD".to_string()));
    // Isc 5 A, two strings: the 10 A fuse.
    let service = lines_of(
        &riser(json!({ "module_isc": 5, "strings": 2 }), 100.0),
        "root",
    );
    assert!(service.contains(&"PV source fuse: 10 A".to_string()));
    // Over the module's listed rating.
    let service = lines_of(
        &riser(
            json!({ "module_isc": 13.9, "strings": 3, "module_max_ocpd": 20 }),
            100.0,
        ),
        "root",
    );
    assert!(service.contains(&"Module max fuse < 25 A, OVER".to_string()));
}

#[test]
fn strings_in_separate_raceways_adjust_less() {
    // 10 strings of Isc 13.9 A at 30 °C (factor 1), 25 A devices, in one raceway: 20
    // conductors, 50 %. 5.5 mm²: 40 × 0.5 = 20 A carries 17.375 A, but 20 A is a standard
    // rating, so the 25 A device may not protect it (2.40.1.4(B)(2)); 8.0 mm²: 27.5 A.
    let pv = json!({ "module_isc": 13.9, "strings": 10, "dc_ambient": 30 });
    let ten = lines_of(&riser(pv, 100.0), "root");
    assert!(ten.contains(&"PV source cond.: 8 mm² Cu".to_string()));
    // Two per raceway: 4 conductors, 80 %, 5.5 mm² 32 A, terminations 30 A ≥ 21.72 A.
    let pv =
        json!({ "module_isc": 13.9, "strings": 10, "dc_ambient": 30, "strings_per_raceway": 2 });
    let two = lines_of(&riser(pv, 100.0), "root");
    assert!(two.contains(&"PV source cond.: 5.5 mm² Cu".to_string()));
}

#[test]
fn the_inverter_conductor_is_sized_at_its_panel() {
    // 22 A → 30 A breaker; MDP at 30 °C (factor 1), one-phase, 2 conductors. (B)(1): 3.5 mm²
    // 20 A < 27.5 A at 60 °C terminations, 5.5 mm² 30 A; (B)(2): 40 A ≥ 22 A; 30 A ≤ 30 A.
    let service = lines_of(&riser(dwelling_array(), 100.0), "root");
    assert!(service.contains(&"Inverter cond.: 5.5 mm² Cu".to_string()));
    let inverter = |ambient| PvConductor {
        max_current: 22.0,
        available: 22.0,
        ocpd: Some(30.0),
        conductors: 2.0,
        ambient,
    };
    assert_eq!(conductor_size(inverter(30.0)), Some(5.5));
    // Past the 90 °C column (above 85 °C) no size fits.
    assert_eq!(conductor_size(inverter(90.0)), None);
}

#[test]
fn an_inverter_past_the_standard_ratings_is_over() {
    // 5000 A × 125 % = 6250 A, past Table 2.40.1.6(A)'s 6000 A.
    assert_eq!(inverter_ocpd(5000.0), 0.0);
    let pv = json!({ "inverter_current": 5000, "supply_side": true });
    let service = lines_of(&riser(pv, 100.0), "root");
    assert!(service.contains(&"Inverter cond. ≥ 6250 A, OCPD OVER".to_string()));
    assert_eq!(
        service.last().unwrap(),
        "PV CB past Table 2.40.1.6(A), OVER"
    );
    let panel = BackFed {
        load_ocpds: 0.0,
        ..back_fed(5000.0, 100.0, 100.0)
    };
    assert_eq!(busbar_method(panel), Busbar::Over);
}

#[test]
fn every_building_takes_its_6_90_2_1_limit() {
    // 12 × 49.5 V × 1.04 = 617.76 V; 30 modules = 1544.4 V.
    let line = |building: Value, modules: f64| {
        let mut pv = dwelling_array();
        pv["building"] = building;
        pv["modules_per_string"] = json!(modules);
        let service = lines_of(&riser(pv, 100.0), "root");
        service
            .into_iter()
            .find(|l| l.starts_with("PV max dc"))
            .unwrap()
    };
    assert_eq!(line(json!("multifamily"), 12.0), "PV max dc: 617.76 V");
    assert_eq!(line(json!("none"), 12.0), "PV max dc: 617.76 V");
    assert_eq!(
        line(json!("none"), 30.0),
        "PV max dc: 1544.4 V, OVER 1500 V"
    );
    assert_eq!(line(json!(null), 12.0), "PV max dc: 617.76 V");
    let mut pv = dwelling_array();
    pv["building"] = json!(null);
    let service = lines_of(&riser(pv, 100.0), "root");
    assert!(service.contains(&"PV dc limit: building not set".to_string()));
}

#[test]
fn method_4_takes_multifamily_dwellings_too() {
    let mut pv = dwelling_array();
    pv["center_fed"] = json!(true);
    pv["building"] = json!("multifamily");
    assert_eq!(
        pv_lines(&riser(pv, 80.0), "MDP")[1],
        "PV CB at one end, not both"
    );
    assert!(is_dwelling(Some("one_two_family")));
    assert!(!is_dwelling(Some("other")));
    assert!(!is_dwelling(None));
}

#[test]
fn the_inverter_conductor_takes_its_own_ambient_and_the_next_size_up() {
    // 22 A, 30 A breaker. At 60 °C (56–60 °C, 90 °C: 0.71): 5.5 mm² 40 × 0.71 = 28.4 A; the
    // next standard rating above 28.4 A is 30 A, so the 30 A breaker protects it (2.40.1.4(B)).
    let mut pv = dwelling_array();
    pv["inverter_ambient"] = json!(60);
    let service = lines_of(&riser(pv.clone(), 100.0), "root");
    assert!(service.contains(&"Inverter cond.: 5.5 mm² Cu".to_string()));
    // At 70 °C (66–70 °C: 0.58): 5.5 mm² 23.2 A, whose next standard rating is 25 A < 30 A;
    // 8.0 mm² 55 × 0.58 = 31.9 A, terminations 40 A.
    pv["inverter_ambient"] = json!(70);
    let service = lines_of(&riser(pv, 100.0), "root");
    assert!(service.contains(&"Inverter cond.: 8 mm² Cu".to_string()));
}

#[test]
fn the_supply_side_takes_precedence_and_needs_the_inverter_ambient() {
    // A panel left chosen is not back-fed once the inverter is on the supply side.
    let mut pv = dwelling_array();
    pv["supply_side"] = json!(true);
    let boxes = riser(pv.clone(), 100.0);
    assert!(!lines_of(&boxes, "MDP").iter().any(|l| l.contains("PV")));
    // Without a panel, the conductor needs its own ambient.
    assert!(!lines_of(&boxes, "root")
        .iter()
        .any(|l| l.starts_with("Inverter cond.:")));
    pv["inverter_ambient"] = json!(30);
    let service = lines_of(&riser(pv, 100.0), "root");
    assert!(service.contains(&"Inverter cond.: 5.5 mm² Cu".to_string()));
}

#[test]
fn feeder_taps_take_a_tenth_and_a_third() {
    assert_eq!(tap_ampacities(300.0), (30.0, 100.0));
}
