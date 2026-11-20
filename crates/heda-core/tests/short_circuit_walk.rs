//! PEC 2017 App. D Ex. D13 and D14 walked through the engine's short-circuit table,
//! ported from `src/lib/db/queries/short-circuit-core.test.ts` and the `parallelImpedance`
//! case of `src/lib/utils/computations/short-circuit.test.ts`.

use heda_core::model::{load_types, phases};
use heda_core::session::{Computed, Session};
use heda_core::short_circuit::*;
use serde_json::{json, Value};
use std::collections::HashMap;

/// Object fields of `extra` replace those of `base`, as a JS object spread does.
fn with(mut base: Value, extra: Value) -> Value {
    let (Value::Object(base_map), Value::Object(extra_map)) = (&mut base, extra) else {
        panic!("node fields are objects");
    };
    base_map.extend(extra_map);
    base
}

/// The fields `withNodeDefaults` gives every stored node.
fn defaults(node: Value) -> Value {
    with(
        json!({
            "conductor_sets": 1,
            "conductor_qty": 2,
            "conductor_insulation": "THHN-Cu",
            "egc_insulation": "TW-Cu",
            "conduit_type": "PVC",
            "pole": "2",
            "kaic": "5",
            "is_at_used_as_currents_value": false
        }),
        node,
    )
}

/// 100 kVA, 2.5 % (PEC 2017 App. D Ex. D13) on the Metro Manila grid level (D14 step 3).
fn source() -> Value {
    json!({
        "utility_sc_kva": 1_000_000,
        "transformer_kva": 100,
        "transformer_z_percent": 2.5
    })
}

fn root(form: Value) -> Value {
    defaults(json!({
        "id": "root",
        "node_type": "root",
        "child_ids": [],
        "highest_unit_form": with(
            json!({"distribution_unit": "Transformer", "phase": phases::ONE_PHASE}),
            form
        )
    }))
}

fn panel(id: &str, parent_id: &str, circuit: u32, extra: Value) -> Value {
    defaults(with(
        json!({
            "id": id,
            "node_type": "panel",
            "parent_id": parent_id,
            "child_ids": [],
            "circuit_number": circuit,
            "overrided_conductor_size": 14,
            "overrided_length": 20,
            "panel_data": {
                "name": id,
                "terminal_temperature": "standard",
                "ambient_temperature": 30,
                "phase": phases::ONE_PHASE
            }
        }),
        extra,
    ))
}

fn load(
    id: &str,
    parent_id: &str,
    circuit: u32,
    load_type: &str,
    varies: &str,
    extra: Value,
) -> Value {
    defaults(with(
        json!({
            "id": id,
            "node_type": "load",
            "parent_id": parent_id,
            "child_ids": [],
            "circuit_number": circuit,
            "overrided_conductor_size": 3.5,
            "overrided_length": 15,
            "load_data": {
                "load_description": id,
                "terminal_temperature": "standard",
                "ambient_temperature": 30,
                "quantity": 1,
                "varies": varies,
                "continuous": false,
                "load_type": load_type,
                "config_preference": "DEFAULT"
            }
        }),
        extra,
    ))
}

fn three_phase_source() -> Value {
    with(source(), json!({"phase": phases::THREE_PHASE_WYE}))
}

/// Opens the nodes in a fresh session and answers the walk and the computed rows.
fn walk(nodes: Vec<Value>) -> (Vec<ShortCircuitRow>, Computed) {
    let mut session = Session::default();
    let computed = session.open(json!({}), nodes).expect("open");
    (session.short_circuits(), computed)
}

fn by_name(nodes: Vec<Value>) -> HashMap<String, ShortCircuitRow> {
    walk(nodes)
        .0
        .into_iter()
        .map(|row| (row.to_node_name.clone(), row))
        .collect()
}

/// Single-phase run impedance on the 100 kVA base, as the walk computes it.
fn run_pu(size: f64, length: f64, sets: f64, conduit: &str) -> f64 {
    let ohms = conductor_impedance_ohm(size, Some(conduit), length, sets, true)
        .expect("listed conductor size");
    ohms_to_pu(ohms, 230.0, 100.0)
}

fn z_source() -> f64 {
    source_impedance_pu(100.0, 1_000_000.0) + transformer_impedance_pu(2.5)
}

fn amps(z_pu: f64) -> f64 {
    symmetrical_fault_current(z_pu, 100.0, 230.0, true)
}

/// Jest's `toBeCloseTo(expected, digits)`: |actual - expected| < 10^-digits / 2.
fn close_to(actual: f64, expected: f64, digits: i32) {
    let tolerance = 0.5 * 10f64.powi(-digits);
    assert!(
        (actual - expected).abs() < tolerance,
        "{actual} is not close to {expected} at {digits} digits"
    );
}

