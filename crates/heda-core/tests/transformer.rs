//! The service transformer against PEC 2017 Table 4.50.1.3(B) (p. 385), primary and
//! secondary protection: the secondary device is at most 125 % of the rated secondary
//! current from 9 A up, else 167 %, and by Note 2 that caps the total of the service mains.

use heda_core::model::phases::*;
use heda_core::session::Session;
use heda_core::sizing::{transformer_current, transformer_secondary_ocpd};
use serde_json::json;

#[test]
fn rated_secondary_current_follows_the_supply() {
    // 150 kVA ÷ (400 V × 1.732) = 216.5 A; 50 kVA ÷ 230 V = 217.4 A.
    let wye = transformer_current(150.0, Some(THREE_PHASE_WYE)).unwrap();
    assert!((wye - 216.51).abs() < 0.01);
    let one = transformer_current(50.0, Some(ONE_PHASE)).unwrap();
    assert!((one - 217.39).abs() < 0.01);
    let delta = transformer_current(75.0, Some(THREE_PHASE_DELTA)).unwrap();
    assert!((delta - 188.27).abs() < 0.01);
    assert_eq!(transformer_current(75.0, None), None);
}

#[test]
fn secondary_protection_is_125_percent_taken_down_to_a_standard_rating() {
    // 216.5 A × 125 % = 270.6 A: 250 A, not the next higher 300 A (Note 1 is primary only).
    assert_eq!(transformer_secondary_ocpd(216.51), Some(250.0));
    // 160 A × 125 % = 200 A exactly.
    assert_eq!(transformer_secondary_ocpd(160.0), Some(200.0));
    // Under 9 A it is 167 %: 8.99 A × 1.67 = 15.0 A.
    assert_eq!(transformer_secondary_ocpd(8.99), Some(15.0));
    assert_eq!(transformer_secondary_ocpd(5.0), None);
}

#[test]
fn the_riser_flags_a_transformer_too_small_for_its_load() {
    // 25 kVA one-phase: 108.7 A, secondary at most 125 A (135.9 A taken down). The panel
    // carries 30 kVA of lighting and a main above 125 A.
    let loads = (1..=10).map(|n| {
        json!({ "id": format!("L{n}"), "node_type": "load", "parent_id": "LP", "circuit_number": n,
            "conductor_sets": 1, "conductor_qty": 2,
            "load_data": { "load_type": "lighting_load", "quantity": 1, "varies": 3000 } })
    });
    let mut nodes = vec![
        json!({ "id": "root", "node_type": "root", "highest_unit_form":
            { "distribution_unit": "Service", "phase": "one_phase", "transformer_kva": 25 } }),
        json!({ "id": "LP", "node_type": "panel", "parent_id": "root", "circuit_number": 1,
            "conductor_sets": 1, "conductor_qty": 2,
            "panel_data": { "name": "LP", "phase": "one_phase", "ambient_temperature": 30 } }),
    ];
    nodes.extend(loads);
    let mut session = Session::default();
    let computed = session.open(json!({}), nodes).unwrap();
    assert_eq!(computed.rows["LP"].va, 30000.0);
    assert!(computed.rows["LP"].at > 125.0);
    let layout = session.riser("root").unwrap();
    assert_eq!(
        layout.boxes[0].lines[2..],
        ["Load: 30 kVA, OVER", "Secondary OCPD ≤ 125 A, OVER"]
    );
}
