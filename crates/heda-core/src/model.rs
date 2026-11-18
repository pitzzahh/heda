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
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PanelData {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, deserialize_with = "number")]
    pub ambient_temperature: Option<f64>,
    #[serde(default)]
    pub phase: Option<String>,
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
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub is_adjustment_factor_dynamic: Option<bool>,
}

impl Node {
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
