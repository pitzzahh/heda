//! The engine's command table: every call from the app is a command name and JSON
//! arguments, answered with JSON. The Tauri backend and the WASM build used by
//! tests and browser development both go through here, so they cannot drift apart.

use crate::phases::{self, BalanceCircuit, Supply};
use crate::session::Session;
use serde::Deserialize;
use serde_json::{json, Value};

pub fn dispatch(session: &mut Session, command: &str, args: Value) -> Result<Value, String> {
    match command {
        "open" => {
            let Open { project, nodes } = parse(args)?;
            to_json(session.open(project, nodes)?)
        }
        "put" => {
            let Nodes { nodes } = parse(args)?;
            to_json(session.put(nodes)?)
        }
        "remove" => {
            let Remove { ids } = parse(args)?;
            to_json(session.remove(&ids))
        }
        "set_project" => {
            let SetProject { project } = parse(args)?;
            to_json(session.set_project(project))
        }
        "snapshot" => to_json(session.snapshot()),
        "voltage_drops" => to_json(session.voltage_drops()),
        "short_circuits" => to_json(session.short_circuits()),
        "riser" => {
            let NodeId { node_id } = parse(args)?;
            to_json(session.riser(&node_id))
        }
        "balanced_phases" => {
            let BalancedPhases { circuits, supply } = parse(args)?;
            let circuits: Vec<BalanceCircuit> = circuits
                .iter()
                .map(|c| BalanceCircuit {
                    id: &c.id,
                    va: c.va,
                    phase: &c.phase,
                    split: c.split,
                })
                .collect();
            Ok(Value::Array(
                phases::balanced_phase_assignments(&circuits, Supply::of(supply.as_deref()))
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
    #[serde(default)]
    project: Value,
    nodes: Vec<Value>,
}

#[derive(Deserialize)]
struct Nodes {
    nodes: Vec<Value>,
}

#[derive(Deserialize)]
struct NodeId {
    node_id: String,
}

#[derive(Deserialize)]
struct Remove {
    ids: Vec<String>,
}

#[derive(Deserialize)]
struct SetProject {
    project: Value,
}

#[derive(Deserialize)]
struct BalancedPhases {
    circuits: Vec<BalanceInput>,
    /// The panel's phase (`three_phase_delta` balances line pairs); absent is 3P-Y.
    #[serde(default)]
    supply: Option<String>,
}

#[derive(Deserialize)]
struct BalanceInput {
    id: String,
    va: f64,
    phase: String,
    /// A three-phase sub-panel's VA per phase or line pair.
    #[serde(default)]
    split: Option<[f64; 3]>,
}

fn parse<T: for<'de> Deserialize<'de>>(args: Value) -> Result<T, String> {
    serde_json::from_value(args).map_err(|error| format!("invalid arguments: {error}"))
}

fn to_json<T: serde::Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}
