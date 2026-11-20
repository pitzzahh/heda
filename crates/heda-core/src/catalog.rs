//! The PEC 2017 values the app offers as choices: override steps (breaker ratings,
//! conductor, EGC and conduit sizes) and the motor horsepower pickers. The app reads
//! them once at startup (`catalog`), so the tables live only in `tables.rs`.

use crate::tables;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Catalog {
    /// Table 2.40.1.6(A), ascending (A).
    pub breaker_ratings: Vec<f64>,
    /// Table 3.10.2.6(B)(16), copper, ascending (mm²).
    pub conductor_sizes: Vec<f64>,
    /// Table 2.50.6.13, copper, ascending (mm²).
    pub egc_sizes: Vec<f64>,
    /// Table 10.1.1.4, ascending trade sizes (mm).
    pub conduit_sizes: Vec<f64>,
    pub motor_flc: MotorTables,
}

/// Full-load currents by horsepower, as `[horsepower, amperes]` in the table's order.
#[derive(Debug, Serialize)]
pub struct MotorTables {
    /// Table 4.30.14.2, 230 V.
    pub one_phase_230: Vec<(&'static str, f64)>,
    /// Table 4.30.14.4, 230 V (delta supplies).
    pub three_phase_230: Vec<(&'static str, f64)>,
    /// Table 4.30.14.4, 400 V (400Y/230 V supplies).
    pub three_phase_400: Vec<(&'static str, f64)>,
}

pub fn catalog() -> Catalog {
    let mut egc_sizes: Vec<f64> = tables::AMPERE_TRIP_TO_COPPER
        .iter()
        .filter_map(|(_, size)| *size)
        .collect();
    egc_sizes.sort_by(f64::total_cmp);
    Catalog {
        breaker_ratings: tables::STANDARD_AMPERE_RATINGS.to_vec(),
        conductor_sizes: tables::COPPER_AMPACITIES
            .iter()
            .map(|(size, _)| *size)
            .collect(),
        egc_sizes,
        conduit_sizes: tables::CONDUIT_FILL_AREAS.iter().map(|row| row.0).collect(),
        motor_flc: MotorTables {
            one_phase_230: tables::ONE_PHASE_MOTOR_FLC_230V.to_vec(),
            three_phase_230: tables::THREE_PHASE_MOTOR_FLC_230V.to_vec(),
            three_phase_400: tables::THREE_PHASE_MOTOR_FLC_400V.to_vec(),
        },
    }
}
