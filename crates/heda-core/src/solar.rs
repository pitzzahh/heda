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
use crate::tables::{
    COPPER_AMPACITIES, FUSE_ONLY_RATINGS, PV_VOLTAGE_CORRECTION, STANDARD_AMPERE_RATINGS,
};

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

/// Where a PV array is, as `SolarPv.building` stores it.
pub mod building {
    pub const ONE_TWO_FAMILY: &str = "one_two_family";
    pub const MULTIFAMILY: &str = "multifamily";
    pub const OTHER: &str = "other";
    /// Not on or in a building (a ground-mounted array).
    pub const NONE: &str = "none";
}

/// 6.90.2.1: PV dc circuits on or in one- and two-family dwellings may reach 600 V, on or in
/// other buildings 1000 V; away from buildings, listed dc PV equipment rated 1500 V or less
/// is exempt from Parts 4.90.2 and 4.90.3 (over 1000 V), so 1500 V. None for no building.
pub fn voltage_limit(building: &str) -> Option<f64> {
    match building {
        building::ONE_TWO_FAMILY => Some(600.0),
        building::MULTIFAMILY | building::OTHER => Some(1000.0),
        building::NONE => Some(1500.0),
        _ => None,
    }
}

/// 7.5.1.12(B)(2)(c)(4) is for dwellings: one- and two-family and multifamily alike.
pub fn is_dwelling(building: Option<&str>) -> bool {
    matches!(
        building,
        Some(building::ONE_TWO_FAMILY | building::MULTIFAMILY)
    )
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
        Busbar::EitherEnd
    } else if inverter_ocpd(panel.inverter_current) > 0.0
        && !exceeds(devices, busbar)
        && !exceeds(panel.main_at, busbar)
    {
        Busbar::SumOfDevices
    } else {
        Busbar::Over
    }
}

/// The smallest standard overcurrent device rating at or above `at`, from Table
/// 2.40.1.6(A) and the fuse-only ratings 2.40.1.6(A) adds (1, 3, 6, 10, 601 A), and whether
/// only a fuse comes in it. None past the table.
pub fn standard_device_rating(at: f64) -> Option<(f64, bool)> {
    let at = round9(at);
    let breaker = STANDARD_AMPERE_RATINGS.into_iter().find(|r| at <= *r);
    let fuse = FUSE_ONLY_RATINGS.into_iter().find(|r| at <= *r);
    match (breaker, fuse) {
        (Some(b), Some(f)) if f < b => Some((f, true)),
        (Some(b), _) => Some((b, false)),
        (None, Some(f)) => Some((f, true)),
        (None, None) => None,
    }
}

/// 2.40.1.4: a device rated `ocpd` protects a conductor of `ampacity` when it is rated no
/// more, or, by (B), up to 800 A, when it is the next standard rating above it (a PV or
/// inverter circuit supplies no receptacles, (B)(1)).
pub fn protects(ocpd: f64, ampacity: f64) -> bool {
    ocpd <= ampacity
        || (ocpd <= 800.0 && standard_device_rating(ampacity).is_some_and(|(r, _)| ocpd <= r))
}

/// A PV or inverter circuit's conductor requirement (6.90.2.2(B)).
#[derive(Debug, Clone, Copy)]
pub struct PvConductor {
    /// 6.90.2.2(A): the circuit's maximum current.
    pub max_current: f64,
    /// The most current that can reach the conductor, which it must carry where no device
    /// protects it (6.90.2.3(A)); `max_current` for a circuit fed from one end.
    pub available: f64,
    /// The device protecting it, if one is required.
    pub ocpd: Option<f64>,
    /// Current-carrying conductors in the raceway (Table 3.10.2.6(B)(3)(a)).
    pub conductors: f64,
    pub ambient: f64,
}

