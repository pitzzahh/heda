//! PEC 2017 Part 1 table data used by the calculations, ported from
//! `src/lib/constants.ts` value for value. Each table names its source; every value
//! was checked against the rendered page images (the PDF text layer is corrupt in places).

/// PEC 2017 Table 2.40.1.6(A): standard ampere ratings for fuses and inverse time circuit breakers.
pub const STANDARD_AMPERE_RATINGS: [f64; 37] = [
    15.0, 20.0, 25.0, 30.0, 35.0, 40.0, 45.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0, 110.0, 125.0,
    150.0, 175.0, 200.0, 225.0, 250.0, 300.0, 350.0, 400.0, 450.0, 500.0, 600.0, 700.0, 800.0,
    1000.0, 1200.0, 1600.0, 2000.0, 2500.0, 3000.0, 4000.0, 5000.0, 6000.0,
];

/// PEC 2017 Table 3.10.2.6(B)(16), copper (p. 174): allowable ampacity at 30 °C ambient,
/// not more than three current-carrying conductors, as `(size_mm2, [60 °C, 75 °C, 90 °C])`.
pub const COPPER_AMPACITIES: [(f64, [f64; 3]); 21] = [
    (2.0, [15.0, 20.0, 25.0]),
    (3.5, [20.0, 25.0, 30.0]),
    (5.5, [30.0, 35.0, 40.0]),
    (8.0, [40.0, 50.0, 55.0]),
    (14.0, [55.0, 65.0, 75.0]),
    (22.0, [70.0, 85.0, 95.0]),
    (30.0, [85.0, 100.0, 115.0]),
    (38.0, [100.0, 115.0, 130.0]),
    (50.0, [115.0, 140.0, 150.0]),
    (60.0, [130.0, 155.0, 170.0]),
    (80.0, [155.0, 190.0, 205.0]),
    (100.0, [185.0, 220.0, 240.0]),
    (125.0, [210.0, 255.0, 285.0]),
    (150.0, [240.0, 285.0, 320.0]),
    (175.0, [260.0, 305.0, 345.0]),
    (200.0, [275.0, 325.0, 360.0]),
    (250.0, [315.0, 375.0, 425.0]),
    (325.0, [370.0, 435.0, 490.0]),
    (375.0, [395.0, 470.0, 530.0]),
    (400.0, [400.0, 480.0, 535.0]),
    (500.0, [445.0, 530.0, 595.0]),
];

/// A dash in Table 3.10.2.6(B)(2)(a): the conductor may not be used at that ambient.
const NO_FACTOR: f64 = f64::NAN;

/// PEC 2017 Table 3.10.2.6(B)(2)(a) (p. 170): ambient temperature correction factors based
/// on 30 °C, as `(up_to_celsius, [60 °C, 75 °C, 90 °C])`; past 85 °C no conductor qualifies.
pub const AMBIENT_CORRECTION_FACTORS: [(f64, [f64; 3]); 16] = [
    (10.0, [1.29, 1.2, 1.15]),
    (15.0, [1.22, 1.15, 1.12]),
    (20.0, [1.15, 1.11, 1.08]),
    (25.0, [1.08, 1.05, 1.04]),
    (30.0, [1.0, 1.0, 1.0]),
    (35.0, [0.91, 0.94, 0.96]),
    (40.0, [0.82, 0.88, 0.91]),
    (45.0, [0.71, 0.82, 0.87]),
    (50.0, [0.58, 0.75, 0.82]),
    (55.0, [0.41, 0.67, 0.76]),
    (60.0, [NO_FACTOR, 0.58, 0.71]),
    (65.0, [NO_FACTOR, 0.47, 0.65]),
    (70.0, [NO_FACTOR, 0.33, 0.58]),
    (75.0, [NO_FACTOR, NO_FACTOR, 0.5]),
    (80.0, [NO_FACTOR, NO_FACTOR, 0.41]),
    (85.0, [NO_FACTOR, NO_FACTOR, 0.29]),
];

