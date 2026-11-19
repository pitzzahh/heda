//! Hand-worked sizing cases, ported from `src/lib/utils/computations/sizing.test.ts`.

use heda_core::model::load_types::*;
use heda_core::sizing::*;

/// A panel ("Main") sizes its conductor from the breaker rating, so `at` is the ampacity
/// asked for; heda's default conductor is THHN, 90 °C, at 30 °C ambient.
fn panel(at: f64) -> ConductorInput<'static> {
    ConductorInput {
        sets: 1.0,
        qty: 2.0,
        ambient_temp: 30.0,
        sizing: Sizing::Main,
        at,
        current: 0.0,
        rating: Rating::C90,
    }
}

/// The same circuit on another insulation and ambient.
fn at_ambient(at: f64, rating: Rating, ambient_temp: f64) -> ConductorInput<'static> {
    ConductorInput {
        rating,
        ambient_temp,
        ..panel(at)
    }
}

mod breaker_rating_pec_2017_table_2_40_1_6_a_and_2_10_2_3_a {
    use super::*;

    #[test]
    fn a_continuous_load_takes_125_percent() {
        // 2.10.2.3(A): 20 A × 1.25 = 25 A; 17 A × 1.25 = 21.25 A, next rating 25 A, not 30 A.
        assert_eq!(ampere_trip(20.0, Some(LIGHTING_LOAD), true, false), 25.0);
        assert_eq!(
            ampere_trip(17.0, Some(CONVENIENCE_OUTLET), true, false),
            25.0
        );
    }

    #[test]
    fn a_noncontinuous_load_takes_100_percent() {
        // 2.10.2.3(A) adds 25 % to the continuous load only: 17 A → 20 A, 20 A → 20 A.
        assert_eq!(
            ampere_trip(17.0, Some(CONVENIENCE_OUTLET), false, false),
            20.0
        );
        assert_eq!(ampere_trip(20.0, Some(LIGHTING_LOAD), false, false), 20.0);
    }

    #[test]
    fn three_hp_1p_motor_flc_17_a_times_2_5_is_42_5_a_next_45_a() {
        // Table 4.30.14.2: 3 hp at 230 V is 17 A; Table 4.30.4.2: inverse time breaker 250 %,
        // whether or not the load is marked continuous.
        assert_eq!(
            ampere_trip(17.0, Some(ONE_P_MOTOR_HORSE_POWER), true, false),
            45.0
        );
        assert_eq!(
            ampere_trip(17.0, Some(ONE_P_MOTOR_HORSE_POWER), false, false),
            45.0
        );
    }

    #[test]
    fn heating_is_continuous_per_4_24_1_3_b() {
        assert_eq!(
            ampere_trip(20.0, Some(HEATING_EQUIPMENT), false, false),
            25.0
        );
    }

    #[test]
    fn a_small_load_takes_the_smallest_rating_15_a() {
        // Table 2.40.1.6(A) starts at 15 A, which also protects 2.0 mm² (2.40.1.4(D)(3)).
        assert_eq!(
            ampere_trip(5.0, Some(CONVENIENCE_OUTLET), true, false),
            15.0
        );
        assert_eq!(ampere_trip(5.0, Some(LIGHTING_LOAD), true, false), 15.0);
        assert_eq!(
            ampere_trip(0.0, Some(CONVENIENCE_OUTLET), false, false),
            15.0
        );
    }

    #[test]
    fn dwelling_circuits_of_2_10_1_11_c_are_20_a() {
        // A 1500 VA small-appliance circuit (2.20.3.13) is 6.52 A × 1.25 = 8.15 A, yet
        // 2.10.1.11(C)(1)–(4) make it, and the laundry, bathroom and garage ones, 20 A.
        assert_eq!(
            ampere_trip(1500.0 / 230.0, Some(CONVENIENCE_OUTLET), true, true),
            20.0
        );
        assert_eq!(
            ampere_trip(0.0, Some(CONVENIENCE_OUTLET), false, true),
            20.0
        );
    }

    #[test]
    fn a_dwelling_circuit_past_20_a_has_no_rating() {
        // 2.10.1.11(C) fixes these circuits at 20 A: 4000 VA continuous is 17.39 A × 1.25 =
        // 21.7 A, which no 20 A circuit carries, so the load must be split, not given 25 A.
        assert_eq!(
            ampere_trip(4000.0 / 230.0, Some(CONVENIENCE_OUTLET), true, true),
            0.0
        );
        // Exactly 20 A still fits: 16 A × 1.25.
        assert_eq!(
            ampere_trip(16.0, Some(CONVENIENCE_OUTLET), true, true),
            20.0
        );
    }

