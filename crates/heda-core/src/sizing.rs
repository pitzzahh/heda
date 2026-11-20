//! Breaker, conductor, conduit and EGC sizing of one circuit, ported from
//! `src/lib/utils/computations/index.ts`.

use crate::js;
use crate::model::load_types::*;
use crate::tables::*;
use serde::Serialize;

// PEC 2017 App. D Ex. D6 6.3 and D14 step 9.4 use 1.732 for √3.
pub const SQRT_3: f64 = 1.732;
// PEC 2017 2.20.1.5(A) and App. D Ex. D6/D8: 400Y/230 V, three-phase 4-wire.
pub const WYE_LINE_VOLTAGE: f64 = 400.0;
pub const WYE_PHASE_VOLTAGE: f64 = 230.0;
// PEC 2017 2.20.1.5(A) and App. D Ex. D14/D15: 230 V, three-phase 3-wire (delta).
pub const DELTA_LINE_VOLTAGE: f64 = 230.0;

/// Load types with the same VA formula, which also size their conductor on the breaker rating.
const COMMON_LOAD_TYPES: [&str; 5] = [
    LIGHTING_LOAD,
    CONVENIENCE_OUTLET,
    GENERAL_LIGHTING,
    HEATING_EQUIPMENT,
    THREE_P_EQUIPMENT,
];

/// Motor load types of either phase, for motor-specific sizing and fault contribution.
pub const MOTOR_LOAD_TYPES: [&str; 4] = [
    ONE_P_MOTOR_HORSE_POWER,
    ONE_P_MOTOR_RATED_CURRENT,
    THREE_P_MOTOR_HORSE_POWER,
    THREE_P_MOTOR_RATED_CURRENT,
];

/// Three-phase loads, line to line: 400 V on a 400Y/230 V system (PEC 2017 App. D
/// Ex. D6), 230 V on a delta one (D14); motors per Table 4.30.14.4 at that voltage.
pub const THREE_PHASE_LOAD_TYPES: [&str; 3] = [
    THREE_P_MOTOR_HORSE_POWER,
    THREE_P_MOTOR_RATED_CURRENT,
    THREE_P_EQUIPMENT,
];

/// What a circuit's conductor is sized for: a load of some type, a panel's main
/// (`'Main'` in the app), or a main that feeds motors (sized on its 4.30.2.4 load, which
/// `current` then holds). `Unspecified` is a node without a load type.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Sizing<'a> {
    Load(&'a str),
    Main,
    MotorFeeder,
    Unspecified,
}

impl<'a> Sizing<'a> {
    pub fn of(load_type: Option<&'a str>) -> Self {
        load_type.map_or(Sizing::Unspecified, Sizing::Load)
    }

    fn is_motor(self) -> bool {
        matches!(self, Sizing::Load(t) if is_motor(Some(t)))
    }

    /// Whether the conductor is sized on the breaker rating rather than on its load: every
    /// circuit but a motor's or a motor feeder's (Table 2.40.1.4(G) lets Article 4.30
    /// breakers exceed the conductor).
    fn sizes_on_trip(self) -> bool {
        !self.is_motor() && self != Sizing::MotorFeeder
    }
}

/// A conduit size, or why there is none (shown as text in the table).
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(untagged)]
pub enum Conduit {
    Size(f64),
    Text(&'static str),
}

/// An EGC size (mm²), or `"error"` past PEC 2017 Table 2.50.6.13.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Egc {
    Size(f64),
    Error,
}

impl Serialize for Egc {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Egc::Size(size) => serializer.serialize_f64(*size),
            Egc::Error => serializer.serialize_str("error"),
        }
    }
}

/// Volt-amperes of a load. Common loads are quantity × unit VA; three-phase motors
/// are 1.732 × line voltage × full-load current (PEC 2017 App. D Ex. D6 6.3, at
/// 400 V on wye and 230 V on delta); other types (single-phase motors) are
/// quantity × 230 V × current.
pub fn volt_ampere(load_type: Option<&str>, quantity: f64, varies: f64, line_voltage: f64) -> f64 {
    let is = |types: &[&str]| load_type.is_some_and(|t| types.contains(&t));
    if is(&COMMON_LOAD_TYPES) {
        quantity * varies
    } else if is(&[THREE_P_MOTOR_HORSE_POWER, THREE_P_MOTOR_RATED_CURRENT]) {
        quantity * SQRT_3 * line_voltage * varies
    } else {
        quantity * 230.0 * varies
    }
}