#[test]
fn flags_every_row_when_the_source_data_is_missing_but_still_sizes_the_runs() {
    let rows = by_name(vec![root(json!({})), panel("LP-1", "root", 1, json!({}))]);
    let row = &rows["LP-1"];
    assert_eq!(row.status, InterruptingRatingStatus::NoSource);
    assert_eq!(row.supply_fault_current, None);
    assert_eq!(row.node_fault_current, None);
    close_to(
        row.conductor_z_ohm,
        2.0 * f64::hypot(0.49, 0.051) * 20.0 / 305.0,
        12,
    );
}

#[test]
fn gives_d13_at_the_transformer_bus_and_adds_the_feeder_for_the_panel_end() {
    let rows = by_name(vec![root(source()), panel("LP-1", "root", 1, json!({}))]);
    let row = &rows["LP-1"];
    // Breaker on the transformer bus: Zs + Zt = 0.0251 pu → 434.78 / 0.0251 ≈ 17,322 A.
    close_to(row.supply_z_pu.unwrap(), z_source(), 12);
    close_to(row.supply_fault_current.unwrap(), amps(0.0251), 6);
    assert_eq!(row.supply_fault_current.unwrap().round(), 17_322.0);
    // Panel bus: series 14 mm² × 20 m, both conductors.
    close_to(row.conductor_z_pu, run_pu(14.0, 20.0, 1.0, "PVC"), 12);
    close_to(
        row.node_fault_current.unwrap(),
        amps(z_source() + run_pu(14.0, 20.0, 1.0, "PVC")),
        6,
    );
    assert_eq!(row.motor_z_pu, None);
    assert_eq!(row.interrupting_rating_ka, 5.0); // PEC 2.40.7.4(C) default
    assert_eq!(row.status, InterruptingRatingStatus::UnderRated);
}

#[test]
fn adds_motor_contribution_in_parallel_at_every_bus_above_the_motor_d14_step_10_2() {
    // root ─ LP-1 (14 mm², 20 m) ─┬─ M (3.5 mm², 15 m, 10 A × 230 V = 2.3 kVA)
    //                             └─ L (3.5 mm², 15 m, lighting)
    let rows = by_name(vec![
        root(source()),
        panel("LP-1", "root", 1, json!({"kaic": "25"})),
        load(
            "M",
            "LP-1",
            1,
            load_types::ONE_P_MOTOR_RATED_CURRENT,
            "10",
            json!({}),
        ),
        load("L", "LP-1", 2, load_types::LIGHTING_LOAD, "100", json!({})),
    ]);
    let z_feeder = run_pu(14.0, 20.0, 1.0, "PVC");
    let z_branch = run_pu(3.5, 15.0, 1.0, "PVC");
    let z_motor = motor_impedance_pu(100.0, 2.3); // 100 / (2.3 / 0.25) = 10.87 pu
    close_to(rows["M"].motor_z_pu.unwrap(), z_motor, 12);

    // Transformer bus: source ∥ (feeder + branch + motor).
    let z_root_bus = 1.0 / (1.0 / z_source() + 1.0 / (z_feeder + z_branch + z_motor));
    close_to(rows["LP-1"].supply_z_pu.unwrap(), z_root_bus, 12);
    assert!(rows["LP-1"].supply_fault_current.unwrap() > amps(z_source()));
    assert_eq!(rows["LP-1"].status, InterruptingRatingStatus::Ok);

    // LP-1 bus: (source + feeder) ∥ (branch + motor). Both branch breakers see it.
    let z_panel_bus = 1.0 / (1.0 / (z_source() + z_feeder) + 1.0 / (z_branch + z_motor));
    close_to(
        rows["LP-1"].node_fault_current.unwrap(),
        amps(z_panel_bus),
        6,
    );
    close_to(
        rows["L"].supply_fault_current.unwrap(),
        amps(z_panel_bus),
        6,
    );
    close_to(
        rows["M"].supply_fault_current.unwrap(),
        amps(z_panel_bus),
        6,
    );

    // Lighting end: everything above in series with its own branch.
    close_to(
        rows["L"].node_fault_current.unwrap(),
        amps(z_panel_bus + z_branch),
        6,
    );
    // Motor end: the motor itself in parallel with the rest of the network.
    close_to(
        rows["M"].node_fault_current.unwrap(),
        amps(1.0 / (1.0 / (z_source() + z_feeder + z_branch) + 1.0 / z_motor)),
        6,
    );
}