    #[test]
    fn a_feeder_without_motors_takes_the_next_rating_up() {
        // 2.15.1.3: 72 A continuous × 1.25 = 90 A; 437.5 A → 450 A; 5 A → 15 A.
        assert_eq!(feeder_trip(90.0, 90.0), 90.0);
        assert_eq!(feeder_trip(437.5, 437.5), 450.0);
        assert_eq!(feeder_trip(5.0, 5.0), 15.0);
    }

    #[test]
    fn a_motor_feeder_takes_the_largest_rating_within_its_4_30_5_2_ceiling() {
        // App. D Ex. D10: 83.5 A load, 131 A ceiling → 125 A.
        assert_eq!(feeder_trip(83.5, 131.0), 125.0);
        // No rating between 81 and 84 A: the next one up from the load.
        assert_eq!(feeder_trip(81.0, 84.0), 90.0);
    }
}

/// Every expectation below is worked by hand from PEC 2017 Table 3.10.2.6(B)(16) (p. 174),
/// Table 3.10.2.6(B)(2)(a) (p. 170) and Table 3.10.2.6(B)(3)(a) (p. 172): a conductor must
/// meet its terminations (1.10.1.14(C)(1)) and, separately, its conditions of use
/// (3.10.2.6(B)), as App. D Ex. D21 sets out.
mod conductor_size_pec_2017_3_10_2_6_b_and_1_10_1_14_c_1 {
    use super::*;

    #[test]
    fn circuits_of_100_a_or_less_terminate_on_the_60_c_column() {
        // 1.10.1.14(C)(1)(a)
        for (at, size) in [
            (15.0, 2.0),
            (20.0, 3.5),
            (30.0, 5.5),
            (40.0, 8.0),
            (60.0, 22.0), // 14 mm² is 55 A at 60 °C
            (85.0, 30.0),
            (100.0, 38.0),
        ] {
            assert_eq!(conductor_size(panel(at)), size, "{at} A");
        }
    }

    #[test]
    fn circuits_over_100_a_terminate_on_the_75_c_column() {
        // 1.10.1.14(C)(1)(b): 38 mm² is 115 A at 75 °C, 50 mm² 140 A, 60 mm² 155 A.
        for (at, size) in [
            (110.0, 38.0),
            (125.0, 50.0),
            (150.0, 60.0),
            (200.0, 100.0),
            (400.0, 325.0),
        ] {
            assert_eq!(conductor_size(panel(at)), size, "{at} A");
        }
    }

    #[test]
    fn correction_applies_to_the_conductor_rating_capped_at_its_termination() {
        // THHN at 40 °C: 3.5 mm² is 30 A × 0.91 = 27.3 A, and terminates at 20 A (60 °C).
        assert_eq!(conductor_size(at_ambient(20.0, Rating::C90, 40.0)), 3.5);
        // THHN at 33 °C: 38 mm² is 130 A × 0.96 = 124.8 A, and terminates at 100 A.
        assert_eq!(conductor_size(at_ambient(100.0, Rating::C90, 33.0)), 38.0);
        // THHN at 55 °C: 5.5 mm² is 40 A × 0.76 = 30.4 A ≥ 30 A.
        assert_eq!(conductor_size(at_ambient(30.0, Rating::C90, 55.0)), 5.5);
        // THHN at 60 °C: 5.5 mm² is 40 A × 0.71 = 28.4 A; 8.0 mm² is 55 A × 0.71 = 39.05 A.
        assert_eq!(conductor_size(at_ambient(30.0, Rating::C90, 60.0)), 8.0);
    }

    #[test]
    fn a_cool_ambient_never_lifts_a_conductor_past_its_termination() {
        // 20 °C: 3.5 mm² THHN is 30 A × 1.08 = 32.4 A where it runs but only 20 A at its
        // 60 °C terminations, short of a 17 A motor's 125 % (21.25 A); 5.5 mm² gives 30 A.
        let motor = ConductorInput {
            sizing: Sizing::Load(THREE_P_MOTOR_RATED_CURRENT),
            current: 17.0,
            at: ampere_trip(17.0, Some(THREE_P_MOTOR_RATED_CURRENT), true, false),
            ..at_ambient(0.0, Rating::C90, 20.0)
        };
        assert_eq!(motor.at, 45.0);
        assert_eq!(conductor_size(motor), 5.5);
    }

    #[test]
    fn tw_takes_the_60_c_column_and_factors() {
        // TW at 40 °C (0.82): 5.5 mm² is 30 A × 0.82 = 24.6 A < 25 A; 8.0 mm² is 32.8 A.
        assert_eq!(conductor_size(at_ambient(25.0, Rating::C60, 40.0)), 8.0);
        assert_eq!(Rating::of(Some("TW-Cu")), Rating::C60);
    }