/// PEC 2017 Table 2.50.6.13: minimum copper equipment grounding conductor (mm²) by
/// overcurrent device rating, as `(above_amperes, size)`; `None` past the table.
pub const AMPERE_TRIP_TO_COPPER: [(f64, Option<f64>); 19] = [
    (6000.0, None),
    (5000.0, Some(400.0)),
    (4000.0, Some(375.0)),
    (3000.0, Some(250.0)),
    (2500.0, Some(200.0)),
    (2000.0, Some(175.0)),
    (1600.0, Some(125.0)),
    (1200.0, Some(100.0)),
    (1000.0, Some(80.0)),
    (800.0, Some(60.0)),
    (600.0, Some(50.0)),
    (500.0, Some(38.0)),
    (300.0, Some(30.0)),
    (200.0, Some(22.0)),
    (100.0, Some(14.0)),
    (60.0, Some(8.0)),
    (20.0, Some(5.5)),
    (15.0, Some(3.5)),
    (0.0, Some(2.0)),
];

/// PEC 2017 Table 2.50.3.17: copper grounding electrode conductor (mm²) by the largest
/// copper ungrounded service-entrance conductor or equivalent area for parallel
/// conductors, as `(up_to_mm2, gec_mm2)`; over 500 mm² it is 80 mm².
pub const GEC_COPPER: [(f64, f64); 6] = [
    (30.0, 8.0),
    (50.0, 14.0),
    (80.0, 22.0),
    (175.0, 30.0),
    (325.0, 50.0),
    (500.0, 60.0),
];
pub const GEC_COPPER_OVER_500: f64 = 80.0;

/// PEC 2017 Table 2.50.5.13(C)(1): copper grounded conductor, main, system and
/// supply-side bonding jumper (mm²) by the largest copper ungrounded conductor or
/// equivalent area for parallel conductors, as `(up_to_mm2, jumper_mm2)`. Over 500 mm²,
/// Note 1: 12½ % of that area, never more than the conductors.
pub const BONDING_JUMPER_COPPER: [(f64, f64); 6] = [
    (30.0, 8.0),
    (50.0, 14.0),
    (80.0, 22.0),
    (175.0, 30.0),
    (325.0, 50.0),
    (500.0, 60.0),
];

/// PEC 2017 Ch. 10 Table 10.1.1.9: effective Z at 0.85 PF, uncoated copper in PVC
/// conduit, ohms to neutral per 305 m (Note 2: an approximation of R·cosθ + X·sinθ
/// for voltage drop), as `(size_mm2, ohms)`.
pub const ALTERNATING_CURRENT_REACTANCE: [(f64, f64); 21] = [
    (2.0, 2.7),
    (3.5, 1.7),
    (5.5, 1.1),
    (8.0, 0.69),
    (14.0, 0.44),
    (22.0, 0.29),
    (30.0, 0.19),
    (38.0, 0.16),
    (50.0, 0.13),
    (60.0, 0.11),
    (80.0, 0.088),
    (100.0, 0.074),
    (125.0, 0.066),
    (150.0, 0.059),
    (175.0, 0.053),
    (200.0, 0.049),
    (250.0, 0.043),
    (325.0, 0.04),
    (375.0, 0.036),
    (400.0, 0.036),
    (500.0, 0.032),
];

/// One row of PEC 2017 Ch. 10 Table 10.1.1.9, ohms to neutral per 305 m.
pub struct ResistanceReactance {
    pub xl: f64,
    pub xl_steel: f64,
    pub r_pvc: f64,
    pub r_aluminum: f64,
    pub r_steel: f64,
}

const fn rx(
    xl: f64,
    xl_steel: f64,
    r_pvc: f64,
    r_aluminum: f64,
    r_steel: f64,
) -> ResistanceReactance {
    ResistanceReactance {
        xl,
        xl_steel,
        r_pvc,
        r_aluminum,
        r_steel,
    }
}

