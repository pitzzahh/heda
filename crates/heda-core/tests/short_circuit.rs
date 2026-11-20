//! PEC 2017 Appendix D Examples D13 and D14, ported from
//! `src/lib/utils/computations/short-circuit.test.ts`.

use heda_core::short_circuit::*;

fn close(actual: f64, expected: f64, tolerance: f64) {
    assert!(
        (actual - expected).abs() < tolerance,
        "{actual} ≉ {expected}"
    );
}

/// D13: single-phase transformer, 100 kVA, 230 V, 2.5 %, infinite primary.
#[test]
fn d13_gives_17_391_a_at_the_secondary() {
    // I_sec = 100 000 / 230 = 434.78 A; I_sc(sym) = 434.78 / 0.025 = 17 391 A
    close(100_000.0 / 230.0, 434.78, 0.005);
    let z_pu = transformer_impedance_pu(2.5);
    assert_eq!(z_pu, 0.025);
    assert_eq!(
        symmetrical_fault_current(z_pu, 100.0, 230.0, true).round(),
        17_391.0
    );
}

/// D14: 230 V, 3-phase, bank of 100 kVA transformers (300 kVA) at 5 %, on a 34.5 kV
/// Meralco line with 1000 MVA short-circuit capacity; 3 × 250 mm² THW in steel
/// conduit, 30.4 m; two 100 kVA motors.
mod d14_simplified_fault_current {
    use super::*;
    const BASE_KVA: f64 = 300.0; // step 4

    fn three_phase(z_pu: f64) -> f64 {
        symmetrical_fault_current(z_pu, BASE_KVA, 230.0, false)
    }

    #[test]
    fn step_5_source() {
        close(source_impedance_pu(BASE_KVA, 1_000_000.0), 0.0003, 1e-10);
    }

    #[test]
    fn step_6_transformer() {
        assert_eq!(transformer_impedance_pu(5.0), 0.05);
    }

    #[test]
    fn step_7b_feeder() {
        // 0.00546 / (0.230 × 0.230) × 300 / 1000 = 0.031
        close(ohms_to_pu(0.00546, 230.0, BASE_KVA), 0.031, 5e-4);
    }

    #[test]
    fn step_8_motor() {
        assert_eq!(motor_impedance_pu(BASE_KVA, 100.0), 0.75);
    }

    #[test]
    fn fault_at_a_is_14_972_a() {
        let zc = source_impedance_pu(BASE_KVA, 1_000_000.0) + transformer_impedance_pu(5.0);
        close(zc, 0.0503, 1e-10);
        let current = three_phase(zc);
        assert_eq!(current.round(), 14_972.0);
        assert!(current <= 15_000.0, "breaker A ≥ 15 000 AIC");
    }

    // The 10.2 diagram uses Zm = 0.375 per motor (step 8 prints 0.75); the book's
    // 18 687 A follows from 0.375, so the fixture uses the diagram's values.
    #[test]
    fn fault_at_b_adds_the_motors_in_parallel_18_687_a() {
        let zc = 1.0 / (1.0 / 0.0503 + 2.0 / (0.031 + 0.375));
        close(1.0 / 0.0503, 19.88, 0.005);
        close(1.0 / 0.406, 2.46, 0.005);
        close(zc, 0.0403, 5e-5);
        let current = three_phase(0.0403);
        assert_eq!(current.round(), 18_687.0);
        assert!(current <= 19_000.0);
    }

    // The book prints "1100 amperes"; its own formula gives 10 562 A, which matches
    // its "say 11 000 A" and breaker C ≥ 11 000 AIC.
    #[test]
    fn fault_at_c_is_10_562_a() {
        let zt = 0.0403 + 0.031;
        close(zt, 0.0713, 1e-10);
        let current = three_phase(zt);
        assert_eq!(current.round(), 10_562.0);
        assert!(current <= 11_000.0);
    }
}

mod conductor_impedance_pec_2017_table_10_1_1_9 {
    use super::*;

    #[test]
    fn uses_r_plus_jxl_for_250_mm2_in_steel_conduit() {
        // R 0.029, XL 0.048 Ω/305 m; × 30.4 m / 305 m
        let ohms = conductor_impedance_ohm(250.0, Some("Steel"), 30.4, 1.0, false).unwrap();
        close(ohms, (f64::hypot(0.029, 0.048) * 30.4) / 305.0, 1e-12);
        close(ohms, 0.00559, 5e-6);
    }

    #[test]
    fn uses_pvc_by_default_and_the_aluminum_conduit_resistance() {
        let pvc = f64::hypot(0.077, 0.042);
        close(
            conductor_impedance_ohm(80.0, Some("PVC"), 305.0, 1.0, false).unwrap(),
            pvc,
            1e-12,
        );
        close(
            conductor_impedance_ohm(80.0, None, 305.0, 1.0, false).unwrap(),
            pvc,
            1e-12,
        );
        close(
            conductor_impedance_ohm(80.0, Some("Aluminum"), 305.0, 1.0, false).unwrap(),
            f64::hypot(0.082, 0.042),
            1e-12,
        );
    }

    #[test]
    fn counts_both_conductors_of_a_single_phase_run_and_divides_by_parallel_sets() {
        let one = conductor_impedance_ohm(14.0, Some("PVC"), 50.0, 1.0, false).unwrap();
        close(
            conductor_impedance_ohm(14.0, Some("PVC"), 50.0, 1.0, true).unwrap(),
            one * 2.0,
            1e-12,
        );
        close(
            conductor_impedance_ohm(14.0, Some("PVC"), 50.0, 2.0, false).unwrap(),
            one / 2.0,
            1e-12,
        );
        assert_eq!(
            conductor_impedance_ohm(14.0, Some("PVC"), 50.0, 0.0, false).unwrap(),
            one
        );
    }

    #[test]
    fn zero_for_zero_length_and_none_for_an_unlisted_size() {
        assert_eq!(
            conductor_impedance_ohm(2.0, Some("PVC"), 0.0, 1.0, true),
            Some(0.0)
        );
        assert_eq!(
            conductor_impedance_ohm(4.0, Some("PVC"), 10.0, 1.0, true),
            None
        );
    }
}

#[test]
fn interrupting_rating_exactly_equal_to_the_available_current_passes() {
    assert_eq!(
        interrupting_rating_status(Some(5_000.0), 5.0),
        InterruptingRatingStatus::Ok
    );
    assert_eq!(
        interrupting_rating_status(Some(5_000.1), 5.0),
        InterruptingRatingStatus::UnderRated
    );
    assert_eq!(
        interrupting_rating_status(None, 5.0),
        InterruptingRatingStatus::NoSource
    );
}
