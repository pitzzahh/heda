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

/// What a circuit's conductor is sized for: a load of some type, or a panel's main
/// (`'Main'` in the app). `Unspecified` is a node without a load type.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Sizing<'a> {
    Load(&'a str),
    Main,
    Unspecified,
}

impl<'a> Sizing<'a> {
    pub fn of(load_type: Option<&'a str>) -> Self {
        load_type.map_or(Sizing::Unspecified, Sizing::Load)
    }

    fn is_motor(self) -> bool {
        matches!(self, Sizing::Load(t) if MOTOR_LOAD_TYPES.contains(&t))
    }

    /// Whether the conductor is sized on the breaker rating rather than on 125 % of the current.
    fn sizes_on_trip(self) -> bool {
        match self {
            Sizing::Load(t) => COMMON_LOAD_TYPES.contains(&t),
            Sizing::Main => true,
            Sizing::Unspecified => false,
        }
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

/// Breaker multiplier on the load current. Motors: PEC 2017 Table 4.30.4.2, inverse
/// time breaker 250 %. Continuous loads: 125 % (2.10.2.3(A)); heating is continuous
/// per 4.24.1.3(B), and 125 % stays under the 150 % ceiling of 4.22.2.2(E)(3).
fn load_type_z_value(load_type: &str) -> Option<f64> {
    match load_type {
        LIGHTING_LOAD | CONVENIENCE_OUTLET | GENERAL_LIGHTING | HEATING_EQUIPMENT
        | THREE_P_EQUIPMENT => Some(1.25),
        ONE_P_MOTOR_HORSE_POWER
        | ONE_P_MOTOR_RATED_CURRENT
        | THREE_P_MOTOR_HORSE_POWER
        | THREE_P_MOTOR_RATED_CURRENT => Some(2.5),
        _ => None,
    }
}

/// Breaker rating (PEC 2017 Table 2.40.1.6(A)) for a current: the multiplier of the
/// load type (1.25 for a panel's main), at least 30 A for a panel and 20 A for any
/// load but lighting. 0 when the current is past the table.
pub fn ampere_trip(current: f64, load_type: Option<&str>) -> f64 {
    const PANEL_Z_VALUE: f64 = 1.25;
    // `load_type ? z[load_type] : 1.25`: the empty string counts as no load type.
    let load_type = load_type.filter(|t| !t.is_empty());
    let calculated_at = current
        * match load_type {
            Some(t) => load_type_z_value(t).unwrap_or(f64::NAN),
            None => PANEL_Z_VALUE,
        };
    if load_type.is_none() && calculated_at < 30.0 {
        return 30.0;
    }
    if load_type != Some(LIGHTING_LOAD)
        && load_type != Some(GENERAL_LIGHTING)
        && calculated_at < 20.0
    {
        return 20.0;
    }
    STANDARD_AMPERE_RATINGS
        .into_iter()
        .find(|rating| calculated_at <= *rating)
        .unwrap_or(0.0)
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
    pub is_dynamic: bool,
}

/// Conductor (mm²) whose PEC 2017 Table 3.10.2.6(B)(16) ampacity covers the adjusted
/// current; motors take at least 3.5 mm².
pub fn conductor_size(input: ConductorInput) -> f64 {
    let adjusted = adjusted_current(input);
    let ampacity = AMPACITY_RANGES
        .iter()
        .find(|(above, up_to, _)| adjusted > *above && adjusted <= *up_to)
        .map_or(AMPACITY_RANGES[0].2, |(_, _, ampacity)| *ampacity);
    let size = *lookup(&AMPACITY_TO_CONDUCTOR_SIZE, ampacity)
        .expect("every ampacity step has a conductor");
    if input.sizing.is_motor() && size <= 2.0 {
        3.5
    } else {
        size
    }
}

/// The current a conductor must carry after the ambient correction (PEC 2017 Table
/// 3.10.2.6(B)(2)(a)) and the more-than-three-conductors adjustment, per set.
pub fn adjusted_current(input: ConductorInput) -> f64 {
    let total_conductors = input.sets * input.qty;
    let correction = AMBIENT_TEMP_RATINGS
        .iter()
        .find(|(up_to, _)| input.ambient_temp <= *up_to)
        .map_or(1.0, |(_, factor)| *factor);
    let adjustment = adjustment_factor(total_conductors, input.is_dynamic);
    let output = if input.sizing.sizes_on_trip() {
        input.at
    } else {
        1.25 * input.current
    };
    output / (correction * adjustment * input.sets)
}

/// PEC 2017 Table 3.10.2.6(B)(3)(a): adjustment factors for more than three
/// current-carrying conductors, applied only when the project turns it on.
fn adjustment_factor(conductors: f64, is_dynamic: bool) -> f64 {
    if !is_dynamic {
        return 1.0;
    }
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