/// PEC 2017 Ch. 10 Table 10.1.1.9: AC resistance and reactance of 600 V cables,
/// 3-phase, 60 Hz, 75°C, three single conductors in conduit, uncoated copper.
/// `r_aluminum` is the copper resistance in aluminum conduit.
// shortcut: copper columns only; add the aluminum conductor columns when aluminum conductors are supported.
pub const CONDUCTOR_RESISTANCE_REACTANCE: [(f64, ResistanceReactance); 21] = [
    (2.0, rx(0.058, 0.073, 3.1, 3.1, 3.1)),
    (3.5, rx(0.054, 0.068, 2.0, 2.0, 2.0)),
    (5.5, rx(0.05, 0.063, 1.2, 1.2, 1.2)),
    (8.0, rx(0.052, 0.065, 0.78, 0.78, 0.78)),
    (14.0, rx(0.051, 0.064, 0.49, 0.49, 0.49)),
    (22.0, rx(0.048, 0.06, 0.31, 0.31, 0.31)),
    (30.0, rx(0.045, 0.057, 0.19, 0.2, 0.2)),
    (38.0, rx(0.046, 0.057, 0.15, 0.16, 0.16)),
    (50.0, rx(0.044, 0.055, 0.12, 0.13, 0.12)),
    (60.0, rx(0.043, 0.054, 0.1, 0.1, 0.1)),
    (80.0, rx(0.042, 0.052, 0.077, 0.082, 0.079)),
    (100.0, rx(0.041, 0.051, 0.062, 0.067, 0.063)),
    (125.0, rx(0.041, 0.052, 0.052, 0.057, 0.054)),
    (150.0, rx(0.041, 0.051, 0.044, 0.049, 0.045)),
    (175.0, rx(0.04, 0.05, 0.038, 0.043, 0.039)),
    (200.0, rx(0.04, 0.049, 0.033, 0.038, 0.035)),
    (250.0, rx(0.039, 0.048, 0.027, 0.032, 0.029)),
    (325.0, rx(0.039, 0.048, 0.023, 0.028, 0.025)),
    (375.0, rx(0.038, 0.048, 0.019, 0.024, 0.021)),
    (400.0, rx(0.038, 0.048, 0.019, 0.024, 0.021)),
    (500.0, rx(0.037, 0.046, 0.015, 0.019, 0.018)),
];

/// PEC 2017 2.40.7.4(C): only breakers rated other than 5 000 A must show their
/// interrupting rating, so a breaker with none entered is taken as 5 kA.
pub const UNMARKED_BREAKER_INTERRUPTING_RATING_KA: f64 = 5.0;

/// PEC 2017 App. D Ex. D14 step 8: average induction motor impedance (per IEEE Std 141),
/// on the motor's own kVA.
pub const MOTOR_IMPEDANCE_PU: f64 = 0.25;

/// PEC 2017 Ch. 10 Table 10.1.1.4, Article 3.52 Rigid PVC Conduit, Schedule 80: raceway
/// size (mm) and the area (mm²) Table 10.1.1.1 allows for 1 conductor (53 %), 2 (31 %)
/// and over 2 (40 %), as `(size, one, two, over_two)`.
pub const CONDUIT_FILL_AREAS: [(f64, f64, f64, f64); 12] = [
    (15.0, 75.0, 44.0, 56.0),
    (20.0, 139.0, 82.0, 105.0),
    (25.0, 236.0, 138.0, 178.0),
    (32.0, 424.0, 248.0, 320.0),
    (40.0, 585.0, 342.0, 442.0),
    (50.0, 983.0, 575.0, 742.0),
    (65.0, 1410.0, 825.0, 1064.0),
    (80.0, 2200.0, 1287.0, 1660.0),
    (90.0, 2972.0, 1738.0, 2243.0),
    (100.0, 3852.0, 2253.0, 2907.0),
    (130.0, 6105.0, 3571.0, 4607.0),
    (150.0, 8752.0, 5119.0, 6605.0),
];

/// PEC 2017 Ch. 10 Table 10.1.1.5: approximate area (mm²) of THHN/THWN/THWN-2 conductors.
// shortcut: the table lists no THHN 175 or 400 mm², so those take the next larger listed
// size (200, 500); replace with the manufacturer's dimensions if heda ever records them (Note 10).
pub const THHN_CONDUCTOR_AREAS: [(f64, f64); 21] = [
    (2.0, 6.2),
    (3.5, 8.6),
    (5.5, 13.9),
    (8.0, 23.8),
    (14.0, 33.2),
    (22.0, 52.8),
    (30.0, 75.4),
    (38.0, 100.3),
    (50.0, 118.8),
    (60.0, 143.1),
    (80.0, 172.0),
    (100.0, 208.7),
    (125.0, 254.5),
    (150.0, 298.6),
    (175.0, 376.7),
    (200.0, 376.7),
    (250.0, 456.2),
    (325.0, 559.9),
    (375.0, 678.9),
    (400.0, 870.9),
    (500.0, 870.9),
];

/// PEC 2017 Ch. 10 Table 10.1.1.5: approximate area (mm²) of TW/TRW/THW/THHW conductors.
// shortcut: the table lists no 175 or 375 mm², so those take the next larger listed
// size (200, 400).
pub const TW_CONDUCTOR_AREAS: [(f64, f64); 21] = [
    (2.0, 9.1),
    (3.5, 11.9),
    (5.5, 15.9),
    (8.0, 28.3),
    (14.0, 46.6),
    (22.0, 62.2),
    (30.0, 86.6),
    (38.0, 122.7),
    (50.0, 143.1),
    (60.0, 169.7),
    (80.0, 201.1),
    (100.0, 240.5),
    (125.0, 295.6),
    (150.0, 339.8),
    (175.0, 426.4),
    (200.0, 426.4),
    (250.0, 510.7),
    (325.0, 629.0),
    (375.0, 749.9),
    (400.0, 749.9),
    (500.0, 951.2),
];

