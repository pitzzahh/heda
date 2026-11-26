//! The stored project data, as the app's validators define it
//! (`NODE_DOC_SCHEMA` and `PROJECT_DOC_SCHEMA` in `src/lib/validators/db.ts`).
//!
//! Only the fields a calculation reads are modelled; the rest of a node stays
//! with the app. Numeric fields accept only JSON numbers: a stored value of
//! another type (only possible in a hand-edited file) reads as absent.

use serde::{Deserialize, Deserializer};
use serde_json::Value;

pub mod load_types {
    pub const LIGHTING_LOAD: &str = "lighting_load";
    pub const CONVENIENCE_OUTLET: &str = "convenience_outlet";
    pub const GENERAL_LIGHTING: &str = "general_lighting";
    pub const ONE_P_MOTOR_HORSE_POWER: &str = "one_phase_motor_horse_power";
    pub const ONE_P_MOTOR_RATED_CURRENT: &str = "one_phase_motor_rated_current";
    pub const HEATING_EQUIPMENT: &str = "heating_equipment";
    pub const THREE_P_MOTOR_HORSE_POWER: &str = "three_phase_motor_horse_power";
    pub const THREE_P_MOTOR_RATED_CURRENT: &str = "three_phase_motor_rated_current";
    pub const THREE_P_EQUIPMENT: &str = "three_phase_equipment";
}

pub mod phases {
    pub const ONE_PHASE: &str = "one_phase";
    pub const THREE_PHASE_WYE: &str = "three_phase_wye";
    pub const THREE_PHASE_DELTA: &str = "three_phase_delta";
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Node {
    pub id: String,
    #[serde(default)]
    pub node_type: String,
    #[serde(default, deserialize_with = "number")]
    pub circuit_number: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub overrided_at: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub overrided_egc_size: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub overrided_conduit_size: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub overrided_conductor_size: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub overrided_ampere_frames: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub overrided_length: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub overrided_z: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub conductor_sets: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub conductor_qty: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub length: Option<f64>,
    #[serde(default)]
    pub conduit_type: Option<String>,
    /// TW-Cu, THWN-Cu, THWN-2-Cu or THHN-Cu: the conductor's temperature rating.
    #[serde(default)]
    pub conductor_insulation: Option<String>,
    #[serde(default)]
    pub phase_assignment: Option<String>,
    /// Interrupting rating in kA as typed (`Number(kaic)` in the app).
    #[serde(default)]
    pub kaic: Option<Value>,
    #[serde(default)]
    pub is_at_used_as_currents_value: Option<bool>,
    #[serde(default)]
    pub panel_data: Option<PanelData>,
    #[serde(default)]
    pub load_data: Option<LoadData>,
    #[serde(default)]
    pub highest_unit_form: Option<HighestUnitForm>,
    #[serde(default)]
    pub parent_id: Option<String>,
    /// The documented selective coordination of this circuit's overcurrent device with
    /// its supply-side devices (PEC 2017 7.0.6.3 and the like): what the engineer based it
    /// on, e.g. a manufacturer's selectivity table.
    #[serde(default)]
    pub coordination_reference: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PanelData {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, deserialize_with = "number")]
    pub ambient_temperature: Option<f64>,
    #[serde(default)]
    pub phase: Option<String>,
    /// The system the panel and everything below it belongs to (`coordination::System`),
    /// where the PEC requires selective coordination; none for a normal panel.
    #[serde(default)]
    pub system: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct LoadData {
    #[serde(default)]
    pub load_description: Option<String>,
    #[serde(default, deserialize_with = "number")]
    pub ambient_temperature: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub quantity: Option<f64>,
    /// The per-unit value as typed (`Number(varies)` in the app).
    #[serde(default)]
    pub varies: Option<Value>,
    #[serde(default)]
    pub load_type: Option<String>,
    /// PEC 2017 2.10.2.3(A): whether the load runs 3 hours or more (Article 1.0,
    /// "Continuous Load"). Absent reads as continuous.
    #[serde(default, deserialize_with = "boolean")]
    pub continuous: Option<bool>,
    /// The dwelling-unit circuit of 2.10.1.11(C) this load is, if any: `small_appliance`,
    /// `laundry`, `bathroom` or `garage`, each a 20 A circuit.
    #[serde(default)]
    pub dwelling_circuit: Option<String>,
    /// A motor's nameplate full-load current, which sizes its overload relay
    /// (PEC 2017 4.30.3.2(A)(1)); the PEC tables size everything else (4.30.1.6(A)).
    #[serde(default, deserialize_with = "number")]
    pub nameplate_current: Option<f64>,
    /// Whether that nameplate marks a service factor of 1.15 or more, or a temperature
    /// rise of 40 °C or less (4.30.3.2(A)(1): 125 % instead of 115 %).
    #[serde(default, deserialize_with = "boolean")]
    pub nameplate_marked: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct HighestUnitForm {
    #[serde(default)]
    pub distribution_unit: Option<String>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default, deserialize_with = "number")]
    pub utility_sc_kva: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub transformer_kva: Option<f64>,
    #[serde(default, deserialize_with = "number")]
    pub transformer_z_percent: Option<f64>,
    /// Whether the supply is the utility service, so the panels it feeds hold the
    /// service disconnecting means (PEC 2017 2.30.6.10). Absent means yes.
    #[serde(default)]
    pub is_service: Option<bool>,
    /// Whether the project is a dwelling unit of at most 50 m², which heda cannot measure.
    /// Such a dwelling may run on one branch circuit (PEC 2017 2.10.1.11(C)(5)), and then
    /// its service disconnect takes 2.30.6.10(B)'s 20 A, not (A)'s 15 A. Absent means no.
    #[serde(default)]
    pub small_dwelling: Option<bool>,
    /// The optional standby generator's nameplate rating (PEC 2017 Article 7.2).
    #[serde(default, deserialize_with = "number")]
    pub generator_kva: Option<f64>,
    /// The panels the standby generator carries; a panel under one of them comes with it.
    #[serde(default)]
    pub standby_panels: Option<Vec<String>>,
    /// The optional interactive solar PV system (PEC 2017 Article 6.90, 7.5).
    #[serde(default)]
    pub solar_pv: Option<SolarPv>,
}