    #[test]
    fn tw_cannot_terminate_a_circuit_over_100_a() {
        // 1.10.1.14(C)(1)(b) takes conductors rated 75 °C or more; THWN gives 38 mm² (115 A).
        assert_eq!(conductor_size(at_ambient(110.0, Rating::C60, 30.0)), -1.0);
        assert_eq!(conductor_size(at_ambient(110.0, Rating::C75, 30.0)), 38.0);
    }

    #[test]
    fn thwn_takes_the_75_c_column_and_factors() {
        // THWN at 40 °C (0.88): 5.5 mm² is 35 A × 0.88 = 30.8 A, terminating at 30 A.
        assert_eq!(conductor_size(at_ambient(25.0, Rating::C75, 40.0)), 5.5);
        assert_eq!(Rating::of(Some("THWN-Cu")), Rating::C75);
        assert_eq!(Rating::of(Some("THWN-2-Cu")), Rating::C90);
        assert_eq!(Rating::of(Some("THHN-Cu")), Rating::C90);
    }

    #[test]
    fn no_conductor_where_the_correction_table_shows_a_dash() {
        assert_eq!(conductor_size(at_ambient(15.0, Rating::C60, 56.0)), -1.0);
        assert_eq!(conductor_size(at_ambient(15.0, Rating::C75, 71.0)), -1.0);
        assert_eq!(conductor_size(at_ambient(15.0, Rating::C90, 86.0)), -1.0);
    }

    #[test]
    fn no_conductor_past_the_table() {
        // 500 mm² terminates at 530 A (75 °C): a 600 A circuit on one set needs more sets.
        assert_eq!(conductor_size(panel(600.0)), -1.0);
    }

    #[test]
    fn app_d_ex_d9_25_hp_motor_at_40_c_on_14_mm2_thw() {
        // D9 (p. 1052): 34 A × 1.25 = 42 A on a 100 A ITD breaker; "Use three 14 mm² THW
        // wires. Ampacity of 14 mm² THW at 40°C ambient is 65 Amperes x 0.88 = 57.2 Amperes."
        // THW is in the 75 °C column. 8.0 mm² fails at its 60 °C terminations (40 A).
        assert!((corrected_ampacity(14.0, Rating::C75, 40.0, 1.0) - 57.2).abs() < 1e-9);
        let motor = ConductorInput {
            sizing: Sizing::Load(THREE_P_MOTOR_RATED_CURRENT),
            current: 34.0,
            at: 100.0,
            ..at_ambient(0.0, Rating::C75, 40.0)
        };
        assert_eq!(conductor_size(motor), 14.0);
    }

    #[test]
    fn six_conductors_at_80_percent_table_3_10_2_6_b_3_a() {
        // 30 A on 6 conductors: 5.5 mm² THHN is 40 A × 0.8 = 32 A, and terminates at 30 A.
        let input = ConductorInput {
            qty: 6.0,
            ..panel(30.0)
        };
        assert_eq!(conductor_size(input), 5.5);
        // 45 A: 8.0 mm² is 55 A × 0.8 = 44 A, short; 14 mm² is 60 A.
        assert_eq!(conductor_size(ConductorInput { at: 45.0, ..input }), 14.0);
    }

    /// 3.10.2.6(B)(3)(a) applies whenever more than three current-carrying conductors share
    /// the raceway, and every set of a circuit shares the one conduit heda sizes for it.
    #[test]
    fn the_wye_neutral_is_not_a_current_carrying_conductor() {
        // (B)(5)(a): one set of a 4-wire wye feeder is 3 conductors, no adjustment, so 125 A
        // takes 50 mm² (150 A at 90 °C, terminating at 140 A); at 80 % it would be 60 mm².
        let feeder = ConductorInput {
            qty: 4.0,
            ..panel(125.0)
        };
        assert_eq!(conductor_size(feeder), 50.0);
    }

    #[test]
    fn parallel_sets_in_one_raceway_are_adjusted() {
        // 2 sets × 2 wires = 4 conductors, 80 %: 100 A a set; 30 mm² is 115 A × 0.8 = 92 A.
        let two_wire = ConductorInput {
            sets: 2.0,
            ..panel(200.0)
        };
        assert_eq!(conductor_size(two_wire), 38.0);
        // 2 sets of a wye feeder = 6 conductors, 80 %: 125 A a set; 50 mm² is 120 A.
        let wye = ConductorInput {
            sets: 2.0,
            qty: 4.0,
            ..panel(250.0)
        };
        assert_eq!(conductor_size(wye), 60.0);
        // 3 sets × 3 wires = 9 conductors, 70 %: 150 A a set; 80 mm² is 205 A × 0.7 = 143.5 A.
        let three_wire = ConductorInput {
            sets: 3.0,
            qty: 3.0,
            ..panel(450.0)
        };
        assert_eq!(conductor_size(three_wire), 100.0);
    }