/// The smallest copper conductor of Table 3.10.2.6(B)(16), 90 °C column (THHN, THWN-2,
/// heda's default insulation), that meets 6.90.2.2(B): (1) 125 % of the maximum current
/// before correction, at the termination ampacity of 1.10.1.14(C) (60 °C up to 100 A, else
/// 75 °C); (2) the maximum current after the ambient correction of Table 3.10.2.6(B)(2)(a)
/// and the adjustment of Table 3.10.2.6(B)(3)(a), and with no device, the most current
/// that can reach it (6.90.2.3(A)). With a device, that device protects the conductor at
/// its allowable ampacity, the lower of the two (2.40.1.4). None when no size does.
pub fn conductor_size(circuit: PvConductor) -> Option<f64> {
    let least = least_rating(circuit.max_current);
    // 1.10.1.14(C)(1): the circuit's rating picks the termination column.
    let rating = circuit.ocpd.unwrap_or(least);
    let adjustment = adjustment_factor(circuit.conductors);
    let carried = circuit.max_current.max(circuit.available);
    COPPER_AMPACITIES
        .iter()
        .map(|(size, _)| *size)
        .find(|size| {
            let termination = termination_ampacity(*size, Rating::C90, rating);
            let corrected = corrected_ampacity(*size, Rating::C90, circuit.ambient, adjustment);
            round9(termination) >= round9(least)
                && round9(corrected) >= round9(carried)
                && circuit
                    .ocpd
                    .is_none_or(|ocpd| protects(ocpd, round9(termination.min(corrected))))
        })
}

/// A source circuit's protection, 6.90.2.3(A): a string is current limited, so it needs a
/// device only where other sources can feed it: the other strings in parallel, each at its
/// 6.90.2.2(A)(1) maximum, and the inverter's backfeed. With none, Exception (1), no
/// device; else none under Exception (2) where that current is within the module's listed
/// maximum overcurrent rating (and the conductor, sized to carry it); else a device of at
/// least 125 % (6.90.2.3(B)(1)), at a standard rating.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SourceProtection {
    /// No device; the conductor carries this much from the other sources.
    NotRequired { available: f64 },
    /// A device of this rating; `fuse` when only a fuse comes in it.
    Device { rating: f64, fuse: bool },
    /// Needed, but this standard rating is over the module's listed maximum (or, with
    /// `None`, the current is past the standard ratings).
    Over { needed: Option<f64> },
}