/// The dwelling-unit circuits PEC 2017 2.10.1.11(C)(1)–(4) requires at 20 A.
pub const DWELLING_CIRCUITS: [&str; 4] = ["small_appliance", "laundry", "bathroom", "garage"];

/// The largest overload relay rating for a motor, PEC 2017 4.30.3.2(A)(1) (and (B)(1) for
/// 1 hp or less, automatically started): 125 % of the nameplate full-load current when the
/// nameplate marks a service factor of 1.15 or more or a temperature rise of 40 °C or less,
/// else 115 %. Whole amperes, rounded down, as App. D Ex. D9 9.3 gives "39 Amperes
/// (Maximum)" for 31.6 A × 1.25.
pub fn overload_rating(nameplate_current: f64, marked: bool) -> f64 {
    let percent = if marked { 125.0 } else { 115.0 };
    // Rounded to 1e-9 first, so 20 A × 115 % is 23 A, not 22.999….
    ((nameplate_current * percent / 100.0 * 1e9).round() / 1e9).floor()
}

/// A transformer's rated secondary current: kVA × 1000 ÷ 230 V on a one-phase supply,
/// ÷ (line voltage × 1.732) on a three-phase one (400 V wye, 230 V delta).
pub fn transformer_current(kva: f64, phase: Option<&str>) -> Option<f64> {
    use crate::model::phases::*;
    let volts = match phase? {
        ONE_PHASE => WYE_PHASE_VOLTAGE,
        THREE_PHASE_WYE => WYE_LINE_VOLTAGE * SQRT_3,
        THREE_PHASE_DELTA => DELTA_LINE_VOLTAGE * SQRT_3,
        _ => return None,
    };
    Some(kva * 1000.0 / volts)
}

/// The largest secondary overcurrent protection a transformer of 1000 V or less allows,
/// PEC 2017 Table 4.50.1.3(B), primary and secondary protection: 125 % of the rated
/// secondary current from 9 A up, else 167 %, taken down to a standard rating (Note 1's
/// next higher rating applies to primary-only protection, not here). By Note 2 it caps
/// the total of up to six service disconnects. None below the smallest standard rating.
pub fn transformer_secondary_ocpd(current: f64) -> Option<f64> {
    let percent = if current >= 9.0 { 125.0 } else { 167.0 };
    let limit = (current * percent / 100.0 * 1e9).round() / 1e9;
    STANDARD_AMPERE_RATINGS
        .into_iter()
        .rev()
        .find(|rating| *rating <= limit)
}

/// Breaker multiplier on a branch circuit's load current; None for an unknown load type.
/// Motors: Table 4.30.4.2, inverse time breaker 250 %. Heating is continuous whatever the
/// load says (4.24.1.3(B)), and its 125 % stays under the 150 % of 4.22.2.2(E)(3). Any
/// other load: 125 % when continuous, 100 % when not (2.10.2.3(A)).
pub fn load_factor(load_type: Option<&str>, continuous: bool) -> Option<f64> {
    let by_duty = if continuous { 1.25 } else { 1.0 };
    match load_type.filter(|t| !t.is_empty()) {
        None => Some(by_duty),
        Some(HEATING_EQUIPMENT) => Some(1.25),
        Some(LIGHTING_LOAD | CONVENIENCE_OUTLET | GENERAL_LIGHTING | THREE_P_EQUIPMENT) => {
            Some(by_duty)
        }
        Some(t) if MOTOR_LOAD_TYPES.contains(&t) => Some(2.5),
        Some(_) => None,
    }
}

/// A branch circuit's breaker: its current times `load_factor`, up to the next standard
/// rating of PEC 2017 Table 2.40.1.6(A) (15 A at the least). A dwelling circuit of
/// 2.10.1.11(C) is 20 A: 0 when its load needs more, as when the current is past the table.
pub fn ampere_trip(
    current: f64,
    load_type: Option<&str>,
    continuous: bool,
    dwelling_circuit: bool,
) -> f64 {
    let calculated_at = current * load_factor(load_type, continuous).unwrap_or(f64::NAN);
    if dwelling_circuit {
        return if calculated_at <= 20.0 { 20.0 } else { 0.0 };
    }
    next_rating(calculated_at)
}

/// Whether a load type is a motor's.
pub fn is_motor(load_type: Option<&str>) -> bool {
    load_type.is_some_and(|t| MOTOR_LOAD_TYPES.contains(&t))
}

