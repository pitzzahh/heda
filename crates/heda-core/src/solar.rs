//! Solar PV systems, PEC 2017 Article 6.90, and their interconnection, Article 7.5: the
//! maximum dc voltage (6.90.2.1), circuit currents and the least conductor ampacity and
//! overcurrent device rating (6.90.2.2, 6.90.2.3), and the busbar of the panel the
//! inverter back-feeds (7.5.1.12(B)(2)(c)). The riser shows them.

use crate::model::phases::ONE_PHASE;
use crate::model::SolarPv;
use crate::num;
use crate::sizing::{
    adjustment_factor, corrected_ampacity, next_rating, termination_ampacity, Rating,
};
use crate::tables::{COPPER_AMPACITIES, PV_VOLTAGE_CORRECTION};

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

/// 6.90.2.5: PV systems operating at 80 V dc or more between any two conductors take a
/// listed PV arc-fault circuit interrupter (or equivalent listed components). Checked on
/// the 6.90.2.1 maximum voltage, the most the dc circuits can see.
pub fn needs_arc_fault_protection(max_voltage: f64) -> bool {
    round9(max_voltage) >= 80.0
}

/// 7.5.1.12(B)(2): 125 % of the inverter output current plus the rating of the device
/// protecting the busbar, the panel's main.
pub fn busbar_load(inverter_current: f64, main_at: f64) -> f64 {
    inverter_current * 1.25 + main_at
}

/// The inverter's breaker: the next standard rating of Table 2.40.1.6(A) at or above the
/// 125 % of 6.90.2.3(B)(1).
pub fn inverter_ocpd(inverter_current: f64) -> f64 {
    next_rating(round9(least_rating(inverter_current)))
}

/// A back-fed panel, for the busbar methods of 7.5.1.12(B)(2)(c).
#[derive(Debug, Clone, Copy)]
pub struct BackFed {
    pub inverter_current: f64,
    /// The rating of the device protecting the busbar, the panel's main.
    pub main_at: f64,
    pub busbar_rating: f64,
    /// The ratings of the panel's load devices: its branch and feeder breakers.
    pub load_ocpds: f64,
    pub center_fed: bool,
    pub dwelling: bool,
}

/// The first method of 7.5.1.12(B)(2)(c) a back-fed panel meets. Method (5), multiple-
/// ampacity busbars under engineering supervision, has no rule to check here.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Busbar {
    /// (1): the load is within the busbar ampacity, the inverter breaker anywhere.
    Anywhere,
    /// (2): within 120 % of it, with the inverter breaker at the end opposite the main.
    OppositeEnd,
    /// (4): a center-fed panelboard in a dwelling, within 120 %, the inverter breaker at
    /// either end but not both.
    EitherEnd,
    /// (3): every breaker but the main, load and supply, within the busbar ampacity, and
    /// the main within the busbar rating.
    SumOfDevices,
    Over,
}

pub fn busbar_method(panel: BackFed) -> Busbar {
    let busbar = panel.busbar_rating;
    let load = busbar_load(panel.inverter_current, panel.main_at);
    let within_120 = !exceeds(load, busbar * 1.2);
    let devices = panel.load_ocpds + inverter_ocpd(panel.inverter_current);
    if !exceeds(load, busbar) {
        Busbar::Anywhere
    } else if within_120 && !panel.center_fed {
        // A center-fed busbar has no end opposite its main.
        Busbar::OppositeEnd
    } else if within_120 && panel.dwelling {
        // shortcut: "dwellings" is read from the one- or two-family dwelling box, so a
        // multifamily dwelling misses (4); add a dwelling-occupancy input if one is asked for.
        Busbar::EitherEnd
    } else if !exceeds(devices, busbar) && !exceeds(panel.main_at, busbar) {
        Busbar::SumOfDevices
    } else {
        Busbar::Over
    }
}

/// The smallest copper conductor of Table 3.10.2.6(B)(16), 90 °C column (THHN, THWN-2,
/// heda's default insulation), for a circuit protected at `ocpd`: its termination
/// ampacity (1.10.1.14(C)) and its ampacity corrected for the ambient (Table
/// 3.10.2.6(B)(2)(a)) and for `conductors` current-carrying conductors in the raceway
/// (Table 3.10.2.6(B)(3)(a)) both at least the breaker rating. That meets 6.90.2.2(B)'s
/// 125 % before and 100 % after correction, since the breaker is at least 125 % of the
/// maximum current, and has the breaker protect the conductor (2.40.1.4) without the next
/// size up of 2.40.1.4(B), as heda sizes every circuit. None when no size does.
pub fn conductor_size(ocpd: f64, conductors: f64, ambient: f64) -> Option<f64> {
    let adjustment = adjustment_factor(conductors);
    COPPER_AMPACITIES
        .iter()
        .map(|(size, _)| *size)
        .find(|size| {
            termination_ampacity(*size, Rating::C90, ocpd) >= ocpd
                && corrected_ampacity(*size, Rating::C90, ambient, adjustment) >= ocpd
        })
}

/// The ambient the dc wiring is corrected for: the outdoor temperature, plus 33 °C for a
/// raceway or cable in sunlight less than 23 mm above the roof (3.10.2.6(B)(3)(c); its
/// XHHW-2 exception does not apply to heda's conductor types).
pub fn dc_ambient(pv: &SolarPv) -> Option<f64> {
    let adder = if pv.near_roof == Some(true) {
        33.0
    } else {
        0.0
    };
    pv.dc_ambient.map(|ambient| ambient + adder)
}

