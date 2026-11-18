//! A panel main's feeder by PEC 2017 2.15.1.2(A)(1) and 2.15.1.3 (noncontinuous load plus
//! 125 % of the continuous) and, with motors, 4.30.2.4 for its conductor and 4.30.5.2(A) /
//! 4.30.5.3 for its breaker, worked against App. D Ex. D10 (p. 1053).

use heda_core::session::Session;
use serde_json::{json, Value};

/// A supply that is not a service, so 2.30.6.10's minimum stays out of the way.
fn root(phase: &str) -> Value {
    json!({ "id": "root", "node_type": "root",
        "highest_unit_form": { "phase": phase, "is_service": false } })
}

fn panel(phase: &str) -> Value {
    json!({
        "id": "P", "node_type": "panel", "parent_id": "root", "circuit_number": 1,
        "conductor_sets": 1, "conductor_qty": if phase == "one_phase" { 2 } else { 3 },
        "panel_data": { "name": "P", "phase": phase, "ambient_temperature": 30 }
    })
}

fn load(id: &str, circuit: f64, load_type: &str, varies: f64, continuous: bool) -> Value {
    json!({
        "id": id, "node_type": "load", "parent_id": "P", "circuit_number": circuit,
        "conductor_sets": 1, "conductor_qty": 2,
        "load_data": { "load_type": load_type, "quantity": 1, "varies": varies,
            "continuous": continuous }
    })
}

fn rows(nodes: Vec<Value>) -> (f64, f64) {
    let mut session = Session::default();
    let all = session.open(json!({}), nodes).unwrap();
    (all.rows["P"].at, all.rows["P"].conductor_size)
}

#[test]
fn d10_three_motors_take_125_percent_of_the_largest_and_a_125_a_breaker() {
    // 25, 20 and 10 hp at 34, 27 and 14 A (Table 4.30.14.4). Conductor: 34 + 27 + 14 +
    // 34 × 0.25 = 83.5 A → 22 mm² (85 A at 75 °C, the column of a circuit over 100 A).
    // Breaker: the 25 hp motor's 90 A inverse time breaker (250 % of 34 A, next rating)
    // + 27 + 14 = 131 A, "Use 125 Amperes ITD".
    let motor = |id, circuit, flc| load(id, circuit, "three_phase_motor_rated_current", flc, true);
    let nodes = vec![
        root("three_phase_delta"),
        panel("three_phase_delta"),
        motor("m25", 1.0, 34.0),
        motor("m20", 2.0, 27.0),
        motor("m10", 3.0, 14.0),
    ];
    assert_eq!(rows(nodes), (125.0, 22.0));
}

#[test]
fn the_ceiling_takes_the_largest_branch_breaker_even_on_a_smaller_motor() {
    // D10's motors, with the 10 hp motor's breaker overridden to 100 A, now the largest
    // device (4.30.5.2(A)). Load still 83.5 A (125 % of the 34 A motor, 4.30.2.4(1)).
    // Ceiling: 100 + 34 + 27 = 161 A → 150 A. Taking the 34 A motor's 90 A instead would
    // give 131 A → 125 A.
    let motor = |id, circuit, flc| load(id, circuit, "three_phase_motor_rated_current", flc, true);
    let mut m10 = motor("m10", 3.0, 14.0);
    m10["overrided_at"] = json!(100);
    let nodes = vec![
        root("three_phase_delta"),
        panel("three_phase_delta"),
        motor("m25", 1.0, 34.0),
        motor("m20", 2.0, 27.0),
        m10,
    ];
    assert_eq!(rows(nodes), (150.0, 22.0));
}

#[test]
fn a_feeder_adds_25_percent_to_its_continuous_load_only() {
    // 2.15.1.3: 3680 VA of continuous lighting (16 A × 1.25 = 20 A) and 2300 VA of
    // noncontinuous outlets (10 A) need 30 A, on 5.5 mm² (30 A at 60 °C). At 125 % of all
    // 26 A it would be 32.5 A and a 35 A breaker.
    let nodes = vec![
        root("one_phase"),
        panel("one_phase"),
        load("l", 1.0, "lighting_load", 3680.0, true),
        load("o", 2.0, "convenience_outlet", 2300.0, false),
    ];
    assert_eq!(rows(nodes), (30.0, 5.5));
}

#[test]
fn a_feeder_needs_no_30_a_floor() {
    // 400 VA of continuous lighting is 1.74 A × 1.25: the smallest rating, 15 A, on 2.0 mm².
    let nodes = vec![
        root("one_phase"),
        panel("one_phase"),
        load("l", 1.0, "lighting_load", 400.0, true),
    ];
    assert_eq!(rows(nodes), (15.0, 2.0));
}

#[test]
fn a_motor_and_other_loads_follow_4_30_2_4_and_4_30_5_3() {
    // 3 hp single-phase motor, 17 A (Table 4.30.14.2), on a 45 A breaker (250 % = 42.5 A).
    // Lighting 2300 VA continuous (10 A × 1.25 = 12.5 A), outlets 1840 VA noncontinuous (8 A).
    // Conductor: 12.5 + 8 + 17 × 1.25 = 41.75 A → 14 mm² (8.0 mm² is 40 A at 60 °C).
    // Breaker: 12.5 + 8 + 45 = 65.5 A, at most → 60 A.
    let nodes = vec![
        root("one_phase"),
        panel("one_phase"),
        load("m", 1.0, "one_phase_motor_rated_current", 17.0, true),
        load("l", 2.0, "lighting_load", 2300.0, true),
        load("o", 3.0, "convenience_outlet", 1840.0, false),
    ];
    assert_eq!(rows(nodes), (60.0, 14.0));
}
