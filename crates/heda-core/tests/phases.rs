//! Three-phase cases, ported from `src/lib/utils/computations/three-phase.test.ts`.

use heda_core::model::{
    load_types::*, phases as names, HighestUnitForm, LoadData, Node, PanelData,
};
use heda_core::phases::*;
use heda_core::sizing::{volt_ampere, WYE_LINE_VOLTAGE};

fn close(actual: f64, expected: f64, tolerance: f64) {
    assert!(
        (actual - expected).abs() < tolerance,
        "{actual} ≉ {expected}"
    );
}

#[test]
fn d6_6_3_service_current_98_a() {
    // [66 190 VA + 25 % (6 000 VA)] ÷ (400 V)(1.732) = 97.7 → 98 A
    let current = three_phase_current(66_190.0 + 0.25 * 6_000.0);
    close(current, 97.7, 0.05);
    assert_eq!(current.round(), 98.0);
}

#[test]
fn d8_8_6_service_current_242_a() {
    assert_eq!(three_phase_current(168_000.0).round(), 242.0);
}

#[test]
fn table_4_30_14_4_25_hp_motor_round_trips_44_a() {
    // 44 A × 400 V × 1.732 = 30 483.2 VA → 44 A
    let va = volt_ampere(Some(THREE_P_MOTOR_HORSE_POWER), 1.0, 44.0, WYE_LINE_VOLTAGE);
    close(va, 30_483.2, 1e-6);
    close(three_phase_current(va), 44.0, 1e-10);
}

#[test]
fn rated_current_motors_multiply_by_quantity() {
    let va = volt_ampere(
        Some(THREE_P_MOTOR_RATED_CURRENT),
        2.0,
        10.0,
        WYE_LINE_VOLTAGE,
    );
    close(three_phase_current(va), 20.0, 1e-10);
}

#[test]
fn d6_6_kva_package_acu_is_three_phase_equipment_va() {
    let va = volt_ampere(Some(THREE_P_EQUIPMENT), 1.0, 6_000.0, WYE_LINE_VOLTAGE);
    assert_eq!(va, 6_000.0);
    close(three_phase_current(va), 8.66, 0.005);
}

#[test]
fn d7_single_phase_motor_stays_at_230_v() {
    // 1-Hp room acu, 8 A × 230 V = 1 840 VA
    let va = volt_ampere(Some(ONE_P_MOTOR_RATED_CURRENT), 1.0, 8.0, WYE_LINE_VOLTAGE);
    assert_eq!(va, 1_840.0);
    assert_eq!(single_phase_current(va), 8.0);
}

#[test]
fn recognises_only_three_phase_load_types() {
    assert!(is_three_phase_load_type(Some(THREE_P_MOTOR_HORSE_POWER)));
    assert!(is_three_phase_load_type(Some(THREE_P_MOTOR_RATED_CURRENT)));
    assert!(is_three_phase_load_type(Some(THREE_P_EQUIPMENT)));
    assert!(!is_three_phase_load_type(Some(ONE_P_MOTOR_RATED_CURRENT)));
    assert!(!is_three_phase_load_type(None));
}

#[test]
fn rotates_rows_of_two_circuits() {
    let phases: Vec<&str> = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 12.0, 13.0]
        .into_iter()
        .map(|n| default_phase_assignment(Some(n)))
        .collect();
    assert_eq!(phases, ["A", "A", "B", "B", "C", "C", "A", "A", "C", "A"]);
}

#[test]
fn stores_an_override_only_when_it_differs() {
    assert_eq!(phase_override("B", Some(3.0), Supply::Wye), None);
    assert_eq!(phase_override("C", Some(3.0), Supply::Wye), Some("C"));
    // On delta, circuit 3 defaults to the BC pair.
    assert_eq!(phase_override("BC", Some(3.0), Supply::Delta), None);
    assert_eq!(phase_override("AB", Some(3.0), Supply::Delta), Some("AB"));
}

#[test]
fn falls_back_to_a_and_keeps_an_override() {
    assert_eq!(default_phase_assignment(None), "A");
    assert_eq!(default_phase_assignment(Some(0.0)), "A");
    let circuit = Node {
        circuit_number: Some(3.0),
        ..Node::default()
    };
    assert_eq!(phase_of(&circuit, Supply::Wye), "B");
    let overridden = Node {
        phase_assignment: Some("C".into()),
        ..circuit
    };
    assert_eq!(phase_of(&overridden, Supply::Wye), "C");
    // A wye phase left on a circuit moved under delta falls back to its pair, and back.
    assert_eq!(phase_of(&overridden, Supply::Delta), "BC");
    let pair = Node {
        phase_assignment: Some("CA".into()),
        ..overridden
    };
    assert_eq!(phase_of(&pair, Supply::Wye), "B");
}

