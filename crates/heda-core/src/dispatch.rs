//! The engine's command table: every call from the app is a command name and JSON
//! arguments, answered with JSON. The Tauri backend and the WASM build used by
//! tests and browser development both go through here, so they cannot drift apart.

use crate::model::{Node, Settings};
use crate::phases::{self, BalanceCircuit};
use crate::session::Session;
use serde::Deserialize;
use serde_json::{json, Value};

pub fn dispatch(session: &mut Session, command: &str, args: Value) -> Result<Value, String> {
    match command {
        "open" => {
            let Open { nodes, settings } = parse(args)?;
            session.open(nodes, settings);
            Ok(Value::Null)
        }
        "upsert" => {
            let Upsert { nodes } = parse(args)?;
            session.upsert(nodes);
            Ok(Value::Null)
        }
        "remove" => {
            let Remove { ids } = parse(args)?;
            session.remove(&ids);
            Ok(Value::Null)
        }
        "set_settings" => {
            let SetSettings { settings } = parse(args)?;
            session.set_settings(settings);
            Ok(Value::Null)
        }
        "load_schedule" => {
            let ParentId { parent_id } = parse(args)?;
            let rows: Vec<Value> = session
                .load_schedule(&parent_id)
                .into_iter()
                .map(|(id, row)| with_id(&id, &row))
                .collect::<Result<_, _>>()?;
            Ok(Value::Array(rows))
        }
        "node_result" => {
            let Id { id } = parse(args)?;
            match session.node_result(&id) {
                Some(row) => with_id(&id, &row),
                None => Ok(Value::Null),
            }
        }
        "voltage_drops" => to_json(session.voltage_drops()),
        "short_circuits" => to_json(session.short_circuits()),
        "balanced_phases" => {
            let BalancedPhases { circuits } = parse(args)?;
            let circuits: Vec<BalanceCircuit> = circuits
                .iter()
                .map(|c| BalanceCircuit {
                    id: &c.id,
                    va: c.va,
                    phase: &c.phase,
                })
                .collect();
            Ok(Value::Array(
                phases::balanced_phase_assignments(&circuits)
                    .into_iter()
                    .map(|(id, phase)| json!([id, phase]))
                    .collect(),
            ))
        }
        _ => Err(format!("unknown command: {command}")),
    }
}

#[derive(Deserialize)]
struct Open {
    nodes: Vec<Node>,
    #[serde(default)]
    settings: Settings,
}

#[derive(Deserialize)]
struct Upsert {
    nodes: Vec<Node>,
}

#[derive(Deserialize)]
struct Remove {
    ids: Vec<String>,
}

#[derive(Deserialize)]
struct SetSettings {
    settings: Settings,
}

#[derive(Deserialize)]
struct ParentId {
    parent_id: String,
}

#[derive(Deserialize)]
struct Id {
    id: String,
}

#[derive(Deserialize)]
struct BalancedPhases {
    circuits: Vec<BalanceInput>,
}

#[derive(Deserialize)]
struct BalanceInput {
    id: String,
    va: f64,
    phase: String,
}

fn parse<T: for<'de> Deserialize<'de>>(args: Value) -> Result<T, String> {
    serde_json::from_value(args).map_err(|error| format!("invalid arguments: {error}"))
}

fn to_json<T: serde::Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}

fn with_id<T: serde::Serialize>(id: &str, row: &T) -> Result<Value, String> {
    let mut value = to_json(row)?;
    if let Value::Object(fields) = &mut value {
        fields.insert("id".to_owned(), Value::String(id.to_owned()));
    }
    Ok(value)
}