/// A panel main's breaker from its feeder `load` (2.15.1.3: the noncontinuous load plus
/// 125 % of the continuous, with 4.30.2.4's motor load) and the `ceiling` a motor
/// feeder may not exceed (4.30.5.2(A), 4.30.5.3: the other loads, plus the largest motor
/// branch breaker and the other motors' full-load currents); without motors the two are
/// equal. The largest standard rating between them (App. D Ex. D10: 131 A gives 125 A),
/// else the next one up from the load. 0 past the table.
pub fn feeder_trip(load: f64, ceiling: f64) -> f64 {
    STANDARD_AMPERE_RATINGS
        .into_iter()
        .rev()
        .find(|rating| *rating <= ceiling && *rating >= load)
        .unwrap_or_else(|| next_rating(load))
}

/// The smallest standard rating of Table 2.40.1.6(A) at or above `at`; 0 past the table.
fn next_rating(at: f64) -> f64 {
    STANDARD_AMPERE_RATINGS
        .into_iter()
        .find(|rating| at <= *rating)
        .unwrap_or(0.0)
}

/// A conductor's temperature rating: its column in PEC 2017 Table 3.10.2.6(B)(16) and
/// Table 3.10.2.6(B)(2)(a).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Rating {
    C60,
    C75,
    C90,
}

impl Rating {
    /// By the type columns of Table 3.10.2.6(B)(16): TW 60 °C, THWN 75 °C, THHN and THWN-2
    /// 90 °C. Anything else is heda's default conductor, THHN.
    pub fn of(insulation: Option<&str>) -> Self {
        match insulation {
            Some("TW-Cu") => Rating::C60,
            Some("THWN-Cu") => Rating::C75,
            _ => Rating::C90,
        }
    }

    fn column(self) -> usize {
        self as usize
    }
}

/// Inputs shared by the conductor sizing helpers.
#[derive(Debug, Clone, Copy)]
pub struct ConductorInput<'a> {
    pub sets: f64,
    pub qty: f64,
    pub ambient_temp: f64,
    pub sizing: Sizing<'a>,
    pub at: f64,
    pub current: f64,
    pub rating: Rating,
}

/// The smallest conductor (mm²) of PEC 2017 Table 3.10.2.6(B)(16) that meets both checks
/// of App. D Ex. D21, the terminations and the conditions of use, for the current each set
/// carries; -1 when none does (more sets are needed, or the insulation cannot take the
/// ambient). The table starts at 2.0 mm², the smallest conductor PEC 2017 Table 3.10.3.3(A)
/// allows, which 4.30.2.2(G) also sets for motors.
pub fn conductor_size(input: ConductorInput) -> f64 {
    let required = required_ampacity(input) / input.sets;
    let adjustment = adjustment_factor(current_carrying(input.sets, input.qty));
    let size = COPPER_AMPACITIES
        .iter()
        .map(|(size, _)| *size)
        .find(|size| {
            termination_ampacity(*size, input.rating, input.at) >= required
                && corrected_ampacity(*size, input.rating, input.ambient_temp, adjustment)
                    >= required
        });
    size.unwrap_or(-1.0)
}

/// The allowable ampacity of `size` as installed, every set together: the lower of the
/// termination limit (1.10.1.14(C)) and the corrected ampacity (3.10.2.6(B)), the two
/// checks `conductor_size` sizes on, to 0.01 A. PEC 2017 1.3.2.1(G)(3)(d) has the one-line
/// diagram show it over the design load current. `None` where either check has no value
/// (no listed size, a TW conductor over 100 A, an ambient past the table).
pub fn allowable_ampacity(size: f64, input: ConductorInput) -> Option<f64> {
    let adjustment = adjustment_factor(current_carrying(input.sets, input.qty));
    let termination = termination_ampacity(size, input.rating, input.at);
    let corrected = corrected_ampacity(size, input.rating, input.ambient_temp, adjustment);
    let total = termination.min(corrected) * input.sets;
    (termination.is_finite() && corrected.is_finite() && total > 0.0)
        .then(|| js::round_js(total, 2))
}

/// The ampacity the conductor needs: 125 % of a motor's full-load current (4.30.2.2), a
/// motor feeder's 4.30.2.4 load, else the breaker rating, which then protects the conductor
/// at its ampacity (2.40.1.4).
fn required_ampacity(input: ConductorInput) -> f64 {
    match input.sizing {
        Sizing::MotorFeeder => input.current,
        sizing if sizing.sizes_on_trip() => input.at,
        _ => 1.25 * input.current,
    }
}

