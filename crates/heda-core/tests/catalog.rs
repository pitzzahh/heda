//! The PEC 2017 choices the app reads once at startup (`catalog`).

use heda_core::dispatch::dispatch;
use heda_core::session::Session;
use serde_json::{json, Value};

fn catalog() -> Value {
    dispatch(&mut Session::default(), "catalog", json!({})).unwrap()
}

fn amps(table: &Value, hp: &str) -> Option<f64> {
    table
        .as_array()?
        .iter()
        .find(|row| row[0] == hp)
        .and_then(|row| row[1].as_f64())
}

/// PEC 2017 Table 4.30.14.2, 230 V column.
#[test]
fn single_phase_motor_full_load_currents() {
    let table = &catalog()["motor_flc"]["one_phase_230"];
    assert_eq!(amps(table, "1/6"), Some(2.2));
    assert_eq!(amps(table, "1"), Some(8.0));
    assert_eq!(amps(table, "7 1/2"), Some(40.0));
    assert_eq!(amps(table, "10"), Some(50.0));
    assert_eq!(table.as_array().unwrap().len(), 12);
}

/// PEC 2017 Table 4.30.14.4, induction motors, 230 V and 400 V columns.
#[test]
fn three_phase_motor_full_load_currents() {
    let catalog = catalog();
    let at_230 = &catalog["motor_flc"]["three_phase_230"];
    let at_400 = &catalog["motor_flc"]["three_phase_400"];
    for (hp, v230, v400) in [
        ("1/2", 2.2, Some(1.3)),
        ("1 1/2", 6.0, Some(3.3)),
        ("10", 28.0, Some(18.0)),
        ("25", 68.0, Some(44.0)),
        ("100", 248.0, Some(165.0)),
        // The 400 V column prints a dash for 450 HP.
        ("450", 1030.0, None),
        ("500", 1180.0, Some(786.0)),
    ] {
        assert_eq!(amps(at_230, hp), Some(v230), "{hp} HP at 230 V");
        assert_eq!(amps(at_400, hp), v400, "{hp} HP at 400 V");
    }
}

#[test]
fn override_steps_ascend_through_the_pec_tables() {
    let catalog = catalog();
    let list = |key: &str| -> Vec<f64> {
        catalog[key]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_f64().unwrap())
            .collect()
    };
    // Table 2.40.1.6(A).
    let breakers = list("breaker_ratings");
    assert_eq!(
        (breakers[0], breakers[breakers.len() - 1], breakers.len()),
        (15.0, 6000.0, 37)
    );
    // Table 3.10.2.6(B)(16): 2.0 to 500 mm².
    let conductors = list("conductor_sizes");
    assert_eq!(
        (conductors[0], conductors[20], conductors.len()),
        (2.0, 500.0, 21)
    );
    // Table 2.50.6.13: 2.0 to 400 mm², ascending.
    assert_eq!(
        list("egc_sizes"),
        [
            2.0, 3.5, 5.5, 8.0, 14.0, 22.0, 30.0, 38.0, 50.0, 60.0, 80.0, 100.0, 125.0, 175.0,
            200.0, 250.0, 375.0, 400.0
        ]
    );
    // Table 10.1.1.4 trade sizes.
    assert_eq!(
        list("conduit_sizes"),
        [15.0, 20.0, 25.0, 32.0, 40.0, 50.0, 65.0, 80.0, 90.0, 100.0, 130.0, 150.0]
    );
    for steps in [breakers, conductors] {
        assert!(steps.windows(2).all(|pair| pair[0] < pair[1]));
    }
}
