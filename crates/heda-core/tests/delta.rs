//! 230 V three-phase 3-wire (delta) systems: PEC 2017 2.20.1.5(A) lists 230 V among
//! the nominal system voltages, and App. D Ex. D14 (fault current) and D15 (voltage
//! drop) are worked on one.

use heda_core::dispatch::dispatch;
use heda_core::model::{load_types, phases};
use heda_core::phases::{delta_line_currents, PairVa};
use heda_core::session::Session;
use serde_json::{json, Value};

fn close(actual: f64, expected: f64, tolerance: f64) {
    assert!(
        (actual - expected).abs() <= tolerance,
        "{actual} ≉ {expected} (± {tolerance})"
    );
}

fn root(extra: Value) -> Value {
    let mut form =
        json!({ "distribution_unit": "Transformer", "phase": phases::THREE_PHASE_DELTA });
    form.as_object_mut()
        .unwrap()
        .extend(extra.as_object().unwrap().clone());
    json!({ "id": "root", "node_type": "root", "highest_unit_form": form })
}

fn node(base: Value, extra: Value) -> Value {
    let mut node =
        json!({ "conductor_sets": 1, "conductor_qty": 3, "conduit_type": "PVC", "kaic": "5" });
    let fields = node.as_object_mut().unwrap();
    fields.extend(base.as_object().unwrap().clone());
    fields.extend(extra.as_object().unwrap().clone());
    node
}

fn panel(id: &str, parent: &str, circuit: f64, phase: &str, extra: Value) -> Value {
    node(
        json!({
            "id": id, "node_type": "panel", "parent_id": parent, "circuit_number": circuit,
            "panel_data": { "name": id, "phase": phase, "ambient_temperature": 30 }
        }),
        extra,
    )
}

fn load(id: &str, parent: &str, circuit: f64, load_type: &str, varies: f64, extra: Value) -> Value {
    node(
        json!({
            "id": id, "node_type": "load", "parent_id": parent, "circuit_number": circuit,
            "load_data": { "load_type": load_type, "quantity": 1, "varies": varies, "load_description": id }
        }),
        extra,
    )
}

fn lighting(id: &str, circuit: f64, va: f64) -> Value {
    load(id, "P", circuit, load_types::LIGHTING_LOAD, va, json!({}))
}

fn open(nodes: Vec<Value>) -> (Session, heda_core::session::Computed) {
    let mut session = Session::default();
    let computed = session.open(json!({}), nodes).expect("open");
    (session, computed)
}

fn delta_panel() -> Value {
    panel("P", "root", 1.0, phases::THREE_PHASE_DELTA, json!({}))
}

#[test]
fn single_phase_loads_take_line_pairs_by_circuit_number() {
    // heda's rotation (PEC leaves it to the designer): 1–2 → AB, 3–4 → BC, 5–6 → CA.
    let (_, computed) = open(vec![
        root(json!({})),
        delta_panel(),
        lighting("a", 1.0, 100.0),
        lighting("b", 3.0, 100.0),
        lighting("c", 5.0, 100.0),
        load(
            "d",
            "P",
            7.0,
            load_types::LIGHTING_LOAD,
            100.0,
            json!({ "phase_assignment": "CA" }),
        ),
        // A wye phase stored on a delta circuit (a moved node) falls back to its pair.
        load(
            "e",
            "P",
            9.0,
            load_types::LIGHTING_LOAD,
            100.0,
            json!({ "phase_assignment": "A" }),
        ),
    ]);
    let phase = |id: &str| computed.rows[id].phase.clone();
    assert_eq!(
        [phase("a"), phase("b"), phase("c"), phase("d"), phase("e")],
        ["AB", "BC", "CA", "CA", "BC"]
    );
    assert_eq!(computed.rows["a"].voltage, 230.0);
}

