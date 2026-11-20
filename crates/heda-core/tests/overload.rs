//! A motor's overload relay by PEC 2017 4.30.3.2(A)(1), from its nameplate full-load
//! current, worked against App. D Ex. D9 9.3 (p. 1052).

use heda_core::model::load_types::*;
use heda_core::session::Session;
use heda_core::sizing::overload_rating;
use serde_json::{json, Value};

fn tree(load_type: &str, load_data: Value) -> Vec<Value> {
    let mut data = json!({ "load_type": load_type, "quantity": 1, "varies": 34 });
    data.as_object_mut()
        .unwrap()
        .extend(load_data.as_object().unwrap().clone());
    vec![
        json!({ "id": "root", "node_type": "root",
            "highest_unit_form": { "phase": "three_phase_wye", "is_service": false } }),
        json!({ "id": "M", "node_type": "load", "parent_id": "root", "circuit_number": 1,
            "conductor_sets": 1, "conductor_qty": 3, "load_data": data }),
    ]
}

fn overload(load_type: &str, load_data: Value) -> Option<f64> {
    let mut session = Session::default();
    let all = session.open(json!({}), tree(load_type, load_data)).unwrap();
    all.rows["M"].overload
}

#[test]
fn d9_service_factor_1_15_takes_125_percent_rounded_down() {
    // D9: 25 hp, 460 V, nameplate 31.6 A, service factor 1.15: 31.6 × 1.25 = 39 A (maximum).
    assert_eq!(overload_rating(31.6, true), 39.0);
    let d9 = json!({ "nameplate_current": 31.6, "nameplate_marked": true });
    assert_eq!(overload(THREE_P_MOTOR_HORSE_POWER, d9), Some(39.0));
}

#[test]
fn an_unmarked_motor_takes_115_percent() {
    // "All other motors": 115 %. 20 A × 1.15 is exactly 23 A, not 22.
    assert_eq!(overload_rating(31.6, false), 36.0);
    assert_eq!(overload_rating(20.0, false), 23.0);
    let unmarked = json!({ "nameplate_current": 20 });
    assert_eq!(overload(THREE_P_MOTOR_RATED_CURRENT, unmarked), Some(23.0));
}

#[test]
fn needs_a_motor_and_its_nameplate_current() {
    assert_eq!(overload(THREE_P_MOTOR_HORSE_POWER, json!({})), None);
    let lights = json!({ "nameplate_current": 10, "nameplate_marked": true });
    assert_eq!(overload(THREE_P_EQUIPMENT, lights), None);
}
