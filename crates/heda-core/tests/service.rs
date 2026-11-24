//! PEC 2017 2.30.6.10 and 2.30.6.11: the minimum rating of the service disconnecting
//! means, checked against the rendered page (Article 2.30, p. 79).

use heda_core::session::Session;
use serde_json::{json, Value};

fn root(is_service: Option<bool>) -> Value {
    let mut form = json!({ "distribution_unit": "Utility Meter", "phase": "one_phase" });
    if let Some(is_service) = is_service {
        form["is_service"] = json!(is_service);
    }
    json!({ "id": "root", "node_type": "root", "highest_unit_form": form })
}

fn panel(id: &str, circuit: f64) -> Value {
    json!({
        "id": id, "node_type": "panel", "parent_id": "root", "circuit_number": circuit,
        "conductor_sets": 1, "conductor_qty": 2,
        "panel_data": { "name": id, "phase": "one_phase", "ambient_temperature": 30 }
    })
}

fn load(id: &str, parent: &str, circuit: f64, qty: f64) -> Value {
    json!({
        "id": id, "node_type": "load", "parent_id": parent, "circuit_number": circuit,
        "conductor_sets": 1, "conductor_qty": qty,
        "load_data": { "load_type": "lighting_load", "quantity": 1, "varies": 400 }
    })
}

fn main_at(nodes: Vec<Value>, id: &str) -> f64 {
    let mut session = Session::default();
    session.open(json!({}), nodes).unwrap().rows[id].at
}

#[test]
fn more_than_two_circuits_need_a_60_a_service_disconnect() {
    // (D)/(E): 3 × 400 VA lighting is 5.2 A, but the service main is at least 60 A.
    let nodes = vec![
        root(None),
        panel("SP", 1.0),
        load("a", "SP", 1.0, 2.0),
        load("b", "SP", 2.0, 2.0),
        load("c", "SP", 3.0, 2.0),
    ];
    assert_eq!(main_at(nodes, "SP"), 60.0);
}

#[test]
fn two_2_wire_circuits_need_30_a() {
    // (C): not more than two 2-wire branch circuits.
    let nodes = vec![
        root(None),
        panel("SP", 1.0),
        load("a", "SP", 1.0, 2.0),
        load("b", "SP", 2.0, 2.0),
    ];
    assert_eq!(main_at(nodes, "SP"), 30.0);
    // A 3-wire circuit is not a 2-wire one, so (E) applies.
    let nodes = vec![root(None), panel("SP", 1.0), load("a", "SP", 1.0, 3.0)];
    assert_eq!(main_at(nodes, "SP"), 60.0);
}

#[test]
fn a_supply_that_is_not_the_service_keeps_the_feeder_rating() {
    let nodes = vec![
        root(Some(false)),
        panel("SP", 1.0),
        load("a", "SP", 1.0, 2.0),
        load("b", "SP", 2.0, 2.0),
        load("c", "SP", 3.0, 2.0),
    ];
    // 3 × 400 VA continuous lighting is 6.52 A at 125 % (2.15.1.3): the smallest rating.
    assert_eq!(main_at(nodes, "SP"), 15.0);
}

#[test]
fn the_disconnects_on_the_service_count_together() {
    // 2.30.6.11: three 2-wire circuits need 60 A combined ((D)/(E)); P2's own 15 A main
    // leaves 45 A for P1, the first panel.
    let nodes = vec![
        root(None),
        panel("P1", 1.0),
        panel("P2", 2.0),
        load("a", "P1", 1.0, 2.0),
        load("b", "P1", 2.0, 2.0),
        load("c", "P2", 1.0, 2.0),
    ];
    assert_eq!(main_at(nodes.clone(), "P1"), 45.0);
    assert_eq!(main_at(nodes, "P2"), 15.0);
    // A 15 A lighting circuit on the service leaves 45 A for the panel, itself a
    // standard rating (Table 2.40.1.6(A)).
    let nodes = vec![
        root(None),
        panel("P1", 1.0),
        load("d", "root", 2.0, 2.0),
        load("a", "P1", 1.0, 2.0),
        load("b", "P1", 2.0, 2.0),
    ];
    assert_eq!(main_at(nodes, "P1"), 45.0);
}

