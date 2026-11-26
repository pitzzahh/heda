//! Solar PV systems, PEC 2017 Article 6.90, and their interconnection, Article 7.5: the
//! maximum dc voltage (6.90.2.1), circuit currents and the least conductor ampacity and
//! overcurrent device rating (6.90.2.2, 6.90.2.3), and the busbar of the panel the
//! inverter back-feeds (7.5.1.12(B)(2)(c)). The riser shows them.

use crate::model::SolarPv;
use crate::num;
use crate::sizing::next_rating;
use crate::tables::PV_VOLTAGE_CORRECTION;

/// Table 6.90.2.1(A)'s factor for the lowest expected ambient: 1 from 25 °C up (the table
/// corrects below 25 °C only); a value between two rows takes the colder row. None below
/// −40 °C, past the table.
pub fn voltage_correction(lowest_ambient: f64) -> Option<f64> {
    if lowest_ambient >= 25.0 {
        return Some(1.0);
    }
    PV_VOLTAGE_CORRECTION
        .iter()
        .find(|(from, _)| lowest_ambient >= *from)
        .map(|(_, factor)| *factor)
}

/// 6.90.2.1(A)(2): the sum of the series modules' rated open-circuit voltages, corrected
/// for the lowest expected ambient by Table 6.90.2.1(A).
pub fn max_voltage(module_voc: f64, modules: f64, lowest_ambient: f64) -> Option<f64> {
    voltage_correction(lowest_ambient).map(|factor| module_voc * modules * factor)
}

/// 6.90.2.1: PV dc circuits on or in one- and two-family dwellings may reach 600 V, on
/// other buildings 1000 V.
pub fn voltage_limit(dwelling: bool) -> f64 {
    if dwelling {
        600.0
    } else {
        1000.0
    }
}

/// 6.90.2.2(A)(1)(1): a source circuit's maximum current, the parallel modules' rated
/// short-circuit current × 125 %; a string of series modules carries one module's.
pub fn source_circuit_current(module_isc: f64) -> f64 {
    module_isc * 1.25
}

/// 6.90.2.2(B)(1) and 6.90.2.3(B)(1): conductors carry, and overcurrent devices are rated,
/// not less than 125 % of the maximum current. On a source circuit that makes the FPN's
/// 156 % of the module short-circuit current.
pub fn least_rating(max_current: f64) -> f64 {
    max_current * 1.25
}

/// 7.5.1.12(B)(2): 125 % of the inverter output current plus the rating of the device
/// protecting the busbar, the panel's main.
pub fn busbar_load(inverter_current: f64, main_at: f64) -> f64 {
    inverter_current * 1.25 + main_at
}

/// Which busbar method of 7.5.1.12(B)(2)(c) a back-fed panel meets.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Busbar {
    /// (c)(1): the load is within the busbar ampacity, anywhere on it.
    Anywhere,
    /// (c)(2): within 120 % of it, with the inverter breaker at the end opposite the main.
    OppositeEnd,
    Over,
}

pub fn busbar_check(load: f64, busbar_rating: f64) -> Busbar {
    if exceeds(load, busbar_rating) {
        if exceeds(load, busbar_rating * 1.2) {
            Busbar::Over
        } else {
            Busbar::OppositeEnd
        }
    } else {
        Busbar::Anywhere
    }
}

/// The riser's service lines for the PV system: each line once its inputs are set.
pub fn service_lines(pv: &SolarPv) -> Vec<String> {
    let modules = num::positive(pv.modules_per_string);
    let strings = num::positive(pv.strings).unwrap_or(1.0);
    let mut lines = Vec::new();
    if let Some(modules) = modules {
        lines.push(format!(
            "Solar PV: {} × {} modules",
            show(strings),
            show(modules)
        ));
    }
    let voltage = num::positive(pv.module_voc)
        .zip(modules)
        .zip(pv.lowest_ambient)
        .and_then(|((voc, modules), ambient)| max_voltage(voc, modules, ambient));
    if let Some(voltage) = voltage {
        let limit = voltage_limit(pv.dwelling == Some(true));
        let over = if exceeds(voltage, limit) {
            format!(", OVER {} V", show(limit))
        } else {
            String::new()
        };
        lines.push(format!("PV max voltage: {} V{over}", up(voltage)));
    }
    if let Some(isc) = num::positive(pv.module_isc) {
        let source = source_circuit_current(isc);
        lines.extend(circuit_lines("PV source", source));
        if strings > 1.0 {
            // 6.90.2.2(A)(2): the sum of the parallel source circuits' maximum currents.
            lines.extend(circuit_lines("PV output", source * strings));
        }
    }
    if let Some(current) = num::positive(pv.inverter_current) {
        // 6.90.2.2(A)(3): the inverter's continuous output current rating; its breaker is the
        // next standard rating of Table 2.40.1.6(A) at or above 125 %.
        let least = least_rating(current);
        lines.push(format!("Inverter output: {} A", up(current)));
        lines.push(format!(
            "Inverter cond. ≥ {} A, OCPD {} A",
            up(least),
            show(next_rating(round9(least)))
        ));
    }
    lines
}

/// The lines of the panel the inverter back-feeds, from its main's rating.
pub fn panel_lines(pv: &SolarPv, main_at: f64) -> Vec<String> {
    let Some(current) = num::positive(pv.inverter_current) else {
        return vec!["PV back-fed".into()];
    };
    let Some(busbar) = num::positive(pv.busbar_rating) else {
        return vec!["PV back-fed, busbar rating not set".into()];
    };
    let load = busbar_load(current, main_at);
    let check = busbar_check(load, busbar);
    let over = if check == Busbar::Over { ", OVER" } else { "" };
    let mut lines = vec![format!(
        "PV on busbar: {} A of {} A{over}",
        up(load),
        show(busbar)
    )];
    if check == Busbar::OppositeEnd {
        lines.push("PV CB at end opposite main".into());
    }
    lines
}

fn circuit_lines(circuit: &str, max_current: f64) -> [String; 2] {
    [
        format!("{circuit} circuit: {} A", up(max_current)),
        format!("{circuit} cond./OCPD ≥ {} A", up(least_rating(max_current))),
    ]
}

/// Whether `value` is over `limit`, past float noise (1.25 × 80 is 100, not 100.000…1).
fn exceeds(value: f64, limit: f64) -> bool {
    round9(value) > limit
}

fn round9(value: f64) -> f64 {
    (value * 1e9).round() / 1e9
}

/// A least value to 0.01, rounded up, so the line never shows less than the PEC asks.
fn up(value: f64) -> String {
    show((round9(value) * 100.0).ceil() / 100.0)
}

fn show(value: f64) -> String {
    num::display(value)
}