/// PEC 2017 Table 4.30.14.2: full-load current of single-phase AC motors, 230 V column
/// (A), as `(horsepower, amperes)`. The table's currents apply to 220–240 V systems.
pub const ONE_PHASE_MOTOR_FLC_230V: [(&str, f64); 12] = [
    ("1/6", 2.2),
    ("1/4", 2.9),
    ("1/3", 3.6),
    ("1/2", 4.9),
    ("3/4", 6.9),
    ("1", 8.0),
    ("1 1/2", 10.0),
    ("2", 12.0),
    ("3", 17.0),
    ("5", 28.0),
    ("7 1/2", 40.0),
    ("10", 50.0),
];

/// PEC 2017 Table 4.30.14.4: full-load current of three-phase induction (squirrel cage
/// and wound rotor) motors, 230 V column (A), for 220–240 V systems: a 230 V delta
/// supply. 250–500 HP are marked "Based on UL 508".
pub const THREE_PHASE_MOTOR_FLC_230V: [(&str, f64); 27] = [
    ("1/2", 2.2),
    ("3/4", 3.2),
    ("1", 4.2),
    ("1 1/2", 6.0),
    ("2", 6.8),
    ("3", 9.6),
    ("5", 15.2),
    ("7 1/2", 22.0),
    ("10", 28.0),
    ("15", 42.0),
    ("20", 54.0),
    ("25", 68.0),
    ("30", 80.0),
    ("40", 104.0),
    ("50", 130.0),
    ("60", 154.0),
    ("75", 192.0),
    ("100", 248.0),
    ("125", 312.0),
    ("150", 360.0),
    ("200", 480.0),
    ("250", 604.0),
    ("300", 722.0),
    ("350", 828.0),
    ("400", 954.0),
    ("450", 1030.0),
    ("500", 1180.0),
];

/// PEC 2017 Table 4.30.14.4, 400 V column (A): the line voltage of a 400Y/230 V system.
/// The table prints no 400 V value for 450 HP, so it has no row here.
pub const THREE_PHASE_MOTOR_FLC_400V: [(&str, f64); 26] = [
    ("1/2", 1.3),
    ("3/4", 1.8),
    ("1", 2.3),
    ("1 1/2", 3.3),
    ("2", 4.3),
    ("3", 6.1),
    ("5", 9.7),
    ("7 1/2", 14.0),
    ("10", 18.0),
    ("15", 27.0),
    ("20", 34.0),
    ("25", 44.0),
    ("30", 51.0),
    ("40", 66.0),
    ("50", 83.0),
    ("60", 103.0),
    ("75", 128.0),
    ("100", 165.0),
    ("125", 208.0),
    ("150", 240.0),
    ("200", 320.0),
    ("250", 403.0),
    ("300", 482.0),
    ("350", 560.0),
    ("400", 636.0),
    ("500", 786.0),
];

/// Looks a value up in a `(key, value)` table by exact key (`8.0` finds the `8.0` entry).
pub fn lookup<T>(table: &[(f64, T)], key: f64) -> Option<&T> {
    table
        .iter()
        .find(|(k, _)| *k == key)
        .map(|(_, value)| value)
}

/// PEC 2017 Table 6.90.2.1(A) (PDF p. 695, printed p. 671): voltage correction factors for
/// crystalline and multicrystalline silicon modules, for ambients below 25 °C, as
/// `(lowest °C of the row's range, factor)`, warmest first: the row "24 to 20" is `(20.0, 1.02)`.
pub const PV_VOLTAGE_CORRECTION: [(f64, f64); 13] = [
    (20.0, 1.02),
    (15.0, 1.04),
    (10.0, 1.06),
    (5.0, 1.08),
    (0.0, 1.10),
    (-5.0, 1.12),
    (-10.0, 1.14),
    (-15.0, 1.16),
    (-20.0, 1.18),
    (-25.0, 1.20),
    (-30.0, 1.21),
    (-35.0, 1.23),
    (-40.0, 1.25),
];