    #[test]
    fn small_motors_take_2_0_mm2_per_4_30_2_2_g() {
        // Table 4.30.14.2: 1/2 hp at 230 V is 4.9 A; 125 % is 6.125 A, and 2.0 mm² carries
        // 15 A at its 60 °C terminations. Its 15 A breaker (250 % is 12.25 A) may exceed
        // what 2.40.1.4(D) allows 2.0 mm², since Table 2.40.1.4(G) sends motors to 4.30.
        let motor = ConductorInput {
            sizing: Sizing::Load(ONE_P_MOTOR_HORSE_POWER),
            current: 4.9,
            at: 15.0,
            ..panel(0.0)
        };
        assert_eq!(conductor_size(motor), 2.0);
    }
}

#[test]
fn egc_pec_2017_table_2_50_6_13_copper() {
    for (at, size) in [
        (15.0, 2.0),
        (20.0, 3.5),
        (30.0, 5.5),
        (60.0, 5.5),
        (100.0, 8.0),
        (200.0, 14.0),
        (300.0, 22.0),
        (400.0, 30.0),
        (500.0, 30.0),
        (600.0, 38.0),
        (800.0, 50.0),
        (1000.0, 60.0),
        (1200.0, 80.0),
        (1600.0, 100.0),
        (2000.0, 125.0),
        (2500.0, 175.0),
        (3000.0, 200.0),
        (4000.0, 250.0),
        (5000.0, 375.0),
        (6000.0, 400.0),
    ] {
        assert_eq!(egc_size(at), Egc::Size(size), "{at} A");
    }
    assert_eq!(
        egc_size(6001.0),
        Egc::Error,
        "above 6000 A is outside the table"
    );
}

mod conduit_size_pec_2017_ch_10_tables_10_1_1_1_10_1_1_4_and_10_1_1_5 {
    use super::*;

    #[test]
    fn note_7_rounds_0_8_and_up() {
        // 56 / 6.2 = 9.03 → 9; 105 / 13.9 = 7.55 → 7; 48 / 10 = 4.8 → 5; 47.9 / 10 → 4
        assert_eq!(max_conductors_in_area(56.0, 6.2), 9.0);
        assert_eq!(max_conductors_in_area(105.0, 13.9), 7.0);
        assert_eq!(max_conductors_in_area(48.0, 10.0), 5.0);
        assert_eq!(max_conductors_in_area(47.9, 10.0), 4.0);
    }

    #[test]
    fn three_2_0_mm2_fit_15_mm() {
        // 3 × 6.2 = 18.6 mm² ≤ 56 mm² (40 % of 15 mm)
        assert_eq!(conduit_size(2.0, 3.0), Conduit::Size(15.0));
    }

    #[test]
    fn two_3_5_mm2_use_the_31_percent_column() {
        assert_eq!(conduit_size(3.5, 2.0), Conduit::Size(15.0));
    }

    #[test]
    fn one_conductor_uses_the_53_percent_column() {
        // 236 / 254.5 = 0.93 ≥ 0.8 → 125 mm² in 25 mm; 236 / 298.6 = 0.79 → 150 mm² needs 32 mm
        assert_eq!(conduit_size(125.0, 1.0), Conduit::Size(25.0));
        assert_eq!(conduit_size(150.0, 1.0), Conduit::Size(32.0));
    }

    #[test]
    fn five_and_six_14_mm2() {
        assert_eq!(conduit_size(14.0, 5.0), Conduit::Size(25.0));
        assert_eq!(conduit_size(14.0, 6.0), Conduit::Size(32.0));
    }

    #[test]
    fn four_100_mm2_need_65_mm() {
        // 742 / 208.7 = 3.56 → 3 (50 mm too small); 1064 / 208.7 = 5.1 → 65 mm
        assert_eq!(conduit_size(100.0, 4.0), Conduit::Size(65.0));
    }

    #[test]
    fn sizes_missing_from_table_10_1_1_5_take_the_next_larger_area() {
        assert_eq!(conduit_size(175.0, 4.0), conduit_size(200.0, 4.0));
        assert_eq!(conduit_size(400.0, 4.0), conduit_size(500.0, 4.0));
    }

    #[test]
    fn too_many_and_unknown_sizes() {
        // 6605 / 870.9 = 7.58 → 7 conductors of 500 mm² at most
        assert_eq!(conduit_size(500.0, 7.0), Conduit::Size(150.0));
        assert_eq!(conduit_size(500.0, 8.0), Conduit::Size(-1.0));
        assert_eq!(
            conduit_size(300.0, 4.0),
            Conduit::Text("Invalid conductor size")
        );
        assert_eq!(conduit_size(600.0, 4.0), Conduit::Text("Error"));
    }
}
