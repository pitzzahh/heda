//! The engine's command tables: every call from the app is a command name and JSON
//! arguments, answered with JSON (`dispatch`) or, for a file the engine writes, with its
//! bytes (`dispatch_file`). The Tauri backend and the WASM build used by tests both go
//! through here, so they cannot drift apart.

use crate::session::Session;
use serde::Deserialize;
use serde_json::Value;

pub fn dispatch(session: &mut Session, command: &str, args: Value) -> Result<Value, String> {
    match command {
        "open" => {
            let Open { project, nodes } = parse(args)?;
            to_json(session.open(project, nodes)?)
        }
        "open_file" => {
            let Open { project, nodes } = parse(args)?;
            to_json(session.open_file(project, nodes)?)
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
        "catalog" => to_json(crate::catalog::catalog()),
        "voltage_drops" => to_json(session.voltage_drops()),
        "short_circuits" => to_json(session.short_circuits()),
        "riser" => {
            let NodeId { node_id } = parse(args)?;
            to_json(session.riser(&node_id))
        }
        "balance_panel" => {
            let PanelId { panel_id } = parse(args)?;
            to_json(session.balance_panel(&panel_id))
        }
        _ => Err(format!("unknown command: {command}")),
    }
}

/// The files the engine writes, as their bytes. The app runs these on a copy of the
/// session, so a long build never holds up the `dispatch` calls behind it.
pub fn dispatch_file(session: &mut Session, command: &str, args: Value) -> Result<Vec<u8>, String> {
    match command {
        "sheet_set" => {
            let SheetSet { project_name, date } = parse(args)?;
            session.sheet_set(project_name, date)
        }
        "riser_svg" => {
            let NodeId { node_id } = parse(args)?;
            session.riser_svg(&node_id)
        }
        "workbook" => {
            let Workbook {
                kind,
                node_id,
                title,
            } = parse(args)?;
            session.workbook(kind, &node_id, title)
        }
        _ => Err(format!("unknown file command: {command}")),
    }
}

#[derive(Deserialize)]
struct Workbook {
    kind: crate::workbook::Kind,
    /// The schedule's top panel; the voltage drop table covers the whole project.
    node_id: String,
    title: String,
}

#[derive(Deserialize)]
struct SheetSet {
    project_name: String,
    /// Date drawn, PEC 2017 1.3.2.2(E).
    date: String,
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
struct PanelId {
    panel_id: String,
}

fn parse<T: for<'de> Deserialize<'de>>(args: Value) -> Result<T, String> {
    serde_json::from_value(args).map_err(|error| format!("invalid arguments: {error}"))
}

fn to_json<T: serde::Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}