/// A solar PV system of identical strings of crystalline or multicrystalline silicon modules
/// feeding one interactive inverter, connected on the load side of a panel (PEC 2017
/// 7.5.1.12(B)). Values come from the module and inverter nameplates.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct SolarPv {
    /// A module's rated open-circuit voltage, V.
    #[serde(default, deserialize_with = "number")]
    pub module_voc: Option<f64>,
    /// A module's rated short-circuit current, A.
    #[serde(default, deserialize_with = "number")]
    pub module_isc: Option<f64>,
    /// Modules in series in each string (one PV source circuit).
    #[serde(default, deserialize_with = "number")]
    pub modules_per_string: Option<f64>,
    /// Strings in parallel on the PV output circuit.
    #[serde(default, deserialize_with = "number")]
    pub strings: Option<f64>,
    /// The module's maximum series fuse (overcurrent protection) rating from its listing, A
    /// (6.90.2.3(A) Exception (2)).
    #[serde(default, deserialize_with = "number")]
    pub module_max_ocpd: Option<f64>,
    /// Strings run together in one raceway, for the source-circuit adjustment; absent means
    /// all of them.
    #[serde(default, deserialize_with = "number")]
    pub strings_per_raceway: Option<f64>,
    /// The inverter's rated dc backfeed current into the array, A (6.90.2.3(A) Exception
    /// (1): "backfeed from inverters"); absent means none.
    #[serde(default, deserialize_with = "number")]
    pub inverter_backfeed: Option<f64>,
    /// The lowest expected ambient temperature, °C (6.90.2.1(A)(2)).
    #[serde(default, deserialize_with = "number")]
    pub lowest_ambient: Option<f64>,
    /// Where the array is (`solar::building`): on or in a one- or two-family dwelling, a
    /// multifamily dwelling, another building, or not on a building (6.90.2.1).
    #[serde(default)]
    pub building: Option<String>,
    /// The outdoor temperature where the dc wiring runs, °C, for its conductor sizes.
    #[serde(default, deserialize_with = "number")]
    pub dc_ambient: Option<f64>,
    /// Whether that wiring runs in sunlight less than 23 mm above the roof (3.10.2.6(B)(3)(c)).
    #[serde(default, deserialize_with = "boolean")]
    pub near_roof: Option<bool>,
    /// The inverter's continuous output current rating, A (6.90.2.2(A)(3)).
    #[serde(default, deserialize_with = "number")]
    pub inverter_current: Option<f64>,
    /// The ambient of the inverter output circuit, °C; absent takes the connected panel's.
    #[serde(default, deserialize_with = "number")]
    pub inverter_ambient: Option<f64>,
    /// The panel the inverter output connects to.
    #[serde(default)]
    pub panel: Option<String>,
    /// Whether the inverter output connects to that panel's feeder, away from the panel
    /// end, instead of to its busbar (7.5.1.12(B)(2)(a)).
    #[serde(default, deserialize_with = "boolean")]
    pub on_feeder: Option<bool>,
    /// Whether the inverter output connects on the supply side of the service
    /// disconnecting means instead (7.5.1.12(A), 2.30.6.13(6)).
    #[serde(default, deserialize_with = "boolean")]
    pub supply_side: Option<bool>,
    /// That panel's busbar rating, A (7.5.1.12(B)(2)(c)).
    #[serde(default, deserialize_with = "number")]
    pub busbar_rating: Option<f64>,
    /// Whether that panelboard is center-fed (7.5.1.12(B)(2)(c)(4)).
    #[serde(default, deserialize_with = "boolean")]
    pub center_fed: Option<bool>,
}

impl Node {
    /// The name a schedule heads this node with, and the FROM of the panels it feeds: a
    /// panelboard's name, or at the root the supply's distribution unit (Transformer,
    /// Generator, Utility, …) as the user named it.
    pub fn schedule_name(&self) -> Option<String> {
        self.panel_data
            .as_ref()
            .and_then(|p| p.name.clone())
            .or_else(|| self.highest_unit_form.as_ref()?.distribution_unit.clone())
    }

    pub fn load_type(&self) -> Option<&str> {
        self.load_data.as_ref()?.load_type.as_deref()
    }

    pub fn panel_phase(&self) -> Option<&str> {
        self.panel_data.as_ref()?.phase.as_deref()
    }
}

fn number<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<f64>, D::Error> {
    Ok(Value::deserialize(deserializer)?.as_f64())
}

fn boolean<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<bool>, D::Error> {
    Ok(Value::deserialize(deserializer)?.as_bool())
}
