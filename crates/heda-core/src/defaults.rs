//! What a stored node holds when nothing set it: the fields every circuit starts
//! with, and the breaker poles and conductor count a circuit gets from its system.
//! The store is schemaless, so a file opened from disk is completed with these.

use crate::model::{load_types, phases};
use serde_json::{json, Map, Value};

/// The PEC 2017 sizing revision new files start at; older files migrate up to it once
/// (`migrate::pec_2017_sizing`).
pub const PEC_2017_REVISION: u32 = 2;

/// The fields of a new circuit: one set of two THHN copper conductors with a TW
/// copper EGC in PVC, on a 2-pole breaker of the unmarked 5 kA rating (PEC 2017
/// 2.40.7.4(C), `tables::UNMARKED_BREAKER_INTERRUPTING_RATING_KA`), sized from its
/// load rather than its trip.
pub fn node_defaults() -> Map<String, Value> {
    let Value::Object(defaults) = json!({
        "conductor_sets": 1,
        "conductor_qty": 2,
        "conductor_insulation": "THHN-Cu",
        "egc_insulation": "TW-Cu",
        "conduit_type": "PVC",
        "pole": "2",
        "kaic": "5",
        "is_at_used_as_currents_value": false
    }) else {
        unreachable!("a JSON object literal")
    };
    defaults
}

/// Fills the fields `node` lacks from `node_defaults`; a field it has, even null, stays.
pub fn with_node_defaults(node: &mut Value) {
    let Some(fields) = node.as_object_mut() else {
        return;
    };
    for (key, value) in node_defaults() {
        fields.entry(key).or_insert(value);
    }
}

/// A project's settings are always an object, so the app can read any of them.
pub fn with_project_defaults(project: &mut Value) {
    if let Some(fields) = project.as_object_mut() {
        if !fields.get("settings").is_some_and(Value::is_object) {
            fields.insert("settings".into(), json!({}));
        }
    }
}

/// Breaker poles and conductor count of a circuit like `node` under a system of
/// `system_phase`, where they differ from `node_defaults`. On 400Y/230 V:
/// - 3P-Y sub-panel: 3-pole, three phase conductors + neutral (PEC 2017 App. D Ex. D6 6.3–6.4, D8 8.6–8.7);
/// - three-phase load: 3-pole, three wires (D6 6.2 "3-wire", D9 9.2);
/// - single-phase 230 V load or panel: 1-pole, line + neutral (D6 6.2 "2-wire", D7 7.4).
///
/// On 230 V delta (3-wire, no neutral, D14/D15 "3 x 250 mm²"):
/// - delta sub-panel or three-phase load: 3-pole, three wires;
/// - single-phase load or panel: line to line, so 2-pole on two wires, a pole on each
///   ungrounded conductor that opens both together (PEC 2017 2.40.1.15(A), (B)).
///
/// Single-phase systems keep `node_defaults`.
pub fn circuit_defaults(node: &Value, system_phase: Option<&str>) -> Option<(&'static str, u32)> {
    let panel_phase = node["panel_data"]["phase"].as_str();
    let three_phase_load = matches!(
        node["load_data"]["load_type"].as_str(),
        Some(
            load_types::THREE_P_MOTOR_HORSE_POWER
                | load_types::THREE_P_MOTOR_RATED_CURRENT
                | load_types::THREE_P_EQUIPMENT
        )
    );
    match system_phase? {
        phases::THREE_PHASE_DELTA if panel_phase == Some(phases::THREE_PHASE_DELTA) => {
            Some(("3", 3))
        }
        phases::THREE_PHASE_DELTA if three_phase_load => Some(("3", 3)),
        phases::THREE_PHASE_DELTA => Some(("2", 2)),
        phases::THREE_PHASE_WYE if panel_phase == Some(phases::THREE_PHASE_WYE) => Some(("3", 4)),
        phases::THREE_PHASE_WYE if three_phase_load => Some(("3", 3)),
        phases::THREE_PHASE_WYE => Some(("1", 2)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fills_only_missing_fields() {
        let mut node = json!({ "id": "a", "pole": "3", "kaic": null });
        with_node_defaults(&mut node);
        assert_eq!(node["pole"], "3");
        assert_eq!(node["kaic"], Value::Null);
        assert_eq!(node["conductor_qty"], 2);
        assert_eq!(node["is_at_used_as_currents_value"], false);
    }

    #[test]
    fn project_settings_become_an_object() {
        let mut project = json!({ "id": "p", "settings": null });
        with_project_defaults(&mut project);
        assert_eq!(project["settings"], json!({}));
        let mut kept = json!({ "id": "p", "settings": { "a": 1 } });
        with_project_defaults(&mut kept);
        assert_eq!(kept["settings"], json!({ "a": 1 }));
    }

    #[test]
    fn poles_and_conductors_follow_the_system() {
        let wye_panel = json!({ "panel_data": { "phase": phases::THREE_PHASE_WYE } });
        let delta_panel = json!({ "panel_data": { "phase": phases::THREE_PHASE_DELTA } });
        let motor = json!({ "load_data": { "load_type": load_types::THREE_P_MOTOR_HORSE_POWER } });
        let lighting = json!({ "load_data": { "load_type": load_types::LIGHTING_LOAD } });
        let wye = Some(phases::THREE_PHASE_WYE);
        let delta = Some(phases::THREE_PHASE_DELTA);
        assert_eq!(circuit_defaults(&wye_panel, wye), Some(("3", 4)));
        assert_eq!(circuit_defaults(&motor, wye), Some(("3", 3)));
        assert_eq!(circuit_defaults(&lighting, wye), Some(("1", 2)));
        assert_eq!(circuit_defaults(&delta_panel, delta), Some(("3", 3)));
        assert_eq!(circuit_defaults(&motor, delta), Some(("3", 3)));
        assert_eq!(circuit_defaults(&lighting, delta), Some(("2", 2)));
        assert_eq!(circuit_defaults(&lighting, Some(phases::ONE_PHASE)), None);
        assert_eq!(circuit_defaults(&lighting, None), None);
    }
}