#[test]
fn three_phase_loads_run_at_230_v_line_to_line() {
    let (_, computed) = open(vec![
        root(json!({})),
        delta_panel(),
        load(
            "m",
            "P",
            1.0,
            load_types::THREE_P_MOTOR_RATED_CURRENT,
            20.0,
            json!({}),
        ),
        load(
            "e",
            "P",
            3.0,
            load_types::THREE_P_EQUIPMENT,
            6_000.0,
            json!({}),
        ),
    ]);
    // D15's 20 A motor: VA = 1.732 × 230 V × 20 A = 7 967.2 VA, and back to 20 A.
    let motor = &computed.rows["m"];
    close(motor.va, 7_967.2, 1e-9);
    assert_eq!(
        (motor.current, motor.voltage, motor.phase.as_str()),
        (20.0, 230.0, "ABC")
    );
    // 6 000 VA ÷ (230 V × 1.732) = 15.06 A.
    assert_eq!(computed.rows["e"].current, 15.06);
    assert_eq!(computed.rows["P"].voltage, 230.0);
}

#[test]
fn a_balanced_delta_panel_carries_the_three_phase_current() {
    let (_, computed) = open(vec![
        root(json!({})),
        delta_panel(),
        lighting("ab", 1.0, 23_000.0),
        lighting("bc", 3.0, 23_000.0),
        lighting("ca", 5.0, 23_000.0),
    ]);
    let row = &computed.rows["P"];
    let pairs = row.pair_va.unwrap();
    assert_eq!(
        (pairs.AB, pairs.BC, pairs.CA),
        (23_000.0, 23_000.0, 23_000.0)
    );
    // Each pair carries 23 000 / 230 = 100 A, each line √3 × 100 = 173.21 A, which is
    // the three-phase formula: 69 000 VA ÷ (230 V × 1.732) = 173.21 A.
    let lines = row.line_current.unwrap();
    assert_eq!((lines.A, lines.B, lines.C), (173.21, 173.21, 173.21));
    assert_eq!(row.balanced_current, Some(173.21));
    assert_eq!(row.current, 173.21);
}

#[test]
fn an_unbalanced_delta_panel_sizes_on_its_most_loaded_line() {
    let (_, computed) = open(vec![
        root(json!({})),
        delta_panel(),
        lighting("ab", 1.0, 23_000.0),
        lighting("bc", 3.0, 20_700.0),
        lighting("ca", 5.0, 14_400.0),
    ]);
    let row = &computed.rows["P"];
    // Pair currents I_AB = 100 A, I_BC = 90 A, I_CA = 62.609 A, 120° apart:
    // I_A = √(100² + 62.609² + 100 × 62.609) = 142.06 A
    // I_B = √(90² + 100² + 90 × 100) = √27 100 = 164.62 A
    // I_C = √(62.609² + 90² + 62.609 × 90) = 132.87 A
    let lines = row.line_current.unwrap();
    assert_eq!((lines.A, lines.B, lines.C), (142.06, 164.62, 132.87));
    // Balanced: 58 100 VA ÷ (230 V × 1.732) = 145.85 A, below line B.
    assert_eq!(row.balanced_current, Some(145.85));
    assert_eq!(row.current, 164.62);
    // 1.25 × 164.62 A = 205.8 A → 225 A breaker (PEC 2017 Table 2.40.1.6(A)).
    assert_eq!(row.at, 225.0);
}

#[test]
fn d15_voltage_drop_on_a_230_v_three_phase_system() {
    // PEC 2017 App. D Ex. D15: a 20 A motor 30.5 m from a panelboard drawing 295 A,
    // 15.2 m from the 230 V transformer, steel conduit. Z = √(R² + X²) per 305 m from
    // Table 10.1.1.9: 250 mm² √(0.029² + 0.048²), 5.5 mm² √(1.2² + 0.063²).
    let feeder_z = (0.029_f64.powi(2) + 0.048_f64.powi(2)).sqrt();
    let branch_z = (1.2_f64.powi(2) + 0.063_f64.powi(2)).sqrt();
    let motor_va = 1.732 * 230.0 * 20.0;
    // The rest of the panel's 295 A, as one balanced three-phase load.
    let other_va = 295.0 * 230.0 * 1.732 - motor_va;
    let mut session = Session::default();
    session
        .open(
            json!({}),
            vec![
                root(json!({})),
                panel(
                    "P",
                    "root",
                    1.0,
                    phases::THREE_PHASE_DELTA,
                    json!({ "length": 15.2, "overrided_z": feeder_z }),
                ),
                load(
                    "M",
                    "P",
                    1.0,
                    load_types::THREE_P_MOTOR_RATED_CURRENT,
                    20.0,
                    json!({ "length": 30.5, "overrided_z": branch_z }),
                ),
                load(
                    "X",
                    "P",
                    3.0,
                    load_types::THREE_P_EQUIPMENT,
                    other_va,
                    json!({ "length": 10 }),
                ),
            ],
        )
        .unwrap();
    let drops = session.voltage_drops();
    let row = |id: &str| drops.iter().find(|d| d.id == id).unwrap();
    // (a) VD = 1.732 × 295 × Z × 15.2 / 305 = 1.428 V (the example rounds Z to 0.0561).
    close(row("P").voltage_per_segment, 1.428, 0.001);
    // (b) VD = 1.732 × 20 × Z × 30.5 / 305 = 4.163 V.
    close(row("M").voltage_per_segment, 4.163, 0.001);
    // (1.428 + 4.163) / 230 × 100 % = 2.43 % at the motor terminals.
    close(row("M").percent_voltage_drop, 2.43, 0.005);
    close(row("M").voltage_at_receiving_end, 230.0 - 5.59, 0.01);
}