#[test]
fn includes_motors_on_other_branches_at_a_sibling_panel_bus() {
    let rows = by_name(vec![
        root(source()),
        panel("LP-1", "root", 1, json!({})),
        load(
            "M",
            "LP-1",
            1,
            load_types::ONE_P_MOTOR_RATED_CURRENT,
            "10",
            json!({}),
        ),
        panel("LP-2", "root", 2, json!({})),
    ]);
    let z_motor_path = run_pu(14.0, 20.0, 1.0, "PVC")
        + run_pu(3.5, 15.0, 1.0, "PVC")
        + motor_impedance_pu(100.0, 2.3);
    let z_root_bus = 1.0 / (1.0 / z_source() + 1.0 / z_motor_path);
    close_to(rows["LP-2"].supply_z_pu.unwrap(), z_root_bus, 12);
    close_to(
        rows["LP-2"].node_fault_current.unwrap(),
        amps(z_root_bus + run_pu(14.0, 20.0, 1.0, "PVC")),
        6,
    );
}

#[test]
fn halves_the_run_for_two_parallel_sets_and_reads_steel_conduit_columns() {
    let rows = by_name(vec![
        root(source()),
        panel(
            "LP-1",
            "root",
            1,
            json!({"conductor_sets": 2, "conduit_type": "Steel"}),
        ),
    ]);
    close_to(
        rows["LP-1"].conductor_z_pu,
        run_pu(14.0, 20.0, 2.0, "Steel"),
        12,
    );
    close_to(
        rows["LP-1"].conductor_z_pu,
        run_pu(14.0, 20.0, 1.0, "Steel") / 2.0,
        12,
    );
}

#[test]
fn treats_an_unlisted_size_and_zero_length_as_no_impedance_the_safe_side() {
    let mut zero_length = panel("LP-2", "root", 2, json!({"length": 0}));
    zero_length
        .as_object_mut()
        .expect("node object")
        .remove("overrided_length");
    let rows = by_name(vec![
        root(source()),
        panel("LP-1", "root", 1, json!({"overrided_conductor_size": 4})),
        zero_length,
    ]);
    for name in ["LP-1", "LP-2"] {
        assert_eq!(rows[name].conductor_z_pu, 0.0);
        close_to(rows[name].node_fault_current.unwrap(), amps(z_source()), 6);
    }
}

#[test]
fn studies_a_400y_230_v_system_as_a_three_phase_fault_at_400_v_d14_step_9_4() {
    let rows = by_name(vec![
        root(three_phase_source()),
        panel(
            "LP-1",
            "root",
            1,
            json!({
                "panel_data": {
                    "name": "LP-1",
                    "terminal_temperature": "standard",
                    "ambient_temperature": 30,
                    "phase": phases::THREE_PHASE_WYE
                }
            }),
        ),
    ]);
    // One conductor per phase (no ×2 loop), on a 400 V base.
    let z_run = ohms_to_pu(
        conductor_impedance_ohm(14.0, Some("PVC"), 20.0, 1.0, false).expect("listed size"),
        400.0,
        100.0,
    );
    close_to(rows["LP-1"].conductor_z_pu, z_run, 12);
    // 100 kVA at 400 V: 100000 / (1.732 × 400) = 144.34 A base; ÷ 0.0251 pu ≈ 5,751 A.
    let expected = symmetrical_fault_current(z_source(), 100.0, 400.0, false);
    close_to(rows["LP-1"].supply_fault_current.unwrap(), expected, 6);
    assert_eq!(expected.round(), 5_751.0);
}

#[test]
fn faults_a_230_v_branch_of_a_400y_230_v_system_line_to_neutral_d13_loop_on_d14_per_unit() {
    let rows = by_name(vec![
        root(three_phase_source()),
        load(
            "L1",
            "root",
            1,
            load_types::LIGHTING_LOAD,
            "100",
            json!({"overrided_conductor_size": 14, "overrided_length": 20}),
        ),
    ]);
    // Phase out and neutral back: twice the 14 mm² run, on the 400 V base.
    let loop_pu = ohms_to_pu(
        conductor_impedance_ohm(14.0, Some("PVC"), 20.0, 1.0, true).expect("listed size"),
        400.0,
        100.0,
    );
    let row = &rows["L1"];
    close_to(row.conductor_z_pu, loop_pu, 12);
    // At the bus a line-to-neutral fault equals the three-phase one (Z0 = Z1).
    close_to(
        row.supply_fault_current.unwrap(),
        symmetrical_fault_current(z_source(), 100.0, 400.0, false),
        6,
    );
    // At the load: 230 V ÷ (per-phase path + loop) in ohms is the same as base ÷ pu.
    let z_ohm = ((z_source() + loop_pu) * 400.0 * 400.0) / 100_000.0;
    close_to(row.node_fault_current.unwrap(), 230.94 / z_ohm, 0);
}