#[test]
fn a_write_to_a_sibling_on_the_service_updates_the_service_main() {
    let mut session = Session::default();
    let all = session
        .open(
            json!({}),
            vec![
                root(None),
                panel("P1", 1.0),
                load("L", "root", 2.0, 2.0),
                load("a", "P1", 1.0, 2.0),
            ],
        )
        .unwrap();
    // Two 2-wire circuits: (C), 30 A, met by L's 15 A and P1's own 15 A.
    assert_eq!(all.rows["P1"].at, 15.0);
    // L becomes 3-wire, so (E) asks 60 A; L's 15 A leaves 45 A for P1. Only L was written.
    let changed = session.put(vec![load("L", "root", 2.0, 3.0)]).unwrap();
    assert_eq!(changed.rows["P1"].at, 45.0);
}

#[test]
fn a_third_circuit_raises_the_service_main() {
    let mut session = Session::default();
    let all = session
        .open(
            json!({}),
            vec![
                root(None),
                panel("SP", 1.0),
                load("a", "SP", 1.0, 2.0),
                load("b", "SP", 2.0, 2.0),
            ],
        )
        .unwrap();
    assert_eq!(all.rows["SP"].at, 30.0);
    let changed = session.put(vec![load("c", "SP", 3.0, 2.0)]).unwrap();
    assert_eq!(changed.rows["SP"].at, 60.0);
    // The conductor follows the main: a panel main sizes on its breaker rating.
    assert!(changed.rows["SP"].conductor_size > all.rows["SP"].conductor_size);
    let changed = session.remove(&["c".to_owned()]);
    assert_eq!(changed.rows["SP"].at, 30.0);
}

fn motor(id: &str, parent: &str, circuit: f64, flc: f64) -> Value {
    json!({
        "id": id, "node_type": "load", "parent_id": parent, "circuit_number": circuit,
        "conductor_sets": 1, "conductor_qty": 2,
        "load_data": { "load_type": "one_phase_motor_rated_current", "quantity": 1,
            "varies": flc, "continuous": true }
    })
}

#[test]
fn a_service_main_raised_to_its_minimum_keeps_its_conductor_at_that_rating() {
    // An 8 A motor and two 400 VA lighting circuits: the 4.30.2.4 load is about 13 A, but
    // 2.30.6.10(E) makes the service main 60 A, and 2.30.7.1(A) lets the service breaker be
    // no higher than the conductor's ampacity. At 60 A (≤ 100 A, 1.10.1.14(C)(1)(a)) the
    // 60 °C column of Table 3.10.2.6(B)(16) applies: 14 mm² is 55 A, 22 mm² is 70 A.
    let mut session = Session::default();
    let all = session
        .open(
            json!({}),
            vec![
                root(None),
                panel("SP", 1.0),
                motor("m", "SP", 1.0, 8.0),
                load("a", "SP", 2.0, 2.0),
                load("b", "SP", 3.0, 2.0),
            ],
        )
        .unwrap();
    assert_eq!(all.rows["SP"].at, 60.0);
    assert_eq!(all.rows["SP"].conductor_size, 22.0);
}

#[test]
fn the_service_conductors_carry_the_minimum_rating_whatever_the_motor_breaker() {
    // PEC 2017 2.30.4.3(B): the ungrounded service-entrance conductors have an ampacity
    // not less than the 2.30.6.10(A)–(D) minimum. (C), a motor and one lighting circuit
    // (two 2-wire circuits), is 30 A, even once the motor's own 250 % breaker
    // (Table 4.30.4.2) reaches 30 A by itself.
    for flc in [10.0, 12.0, 16.0] {
        let mut session = Session::default();
        let rows = session
            .open(
                json!({}),
                vec![
                    root(None),
                    panel("SP", 1.0),
                    motor("m", "SP", 1.0, flc),
                    load("a", "SP", 2.0, 2.0),
                ],
            )
            .unwrap()
            .rows;
        let ampacity = rows["SP"].ampacity.unwrap();
        assert!(ampacity >= 30.0, "FLC {flc} A: {ampacity} A");
    }
    // heda holds the (E) 60 A minimum the same way (three circuits).
    for flc in [20.0, 22.0, 24.0, 28.0] {
        let mut session = Session::default();
        let rows = session
            .open(
                json!({}),
                vec![
                    root(None),
                    panel("SP", 1.0),
                    motor("m", "SP", 1.0, flc),
                    load("a", "SP", 2.0, 2.0),
                    load("b", "SP", 3.0, 2.0),
                ],
            )
            .unwrap()
            .rows;
        let ampacity = rows["SP"].ampacity.unwrap();
        assert!(ampacity >= 60.0, "FLC {flc} A: {ampacity} A");
    }
}