/// PEC 2017 3.10.2.6(B): the Table 3.10.2.6(B)(16) ampacity at the conductor's own
/// temperature rating, times the ambient correction of Table 3.10.2.6(B)(2)(a) and the
/// adjustment of Table 3.10.2.6(B)(3)(a); NaN where the table has no factor.
pub fn corrected_ampacity(size: f64, rating: Rating, ambient_temp: f64, adjustment: f64) -> f64 {
    let correction = AMBIENT_CORRECTION_FACTORS
        .iter()
        .find(|(up_to, _)| ambient_temp <= *up_to)
        .map_or(f64::NAN, |(_, factors)| factors[rating.column()]);
    ampacity(size, rating) * correction * adjustment
}

/// PEC 2017 1.10.1.14(C)(1): what the terminations allow, uncorrected, which 3.10.2.6(B)
/// caps the corrected ampacity at. Circuits of 100 A or less take the 60 °C column, (a);
/// over 100 A the 75 °C one, (b), which admits only conductors rated 75 °C or more, so a
/// TW conductor fits no size there (NaN).
pub fn termination_ampacity(size: f64, rating: Rating, at: f64) -> f64 {
    if at <= 100.0 {
        ampacity(size, Rating::C60)
    } else if rating >= Rating::C75 {
        ampacity(size, Rating::C75)
    } else {
        f64::NAN
    }
}

/// Table 3.10.2.6(B)(16) ampacity of a listed size; NaN for any other.
fn ampacity(size: f64, rating: Rating) -> f64 {
    lookup(&COPPER_AMPACITIES, size).map_or(f64::NAN, |columns| columns[rating.column()])
}

/// Current-carrying conductors in the raceway, which holds every set of the circuit (the
/// one conduit heda sizes for it): not the neutral of a three-phase 4-wire wye circuit,
/// which carries only the unbalanced current (PEC 2017 3.10.2.6(B)(5)(a)), nor the EGC,
/// which is not in `qty` ((B)(6)).
// shortcut: a wye neutral whose load is mostly nonlinear counts ((B)(5)(c)); heda has no
// input for it, so add it if the load form ever records harmonic loads.
fn current_carrying(sets: f64, qty: f64) -> f64 {
    sets * if qty == 4.0 { 3.0 } else { qty }
}

/// PEC 2017 Table 3.10.2.6(B)(3)(a) (p. 172): adjustment factors for more than three
/// current-carrying conductors in a raceway.
fn adjustment_factor(conductors: f64) -> f64 {
    if conductors <= 3.0 {
        1.0
    } else if conductors <= 6.0 {
        0.8
    } else if conductors <= 9.0 {
        0.7
    } else if conductors <= 20.0 {
        0.5
    } else if conductors <= 30.0 {
        0.45
    } else if conductors <= 40.0 {
        0.4
    } else {
        0.35
    }
}

/// PEC 2017 Table 2.50.6.13 EGC for a breaker rating; -1 when there is none.
pub fn egc_size(at: f64) -> Egc {
    if at <= 0.0 {
        return Egc::Size(-1.0);
    }
    match AMPERE_TRIP_TO_COPPER.iter().find(|(above, _)| at > *above) {
        Some((_, Some(size))) => Egc::Size(*size),
        Some((_, None)) => Egc::Error,
        None => Egc::Size(-1.0),
    }
}

/// Smallest conduit whose PEC 2017 Table 10.1.1.1 fill area holds the THHN
/// conductors; -1 when none of Table 10.1.1.4's sizes does.
pub fn conduit_size(conductor_size: f64, total_conductors: f64) -> Conduit {
    if conductor_size > 530.0 {
        return Conduit::Text("Error");
    }
    let Some(area) = lookup(&THHN_CONDUCTOR_AREAS, conductor_size) else {
        return Conduit::Text("Invalid conductor size");
    };
    CONDUIT_FILL_AREAS
        .iter()
        .find(|(_, one, two, over_two)| {
            let fill = if total_conductors == 1.0 {
                *one
            } else if total_conductors == 2.0 {
                *two
            } else {
                *over_two
            };
            max_conductors_in_area(fill, *area) >= total_conductors
        })
        .map_or(Conduit::Size(-1.0), |(size, ..)| Conduit::Size(*size))
}

/// PEC 2017 Ch. 10 Note 7: a fractional count of 0.8 or more rounds up to the next whole conductor.
pub fn max_conductors_in_area(fill_area: f64, conductor_area: f64) -> f64 {
    // + 0.2 lifts x.8 and above to the next whole number; 1e-9 absorbs float error (48 / 10 → 4.7999…).
    (fill_area / conductor_area + 0.2 + 1e-9).floor()
}

/// `x || computed` for the stored overrides, which keep a computed value when 0 or absent.
pub fn overridden(value: Option<f64>) -> Option<f64> {
    value.filter(|value| js::truthy(*value))
}