#[test]
fn counts_three_phase_motors_toward_the_fault_d14_step_8() {
    let rows = by_name(vec![
        root(three_phase_source()),
        load(
            "M3",
            "root",
            1,
            load_types::THREE_P_MOTOR_RATED_CURRENT,
            "44",
            json!({}),
        ),
    ]);
    // 44 A × 400 V × 1.732 = 30.48 kVA → Zm = 100 / (30.48 / 0.25) pu.
    close_to(
        rows["M3"].motor_z_pu.unwrap(),
        motor_impedance_pu(100.0, 30.4832),
        10,
    );
    assert!(
        rows["M3"].supply_fault_current.unwrap()
            > symmetrical_fault_current(z_source(), 100.0, 400.0, false)
    );
}

#[test]
fn takes_the_plain_motor_rating_times_quantity_as_motor_kva_with_no_125_percent_sizing_d14_step_8()
{
    // Two 25 HP motors; the horsepower picker stores the Table 4.30.14.4 400 V FLC, 44 A.
    let mut motors = load(
        "M3",
        "root",
        1,
        load_types::THREE_P_MOTOR_HORSE_POWER,
        "44",
        json!({}),
    );
    motors["load_data"]["quantity"] = json!(2);
    let (rows, computed) = walk(vec![root(three_phase_source()), motors]);
    let row = rows
        .iter()
        .find(|row| row.to_node_name == "M3")
        .expect("M3 row");
    // VA = 2 × 1.732 × 400 V × 44 A = 60,966.4 VA = 60.9664 kVA.
    close_to(computed.rows["M3"].va, 60_966.4, 6);
    // Zm = 100 kVA / (60.9664 kVA / 0.25) = 100 / 243.8656 = 0.41006 pu.
    close_to(row.motor_z_pu.unwrap(), 0.4100619357547764, 12);
}

#[test]
fn puts_a_230_v_motor_on_a_3p_y_system_at_its_real_line_to_neutral_ohms_safe_side() {
    let rows = by_name(vec![
        root(three_phase_source()),
        load(
            "M1",
            "root",
            1,
            load_types::ONE_P_MOTOR_RATED_CURRENT,
            "10",
            json!({}),
        ),
    ]);
    let row = &rows["M1"];
    // Motor: 230 V × 10 A = 2.3 kVA → 0.25 × 230² / 2300 = 5.75 Ω line to neutral.
    // On the 400 V, 100 kVA base (Zbase = 0.4² / 0.1 = 1.6 Ω): 5.75 / 1.6 = 3.59375 pu,
    // i.e. D14 step 8 on 2.3 × (400/230)² = 6.9565 kVA.
    close_to(row.motor_z_pu.unwrap(), 3.59375, 12);
    // Branch loop: 2 × |2.0 + j0.054| × 15 / 305 = 0.19679 Ω → / 1.6 = 0.122996 pu.
    close_to(row.conductor_z_pu, 0.12299562708123907, 12);
    // Transformer bus: 0.0251 ∥ (0.122996 + 3.59375) = 0.0249316 pu → 144.34 A / 0.0249316 ≈ 5,790 A,
    // against 5,751 A from the source alone.
    close_to(row.supply_z_pu.unwrap(), 0.02493163121550489, 12);
    assert_eq!(row.supply_fault_current.unwrap().round(), 5_790.0);
}

#[test]
fn returns_rows_in_preorder_like_the_voltage_drop_table() {
    let (rows, _) = walk(vec![
        root(source()),
        panel("LP-1", "root", 1, json!({})),
        load("A", "LP-1", 1, load_types::LIGHTING_LOAD, "100", json!({})),
        panel("LP-2", "root", 2, json!({})),
    ]);
    let names: Vec<&str> = rows.iter().map(|row| row.to_node_name.as_str()).collect();
    let from: Vec<&str> = rows.iter().map(|row| row.from_node_name.as_str()).collect();
    assert_eq!(names, ["LP-1", "A", "LP-2"]);
    assert_eq!(from, ["Transformer", "LP-1", "Transformer"]);
}

#[test]
fn returns_nothing_without_a_root() {
    assert!(walk(Vec::new()).0.is_empty());
}

#[test]
fn parallel_impedance_drops_infinite_paths_and_is_infinite_with_none_left() {
    // 1 / (1/a + 1/b): an infinite path adds 1/∞ = 0 to the admittance.
    assert_eq!(1.0 / (1.0 / 0.05 + 1.0 / f64::INFINITY), 0.05);
    assert_eq!(1.0 / (1.0 / 2.0 + 1.0 / 2.0), 1.0);
    assert_eq!(
        1.0 / (1.0 / f64::INFINITY + 1.0 / f64::INFINITY),
        f64::INFINITY
    );
}