#[test]
fn balanced_wye_feeder_equals_the_d6_formula() {
    // D8: 168 000 VA spread evenly. 56 000 / 230 = 243.5 A vs 242.5 A: 3 × 230 V is 690 V, not 692.8 V.
    let (balanced, highest, design) = wye_feeder_current(PhaseVa {
        A: 56_000.0,
        B: 56_000.0,
        C: 56_000.0,
    });
    close(balanced, three_phase_current(168_000.0), 1e-10);
    close(highest, 243.48, 0.005);
    assert_eq!(design, highest);
}

#[test]
fn unbalanced_wye_feeder_sizes_on_its_most_loaded_phase() {
    let (balanced, highest, design) = wye_feeder_current(PhaseVa {
        A: 9_200.0,
        B: 2_300.0,
        C: 0.0,
    });
    close(balanced, 11_500.0 / 692.8, 1e-10);
    assert_eq!(highest, 40.0);
    assert_eq!(design, 40.0);
}

#[test]
fn unbalance_is_the_largest_deviation_from_the_average() {
    // Average 11 500 / 3 = 3 833.33 VA; A is 5 366.67 VA over it: 140 %.
    assert_eq!(unbalance_percent([9_200.0, 2_300.0, 0.0]), 140.0);
    // The balancer's result below: average 3 500 VA, A 1 500 VA over: 42.857 → 42.86 %.
    assert_eq!(unbalance_percent([5_000.0, 3_000.0, 2_500.0]), 42.86);
    assert_eq!(unbalance_percent([56_000.0, 56_000.0, 56_000.0]), 0.0);
    assert_eq!(unbalance_percent([0.0, 0.0, 0.0]), 0.0);
}

#[test]
fn empty_wye_feeder_is_zero() {
    assert_eq!(wye_feeder_current(PhaseVa::default()), (0.0, 0.0, 0.0));
}

#[test]
fn adds_single_phase_va_to_its_phase_and_splits_three_phase_va() {
    let total = PhaseVa::default()
        .add(1_840.0, "A")
        .add(1_500.0, "B")
        .add(6_000.0, ALL_PHASES);
    assert_eq!(
        total,
        PhaseVa {
            A: 3_840.0,
            B: 3_500.0,
            C: 2_000.0
        }
    );
}

fn panel(phase: &str) -> Node {
    Node {
        node_type: "panel".into(),
        panel_data: Some(PanelData {
            phase: Some(phase.into()),
            ..PanelData::default()
        }),
        ..Node::default()
    }
}

fn load(load_type: &str) -> Node {
    Node {
        node_type: "load".into(),
        load_data: Some(LoadData {
            load_type: Some(load_type.into()),
            ..LoadData::default()
        }),
        ..Node::default()
    }
}

#[test]
fn supply_error_needs_a_wye_supply_for_three_phase_circuits() {
    let (wye, one) = (panel(names::THREE_PHASE_WYE), panel(names::ONE_PHASE));
    let motor = load(THREE_P_MOTOR_RATED_CURRENT);
    assert_eq!(supply_error(&motor, Some(&wye), &[]), None);
    assert!(supply_error(&motor, Some(&one), &[])
        .unwrap()
        .contains("three-phase supply"));
    assert!(supply_error(&wye, Some(&one), &[])
        .unwrap()
        .contains("3P-Y"));
    let root = Node {
        node_type: "root".into(),
        highest_unit_form: Some(HighestUnitForm {
            phase: Some(names::THREE_PHASE_WYE.into()),
            ..HighestUnitForm::default()
        }),
        ..Node::default()
    };
    assert_eq!(supply_error(&motor, Some(&root), &[]), None);
}

#[test]
fn supply_error_takes_single_phase_circuits_anywhere() {
    let (wye, one) = (panel(names::THREE_PHASE_WYE), panel(names::ONE_PHASE));
    assert_eq!(supply_error(&load(LIGHTING_LOAD), Some(&one), &[]), None);
    assert_eq!(supply_error(&one, Some(&wye), &[]), None);
}

#[test]
fn supply_error_keeps_a_panel_wye_while_it_feeds_three_phase_circuits() {
    let (wye, one) = (panel(names::THREE_PHASE_WYE), panel(names::ONE_PHASE));
    let error = supply_error(&one, Some(&wye), &[load(THREE_P_MOTOR_RATED_CURRENT)]);
    assert!(error.unwrap().contains("stay three-phase"));
    assert_eq!(supply_error(&one, Some(&wye), &[load(LIGHTING_LOAD)]), None);
}