#[test]
fn d14_fault_at_the_230_v_transformer_bus_is_14_972_a() {
    // PEC 2017 App. D Ex. D14: 300 kVA bank at 5 % on a 1 000 MVA line, 230 V 3-phase.
    // pu Z = 300 / 1 000 000 + 0.05 = 0.0503; I = (1 / 0.0503) × 300 000 / (1.732 × 230).
    let mut session = Session::default();
    let source =
        json!({ "utility_sc_kva": 1_000_000, "transformer_kva": 300, "transformer_z_percent": 5 });
    session
        .open(json!({}), vec![root(source), delta_panel()])
        .unwrap();
    let rows = session.short_circuits();
    assert_eq!(rows[0].supply_fault_current.unwrap().round(), 14_972.0);
}

#[test]
fn turning_a_panel_into_delta_recomputes_its_circuits() {
    let one_phase = panel("P", "root", 1.0, phases::ONE_PHASE, json!({}));
    let (mut session, computed) = open(vec![root(json!({})), one_phase, lighting("a", 1.0, 100.0)]);
    assert_eq!(computed.rows["a"].phase, "A");
    let changed = session.put(vec![delta_panel()]).unwrap();
    assert_eq!(changed.rows["a"].phase, "AB");
}

#[test]
fn balancing_a_delta_panel_assigns_line_pairs() {
    let mut session = Session::default();
    let answer = dispatch(
        &mut session,
        "balanced_phases",
        json!({
            "supply": phases::THREE_PHASE_DELTA,
            "circuits": [
                { "id": "big", "va": 3_000, "phase": "AB" },
                { "id": "mid", "va": 2_000, "phase": "AB" },
                { "id": "small", "va": 1_000, "phase": "AB" }
            ]
        }),
    )
    .unwrap();
    assert_eq!(
        answer,
        json!([["big", "AB"], ["mid", "BC"], ["small", "CA"]])
    );
}

#[test]
fn line_currents_equal_the_phasor_differences_of_the_pair_currents() {
    // Independent check of the closed form: I_AB at 0°, I_BC at −120°, I_CA at +120°
    // (same power factor on every pair), and each line carries the difference of its
    // two pairs, I_A = I_AB − I_CA, I_B = I_BC − I_AB, I_C = I_CA − I_BC.
    let phasor = |magnitude: f64, degrees: f64| {
        let radians = degrees.to_radians();
        (magnitude * radians.cos(), magnitude * radians.sin())
    };
    let length = |(x, y): (f64, f64), (u, w): (f64, f64)| (x - u).hypot(y - w);
    let mut seed: u64 = 0x2017;
    let mut next = || {
        seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
        (seed >> 11) as f64 / (1u64 << 53) as f64 * 50_000.0
    };
    for _ in 0..1_000 {
        let pair_va = PairVa {
            AB: next(),
            BC: next(),
            CA: next(),
        };
        let ab = phasor(pair_va.AB / 230.0, 0.0);
        let bc = phasor(pair_va.BC / 230.0, -120.0);
        let ca = phasor(pair_va.CA / 230.0, 120.0);
        let lines = delta_line_currents(pair_va);
        close(lines.A, length(ab, ca), 1e-9);
        close(lines.B, length(bc, ab), 1e-9);
        close(lines.C, length(ca, bc), 1e-9);
    }
}
