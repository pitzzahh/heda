//! The engine's command tables: every call from the app is a command name and JSON
//! arguments, answered with JSON (`dispatch`) or, for a file the engine writes, with its
//! bytes (`dispatch_file`). The Tauri backend and the WASM build used by tests both go
//! through here, so they cannot drift apart.

use crate::edit;
use crate::legacy_v1;
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
        "coordination" => to_json(session.coordination()),
        "bill_of_materials" => {
            let NodeId { node_id } = parse(args)?;
            to_json(session.bill_of_materials(&node_id)?)
        }
        "patch_nodes" => {
            let PatchNodes { patches } = parse(args)?;
            let plan = edit::patch_nodes(session.tree(), patches);
            to_json(session.commit(plan)?)
        }
        "add_node" => {
            let AddNode { parent_id, node } = parse(args)?;
            let plan = edit::add_node(session.tree(), &parent_id, node, new_id())?;
            to_json(session.commit(plan)?)
        }
        "update_node" => {
            let UpdateNode {
                id,
                parent_id,
                node,
            } = parse(args)?;
            let plan = edit::update_node(session.tree(), &id, &parent_id, node)?;
            to_json(session.commit(plan)?)
        }
        "move_node" => {
            let MoveNode { id, parent_id } = parse(args)?;
            let plan = edit::move_node(session.tree(), &id, &parent_id)?;
            to_json(session.commit(plan)?)
        }
        "remove_nodes" => {
            let Remove { ids } = parse(args)?;
            let plan = edit::remove_nodes(session.tree(), &ids);
            to_json(session.commit(plan)?)
        }
        "copy_nodes" => {
            let CopyNodes {
                id,
                count,
                parent_id,
            } = parse(args)?;
            let plan = edit::copy_nodes(session.tree(), &id, count, parent_id.as_deref(), new_id)?;
            to_json(session.commit(plan)?)
        }
        "undo" => to_json(session.undo()?),
        "redo" => to_json(session.redo()?),
        "balance_panel" => {
            let PanelId { panel_id } = parse(args)?;
            to_json(session.balance_panel(&panel_id))
        }
        "parent_choices" => {
            let ParentChoices { excluded_id } = parse(args)?;
            to_json(edit::parent_choices(session.tree(), excluded_id.as_deref()))
        }
        "is_legacy_v1" => {
            let Raw { raw } = parse(args)?;
            to_json(legacy_v1::is_envelope(&raw))
        }
        "legacy_v1_decrypt" => {
            let LegacyV1 {
                raw,
                passphrase,
                salts,
            } = parse(args)?;
            // A refusal is an answer, not an error, so the app keeps its code.
            to_json(match legacy_v1::decrypt(&raw, &passphrase, &salts) {
                Ok(plain) => serde_json::json!({ "text": plain.text, "salt": plain.salt }),
                Err(refusal) => {
                    serde_json::json!({ "error": refusal.code, "message": refusal.message })
                }
            })
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
struct ParentChoices {
    excluded_id: Option<String>,
}

#[derive(Deserialize)]
struct Raw {
    raw: String,
}

#[derive(Deserialize)]
struct LegacyV1 {
    raw: String,
    passphrase: String,
    salts: Vec<String>,
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
struct PatchNodes {
    patches: Vec<edit::Patch>,
}

#[derive(Deserialize)]
struct AddNode {
    parent_id: String,
    node: edit::CircuitInput,
}

#[derive(Deserialize)]
struct UpdateNode {
    id: String,
    parent_id: String,
    node: edit::CircuitInput,
}

#[derive(Deserialize)]
struct MoveNode {
    id: String,
    parent_id: String,
}

#[derive(Deserialize)]
struct CopyNodes {
    id: String,
    count: f64,
    /// Where the copies go; absent copies them next to the original.
    #[serde(default)]
    parent_id: Option<String>,
}

/// A random id for a node an edit creates, like `crypto.randomUUID()`.
fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
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
