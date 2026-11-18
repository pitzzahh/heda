//! Hand-worked sizing cases, ported from `src/lib/utils/computations/sizing.test.ts`.

use heda_core::model::load_types::*;
use heda_core::sizing::*;

/// A panel ("Main") sizes its conductor from the breaker rating, so `at` is the ampacity asked for.
fn panel(at: f64) -> ConductorInput<'static> {
    ConductorInput {
        sets: 1.0,
        qty: 2.0,
        ambient_temp: 30.0,
        sizing: Sizing::Main,
        at,
        current: 0.0,
        is_dynamic: false,
    }
}

mod breaker_rating_pec_2017_table_2_40_1_6_a_and_2_10_2_3_a {
    use super::*;

    #[test]
    fn lighting_20_a_times_1_25_is_25_a() {
        assert_eq!(ampere_trip(20.0, Some(LIGHTING_LOAD)), 25.0);
    }

    #[test]
    fn outlets_17_a_times_1_25_is_21_25_a_next_rating_25_a_not_30_a() {
        assert_eq!(ampere_trip(17.0, Some(CONVENIENCE_OUTLET)), 25.0);
    }

    #[test]
    fn three_hp_1p_motor_flc_17_a_times_2_5_is_42_5_a_next_45_a() {
        // Table 4.30.14.2: 3 hp at 230 V is 17 A; Table 4.30.4.2: inverse time breaker 250 %.
        assert_eq!(ampere_trip(17.0, Some(ONE_P_MOTOR_HORSE_POWER)), 45.0);
    }

    #[test]
    fn heating_is_continuous_per_4_24_1_3_b() {
        assert_eq!(ampere_trip(20.0, Some(HEATING_EQUIPMENT)), 25.0);
    }

    #[test]
    fn panels_72_a_gives_90_a_and_350_a_gives_437_5_a_next_450_a() {
        assert_eq!(ampere_trip(72.0, None), 90.0);
        assert_eq!(ampere_trip(350.0, None), 450.0);
    }

    #[test]
    fn floors_30_a_for_panels_20_a_for_non_lighting_loads() {
        assert_eq!(ampere_trip(5.0, None), 30.0);
        assert_eq!(ampere_trip(5.0, Some(CONVENIENCE_OUTLET)), 20.0);
        assert_eq!(ampere_trip(5.0, Some(LIGHTING_LOAD)), 15.0);
    }
}

mod conductor_size_pec_2017_table_3_10_2_6_b_16_with_1_10_1_14_c_1 {
    use super::*;

    #[test]
    fn a85_is_30_mm2_60_c_column() {
        assert_eq!(conductor_size(panel(85.0)), 30.0);
    }

    #[test]
    fn a100_is_38_mm2_its_60_c_ampacity() {
        assert_eq!(conductor_size(panel(100.0)), 38.0);
    }

    #[test]
    fn a110_is_50_mm2_since_38_mm2_is_100_a_at_60_c() {
        assert_eq!(conductor_size(panel(110.0)), 50.0);
    }

    #[test]
    fn a140_is_50_mm2_and_a141_is_60_mm2_75_c_column() {
        assert_eq!(conductor_size(panel(140.0)), 50.0);
        assert_eq!(conductor_size(panel(141.0)), 60.0);
    }

    #[test]
    fn ambient_33_c_factor_0_94_on_100_a_gives_106_4_a_so_50_mm2() {
        let input = ConductorInput {
            ambient_temp: 33.0,
            ..panel(100.0)
        };
        assert!((adjusted_current(input) - 106.383).abs() < 5e-4);
        assert_eq!(conductor_size(input), 50.0);
    }

    #[test]
    fn six_conductors_at_80_percent_table_3_10_2_6_b_3_a() {
        // 30 A / 0.8 = 37.5 A → 8.0 mm²
        let input = ConductorInput {
            qty: 6.0,
            is_dynamic: true,
            ..panel(30.0)
        };
        assert_eq!(adjusted_current(input), 37.5);
        assert_eq!(conductor_size(input), 8.0);
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