/// The inverter output conductor at the panel it connects to, in that panel's ambient: two
/// current-carrying conductors on a one-phase panel, three on a three-phase one (the
/// neutral of a wye circuit carries only the unbalanced current, 3.10.2.6(B)(5)(a)).
pub fn inverter_conductor_line(pv: &SolarPv, ambient: f64, phase: Option<&str>) -> Option<String> {
    let current = num::positive(pv.inverter_current)?;
    let conductors = if phase == Some(ONE_PHASE) { 2.0 } else { 3.0 };
    let size = conductor_size(inverter_ocpd(current), conductors, ambient);
    Some(format!("Inverter cond.: {}", size_text(size)))
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
        if needs_arc_fault_protection(voltage) {
            lines.push("PV dc arc-fault protection required".into());
        }
    }
    if let Some(isc) = num::positive(pv.module_isc) {
        let source = source_circuit_current(isc);
        let ambient = dc_ambient(pv);
        // shortcut: every string is taken to share one raceway (two conductors each), the
        // most adjustment; add a raceway count if designers ask for separate runs.
        let source_sizing = ambient.map(|ambient| (2.0 * strings, ambient));
        lines.extend(circuit_lines("PV source", source, source_sizing));
        if strings > 1.0 {
            // 6.90.2.2(A)(2): the sum of the parallel source circuits' maximum currents.
            let output_sizing = ambient.map(|ambient| (2.0, ambient));
            lines.extend(circuit_lines("PV output", source * strings, output_sizing));
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
            show(inverter_ocpd(current))
        ));
    }
    lines
}

/// 7.5.1.12(A): a source connected on the supply side of the service disconnecting means
/// (as 2.30.6.13(6) permits) keeps the ratings of all overcurrent devices on power
/// production sources within the rating of the service, here the inverter breaker within
/// the combined rating of the service disconnects (2.30.6.11). A standby generator is
/// transferred, not interconnected, so it does not count. `None` when the supply is not
/// the service.
pub fn supply_side_lines(pv: &SolarPv, service_rating: Option<f64>) -> Vec<String> {
    let Some(service) = service_rating else {
        return vec!["PV supply side: supply is not a service".into()];
    };
    let Some(current) = num::positive(pv.inverter_current) else {
        return vec!["PV on supply side of service".into()];
    };
    let ocpd = inverter_ocpd(current);
    let (sign, over) = if exceeds(ocpd, service) {
        (">", ", OVER")
    } else {
        ("≤", "")
    };
    vec![format!(
        "PV CB {} A {sign} {} A service{over}",
        show(ocpd),
        show(service)
    )]
}

/// 7.5.1.12(B)(2)(a): a connection to a feeder away from its far end, the panel end,
/// protects the feeder on the load side of it in one of two ways: (1) its ampacity at least
/// the primary source's breaker plus 125 % of the inverter current, or (2) a breaker on the
/// load side of the connection rated no more than that ampacity, which heda leaves to the
/// designer. (b)'s taps on such a feeder are not drawn on the riser, so not checked.
pub fn feeder_lines(pv: &SolarPv, feeder_at: f64, ampacity: Option<f64>) -> Vec<String> {
    let Some(current) = num::positive(pv.inverter_current) else {
        return vec!["PV on feeder".into()];
    };
    let Some(ampacity) = ampacity else {
        return vec!["PV on feeder, ampacity unknown".into()];
    };
    let need = busbar_load(current, feeder_at);
    let mut lines = vec![format!(
        "PV on feeder: {} A of {} A",
        up(need),
        show(ampacity)
    )];
    if exceeds(need, ampacity) {
        lines.push(format!("Needs load-side CB ≤ {} A", show(ampacity)));
    }
    lines
}

/// The lines of the panel the inverter back-feeds, from its main's rating and the ratings
/// of its load devices.
pub fn panel_lines(pv: &SolarPv, main_at: f64, load_ocpds: f64) -> Vec<String> {
    let Some(current) = num::positive(pv.inverter_current) else {
        return vec!["PV back-fed".into()];
    };
    let Some(busbar) = num::positive(pv.busbar_rating) else {
        return vec!["PV back-fed, busbar rating not set".into()];
    };
    let panel = BackFed {
        inverter_current: current,
        main_at,
        busbar_rating: busbar,
        load_ocpds,
        center_fed: pv.center_fed == Some(true),
        dwelling: pv.dwelling == Some(true),
    };
    let method = busbar_method(panel);
    let over = if method == Busbar::Over { ", OVER" } else { "" };
    let mut lines = vec![format!(
        "PV on busbar: {} A of {} A{over}",
        up(busbar_load(current, main_at)),
        show(busbar)
    )];
    match method {
        Busbar::OppositeEnd => lines.push("PV CB at end opposite main".into()),
        Busbar::EitherEnd => lines.push("PV CB at one end, not both".into()),
        Busbar::SumOfDevices => lines.push(format!(
            "CBs but main: {} A of {} A",
            show(load_ocpds + inverter_ocpd(current)),
            show(busbar)
        )),
        Busbar::Anywhere | Busbar::Over => {}
    }
    lines
}

fn circuit_lines(circuit: &str, max_current: f64, sizing: Option<(f64, f64)>) -> Vec<String> {
    let least = least_rating(max_current);
    let mut lines = vec![
        format!("{circuit} circuit: {} A", up(max_current)),
        format!("{circuit} cond./OCPD ≥ {} A", up(least)),
    ];
    if let Some((conductors, ambient)) = sizing {
        let ocpd = next_rating(round9(least));
        lines.push(format!(
            "{circuit}: {} A OCPD, {}",
            show(ocpd),
            size_text(conductor_size(ocpd, conductors, ambient))
        ));
    }
    lines
}

fn size_text(size: Option<f64>) -> String {
    size.map_or("no listed size".into(), |size| {
        format!("{} mm² Cu", show(size))
    })
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