pub fn source_protection(
    module_isc: f64,
    strings: f64,
    backfeed: f64,
    module_max_ocpd: Option<f64>,
) -> SourceProtection {
    let max = source_circuit_current(module_isc);
    let others = (strings - 1.0) * max + backfeed;
    if round9(others) <= 0.0 {
        return SourceProtection::NotRequired { available: max };
    }
    if module_max_ocpd.is_some_and(|limit| !exceeds(others, limit)) {
        return SourceProtection::NotRequired {
            available: max.max(others),
        };
    }
    match standard_device_rating(least_rating(max)) {
        Some((rating, _)) if module_max_ocpd.is_some_and(|limit| rating > limit) => {
            SourceProtection::Over {
                needed: Some(rating),
            }
        }
        Some((rating, fuse)) => SourceProtection::Device { rating, fuse },
        None => SourceProtection::Over { needed: None },
    }
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
/// neutral of a wye circuit carries only the unbalanced current, 3.10.2.6(B)(5)(a)). Its
/// breaker is required (7.5.1.12(B)(1)), so it protects the conductor (2.40.1.4).
pub fn inverter_conductor_line(pv: &SolarPv, ambient: f64, phase: Option<&str>) -> Option<String> {
    let current = num::positive(pv.inverter_current)?;
    let conductors = if phase == Some(ONE_PHASE) { 2.0 } else { 3.0 };
    let size = conductor_size(PvConductor {
        max_current: current,
        available: current,
        ocpd: Some(inverter_ocpd(current)).filter(|ocpd| *ocpd > 0.0),
        conductors,
        ambient,
    });
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
        let limit = pv.building.as_deref().and_then(voltage_limit);
        let over = match limit {
            Some(limit) if exceeds(voltage, limit) => format!(", OVER {} V", show(limit)),
            _ => String::new(),
        };
        lines.push(format!("PV max dc: {} V{over}", up(voltage)));
        if limit.is_none() {
            lines.push("PV dc limit: building not set".into());
        }
        if needs_arc_fault_protection(voltage) {
            lines.push("PV dc arc-fault protection required".into());
        }
    }
    if let Some(isc) = num::positive(pv.module_isc) {
        let ambient = dc_ambient(pv);
        let backfeed = num::positive(pv.inverter_backfeed).unwrap_or(0.0);
        let protection =
            source_protection(isc, strings, backfeed, num::positive(pv.module_max_ocpd));
        let source = source_circuit_current(isc);
        // Each string is two current-carrying conductors; those sharing a raceway adjust.
        let grouped = num::positive(pv.strings_per_raceway).map_or(strings, |n| n.min(strings));
        lines.extend(source_lines(
            source,
            protection,
            ambient.map(|a| (2.0 * grouped, a)),
        ));
        if strings > 1.0 {
            // 6.90.2.2(A)(2): the sum of the parallel source circuits' maximum currents. The
            // output circuit is fed by the array alone, plus any inverter backfeed, so a
            // conductor carrying the larger needs no device (6.90.2.3(A)).
            let output = source * strings;
            lines.extend(output_lines(output, backfeed, ambient));
        }
    }
    if let Some(current) = num::positive(pv.inverter_current) {
        // 6.90.2.2(A)(3): the inverter's continuous output current rating; its breaker is the
        // next standard rating of Table 2.40.1.6(A) at or above 125 %.
        let least = least_rating(current);
        lines.push(format!("Inverter output: {} A", up(current)));
        lines.push(match inverter_ocpd(current) {
            0.0 => format!("Inverter cond. ≥ {} A, OCPD OVER", up(least)),
            ocpd => format!("Inverter cond. ≥ {} A, OCPD {} A", up(least), show(ocpd)),
        });
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
    if ocpd == 0.0 {
        return vec!["PV CB past Table 2.40.1.6(A), OVER".into()];
    }
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
        dwelling: is_dwelling(pv.building.as_deref()),
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

fn source_lines(
    max_current: f64,
    protection: SourceProtection,
    sizing: Option<(f64, f64)>,
) -> Vec<String> {
    let least = up(least_rating(max_current));
    let mut lines = vec![format!("PV source circuit: {} A", up(max_current))];
    let (ocpd, available) = match protection {
        SourceProtection::NotRequired { available } => {
            lines.push(format!("PV source cond. ≥ {least} A, no OCPD"));
            (None, available)
        }
        SourceProtection::Device { rating, fuse } => {
            let device = if fuse { "fuse" } else { "OCPD" };
            lines.push(format!("PV source cond. ≥ {least} A"));
            lines.push(format!("PV source {device}: {} A", show(rating)));
            (Some(rating), max_current)
        }
        SourceProtection::Over { needed } => {
            lines.push(format!("PV source cond./OCPD ≥ {least} A"));
            lines.push(match needed {
                Some(rating) => format!("Module max fuse < {} A, OVER", show(rating)),
                None => "PV source OCPD past table, OVER".into(),
            });
            return lines;
        }
    };
    if let Some((conductors, ambient)) = sizing {
        let size = conductor_size(PvConductor {
            max_current,
            available,
            ocpd,
            conductors,
            ambient,
        });
        lines.push(format!("PV source cond.: {}", size_text(size)));
    }
    lines
}

fn output_lines(max_current: f64, backfeed: f64, ambient: Option<f64>) -> Vec<String> {
    let mut lines = vec![
        format!("PV output circuit: {} A", up(max_current)),
        format!(
            "PV output cond. ≥ {} A, no OCPD",
            up(least_rating(max_current))
        ),
    ];
    if let Some(ambient) = ambient {
        let size = conductor_size(PvConductor {
            max_current,
            available: backfeed,
            ocpd: None,
            conductors: 2.0,
            ambient,
        });
        lines.push(format!("PV output cond.: {}", size_text(size)));
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