#[test]
fn balancing_puts_the_largest_load_on_the_lightest_phase_after_three_phase_shares() {
    let circuits = [
        BalanceCircuit {
            id: "m",
            va: 3_000.0,
            phase: ALL_PHASES,
            split: None,
        }, // 1 000 VA on each phase
        BalanceCircuit {
            id: "a",
            va: 1_000.0,
            phase: "A",
            split: None,
        },
        BalanceCircuit {
            id: "b",
            va: 4_000.0,
            phase: "A",
            split: None,
        },
        BalanceCircuit {
            id: "c",
            va: 2_000.0,
            phase: "A",
            split: None,
        },
        BalanceCircuit {
            id: "d",
            va: 1_500.0,
            phase: "B",
            split: None,
        },
    ];
    // 4 000 → A (tie, A first); 2 000 → B; 1 500 → C; 1 000 → C (2 500 < 3 000 < 5 000).
    assert_eq!(
        balanced_phase_assignments(&circuits, Supply::Wye),
        [("b", "A"), ("c", "B"), ("d", "C"), ("a", "C")]
    );
    assert!(balanced_phase_assignments(&[], Supply::Wye).is_empty());
}

fn circuit<'a>(id: &'a str, va: f64, phase: &'a str) -> BalanceCircuit<'a> {
    BalanceCircuit {
        id,
        va,
        phase,
        split: None,
    }
}

#[test]
fn balancing_seeds_a_three_phase_sub_panel_with_its_own_phases() {
    // The sub-panel puts all 3 000 VA on A, so its feeder carries it there (PEC 2017
    // 2.20.3.22(A)); spread evenly, the 1 000 VA load would tie on A and stay there.
    let circuits = [
        BalanceCircuit {
            split: Some([3_000.0, 0.0, 0.0]),
            ..circuit("sub", 3_000.0, ALL_PHASES)
        },
        circuit("x", 1_000.0, "A"),
    ];
    // A 4 000 VA now; on B the heaviest phase drops to A's 3 000 VA.
    assert_eq!(
        balanced_phase_assignments(&circuits, Supply::Wye),
        [("x", "B")]
    );
}

#[test]
fn balancing_keeps_phases_the_suggestion_would_make_heavier() {
    // Already the best split: A 5 + 4, B 5 + 4, C 3 + 3 + 3 = 9 000 VA each.
    // Largest-first would give A 5 + 3 + 3 = 11 000 VA, a heavier feeder phase.
    let circuits = [
        circuit("a5", 5_000.0, "A"),
        circuit("b5", 5_000.0, "B"),
        circuit("a4", 4_000.0, "A"),
        circuit("b4", 4_000.0, "B"),
        circuit("c1", 3_000.0, "C"),
        circuit("c2", 3_000.0, "C"),
        circuit("c3", 3_000.0, "C"),
    ];
    assert_eq!(
        balanced_phase_assignments(&circuits, Supply::Wye),
        [
            ("a5", "A"),
            ("b5", "B"),
            ("a4", "A"),
            ("b4", "B"),
            ("c1", "C"),
            ("c2", "C"),
            ("c3", "C")
        ]
    );
}

#[test]
fn delta_balancing_keeps_phases_the_suggestion_would_make_a_heavier_line() {
    // Now AB 2 300, BC 3 100, CA 2 280 VA: line B carries √(3100² + 2300² + 3100·2300) ÷ 230
    // = 20.41 A. Largest-first gives AB 2 900, BC 2 580, CA 2 200: its heaviest pair is
    // lighter, but line B rises to 20.65 A, so the feeder would carry more.
    let circuits = [
        circuit("p", 2_000.0, "BC"),
        circuit("q", 1_100.0, "AB"),
        circuit("r", 1_100.0, "BC"),
        circuit("s", 1_200.0, "AB"),
        circuit("t", 1_000.0, "CA"),
        circuit("u", 900.0, "CA"),
        circuit("v", 380.0, "CA"),
    ];
    // Kept as they are, in assignment order (largest first, ties stable).
    assert_eq!(
        balanced_phase_assignments(&circuits, Supply::Delta),
        [
            ("p", "BC"),
            ("s", "AB"),
            ("q", "AB"),
            ("r", "BC"),
            ("t", "CA"),
            ("u", "CA"),
            ("v", "CA")
        ]
    );
}
