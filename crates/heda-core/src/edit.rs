//! The tree edits the app makes, planned on the stored documents: what to write and
//! what to remove. Planning is pure; `Session::commit` applies a plan as one
//! transaction, which is also what undo and redo replay.
//!
//! Every refusal is a message the app shows as it is. The supply rules are
//! `phases::supply_error` (PEC 2017 2.20.1.5(A)); a new circuit's poles and wires
//! are `defaults::circuit_defaults`.

use crate::defaults;
use crate::graph::Graph;
use crate::model::Node;
use crate::phases;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};

/// Upper bound on the nodes one copy may create. Past it the app runs out of memory and
/// loses unsaved work, so the copy is refused up front.
pub const MAX_COPY_NODES: usize = 100_000;

/// Bounds every walk up a parent chain: a tampered file may hold a loop.
const MAX_DEPTH: usize = 10_000;

/// What an edit writes: whole documents to store and ids to remove, plus what the
/// command answers besides them (a created id, a new circuit number).
#[derive(Debug, Default)]
pub struct Plan {
    pub put: Vec<Value>,
    pub remove: Vec<String>,
    pub result: Map<String, Value>,
}

/// The stored documents an edit is planned on.
#[derive(Clone, Copy)]
pub struct Tree<'a> {
    pub graph: &'a Graph,
    pub docs: &'a HashMap<String, Value>,
}

/// One node's change in `patch_nodes`: top-level fields to set (null removes one),
/// and fields to set inside an object field (`panel_data`, `load_data`,
/// `highest_unit_form`), keeping that object's other fields.
#[derive(Debug, Default, Deserialize)]
pub struct Patch {
    pub id: String,
    #[serde(default)]
    pub set: Map<String, Value>,
    #[serde(default)]
    pub merge: Map<String, Value>,
}

/// The fields a circuit form edits: its panel or load data, each also holding the
/// circuit number and length as the form typed them.
#[derive(Debug, Default, Deserialize)]
pub struct CircuitInput {
    #[serde(default)]
    pub panel_data: Option<Value>,
    #[serde(default)]
    pub load_data: Option<Value>,
}

impl CircuitInput {
    fn field(&self, name: &str) -> (Option<&Value>, Option<&Value>) {
        (
            self.load_data.as_ref().and_then(|data| data.get(name)),
            self.panel_data.as_ref().and_then(|data| data.get(name)),
        )
    }

    /// The load's field when it is set, else the panel's, as the forms always stored it.
    fn either(&self, name: &str) -> Option<Value> {
        match self.field(name) {
            (Some(load), _) if is_set(load) => Some(load.clone()),
            (_, panel) => panel.filter(|value| !value.is_null()).cloned(),
        }
    }
}

impl<'a> Tree<'a> {
    fn doc(&self, id: &str) -> Option<&'a Value> {
        self.docs.get(id)
    }

    fn node(&self, id: &str) -> Option<&'a Node> {
        self.graph.get(id)
    }

    /// The project's supply phase, read from the root above `id`.
    fn system_phase(&self, id: &str) -> Option<&'a str> {
        let mut current = self.node(id);
        for _ in 0..MAX_DEPTH {
            let node = current?;
            if node.node_type == "root" {
                return node.highest_unit_form.as_ref()?.phase.as_deref();
            }
            current = self.node(node.parent_id.as_deref()?);
        }
        None
    }

    /// Whether `id` sits somewhere below `ancestor`.
    fn is_below(&self, id: &str, ancestor: &str) -> bool {
        let mut current = self.node(id);
        for _ in 0..MAX_DEPTH {
            let Some(node) = current else { return false };
            match node.parent_id.as_deref() {
                Some(parent) if parent == ancestor => return true,
                Some(parent) => current = self.node(parent),
                None => return false,
            }
        }
        false
    }

    /// `id` and every node below it, each before its subtree, children in order; a
    /// node already in `seen` (a loop, or an earlier subtree) is skipped.
    fn subtree(&self, id: &str, seen: &mut HashSet<String>) -> Vec<&'a Node> {
        let mut subtree = Vec::new();
        let mut stack: Vec<&Node> = self.node(id).into_iter().collect();
        while let Some(node) = stack.pop() {
            if !seen.insert(node.id.clone()) {
                continue;
            }
            subtree.push(node);
            let children: Vec<&Node> = self.graph.children(&node.id).collect();
            stack.extend(children.into_iter().rev());
        }
        subtree
    }

    fn child_ids(&self, id: &str) -> Vec<Value> {
        self.doc(id)
            .and_then(|doc| doc["child_ids"].as_array())
            .cloned()
            .unwrap_or_default()
    }
}

/// A panel a circuit can be given to, as the parent pickers list it.
#[derive(Serialize)]
pub struct ParentChoice {
    pub id: String,
    pub name: String,
}

/// The panels (and the root) `excluded_id` could move under, in tree order: the ones
/// `move_error` would accept. With no such node, every panel.
pub fn parent_choices(tree: Tree, excluded_id: Option<&str>) -> Vec<ParentChoice> {
    let excluded = excluded_id.and_then(|id| tree.node(id));
    tree.graph
        .ids_in_order()
        .into_iter()
        .filter_map(|id| tree.node(id))
        .filter(|node| node.node_type == "panel" || node.node_type == "root")
        .filter(|node| {
            excluded.is_none_or(|excluded| move_error(tree, excluded, &node.id).is_none())
        })
        .filter_map(|node| {
            let name = match (&node.panel_data, &node.highest_unit_form) {
                (Some(panel), _) => panel.name.clone(),
                (None, Some(form)) => form.distribution_unit.clone(),
                (None, None) => return None,
            };
            Some(ParentChoice {
                id: node.id.clone(),
                name: name.unwrap_or_default(),
            })
        })
        .collect()
}

/// Why `node` cannot move under `parent_id`, else `None`.
fn move_error(tree: Tree, node: &Node, parent_id: &str) -> Option<&'static str> {
    let parent = tree
        .node(parent_id)
        .filter(|parent| parent.node_type != "load");
    let Some(parent) = parent else {
        return Some("Only a panel can supply a circuit.");
    };
    if parent.id == node.id || tree.is_below(&parent.id, &node.id) {
        return Some("A panel cannot move into itself or a panel below it.");
    }
    phases::supply_error(node, Some(parent), &[])
}

/// Sets `node[name]`, or removes it for `None`.
fn set_or_remove(node: &mut Value, name: &str, value: Option<Value>) {
    let Some(fields) = node.as_object_mut() else {
        return;
    };
    match value {
        Some(value) => fields.insert(name.into(), value),
        None => fields.remove(name),
    };
}

fn parse(doc: &Value) -> Result<Node, String> {
    Node::deserialize(doc).map_err(|error| format!("invalid node: {error}"))
}

/// The breaker poles and conductor count a circuit like `node` gets on `system_phase`.
fn pole_and_qty(node: &Value, system_phase: Option<&str>) -> (&'static str, u32) {
    defaults::circuit_defaults(node, system_phase).unwrap_or(("2", 2))
}

fn has_pole_and_qty(node: &Value, (pole, qty): (&str, u32)) -> bool {
    node["pole"] == pole && node["conductor_qty"].as_f64() == Some(f64::from(qty))
}

/// Applies `patches`, later ones for the same node on top of earlier ones. Unknown ids
/// are skipped. Nothing is written for a patch that changes nothing.
pub fn patch_nodes(tree: Tree, patches: Vec<Patch>) -> Plan {
    let mut order = Vec::new();
    let mut patched: HashMap<String, Value> = HashMap::new();
    for patch in patches {
        let Some(doc) = patched
            .get(&patch.id)
            .or_else(|| tree.doc(&patch.id))
            .cloned()
        else {
            continue;
        };
        let mut doc = doc;
        for (name, value) in patch.set {
            set_or_remove(
                &mut doc,
                &name,
                Some(value).filter(|value| !value.is_null()),
            );
        }
        for (group, fields) in patch.merge {
            let Value::Object(fields) = fields else {
                continue;
            };
            if !doc[&group].is_object() {
                doc[&group] = json!({});
            }
            for (name, value) in fields {
                set_or_remove(
                    &mut doc[&group],
                    &name,
                    Some(value).filter(|value| !value.is_null()),
                );
            }
        }
        if !patched.contains_key(&patch.id) {
            order.push(patch.id.clone());
        }
        patched.insert(patch.id, doc);
    }
    Plan {
        put: order
            .into_iter()
            .filter_map(|id| patched.remove(&id).filter(|doc| tree.doc(&id) != Some(doc)))
            .collect(),
        ..Plan::default()
    }
}

/// A new circuit under `parent_id`: a panel, or a load when `input` has load data. It
/// takes its system's poles and wires (`defaults::circuit_defaults`), then the node
/// defaults. Answers `id`.
pub fn add_node(
    tree: Tree,
    parent_id: &str,
    input: CircuitInput,
    id: String,
) -> Result<Plan, String> {
    let parent = tree
        .doc(parent_id)
        .ok_or_else(|| format!("Parent node with ID {parent_id} not found"))?;
    if tree.doc(&id).is_some() {
        return Err(format!("Node with ID {id} already exists"));
    }
    let node_type = if input.load_data.is_some() {
        "load"
    } else {
        "panel"
    };
    let mut node =
        json!({ "id": id, "node_type": node_type, "parent_id": parent_id, "child_ids": [] });
    set_or_remove(&mut node, "length", input.either("length"));
    let circuit_number = match input.field("circuit_number") {
        (Some(load), _) if !load.is_null() => load.clone(),
        (_, Some(panel)) if !panel.is_null() => panel.clone(),
        _ => json!(0),
    };
    node["circuit_number"] = circuit_number;
    set_or_remove(&mut node, "panel_data", input.panel_data);
    set_or_remove(&mut node, "load_data", input.load_data);
    if let Some(error) = phases::supply_error(&parse(&node)?, Some(&parse(parent)?), &[]) {
        return Err(error.into());
    }
    if let Some((pole, qty)) = defaults::circuit_defaults(&node, tree.system_phase(parent_id)) {
        node["pole"] = json!(pole);
        node["conductor_qty"] = json!(qty);
    }
    defaults::with_node_defaults(&mut node);

    let mut parent = parent.clone();
    let mut child_ids = tree.child_ids(parent_id);
    child_ids.push(json!(id));
    parent["child_ids"] = Value::Array(child_ids);
    Ok(Plan {
        put: vec![node, parent],
        result: Map::from_iter([("id".into(), json!(id))]),
        ..Plan::default()
    })
}

/// A circuit edited in its form, possibly under another panel. A new load type or
/// panel phase takes its own poles and wires unless the user had changed them; a
/// circuit that changes panel drops its phase pick (it means nothing on the new one).
pub fn update_node(
    tree: Tree,
    id: &str,
    parent_id: &str,
    input: CircuitInput,
) -> Result<Plan, String> {
    let existing = tree.doc(id).ok_or("Node not found")?;
    let existing_node = parse(existing)?;
    let moved = existing_node.parent_id.as_deref() != Some(parent_id);
    let mut next = existing.clone();
    set_or_remove(&mut next, "parent_id", Some(json!(parent_id)));
    set_or_remove(&mut next, "length", input.either("length"));
    set_or_remove(&mut next, "circuit_number", input.either("circuit_number"));
    set_or_remove(&mut next, "panel_data", input.panel_data);
    set_or_remove(&mut next, "load_data", input.load_data);

    let children: Vec<Node> = tree.graph.children(id).cloned().collect();
    let error = moved
        .then(|| move_error(tree, &existing_node, parent_id))
        .flatten()
        .or_else(|| {
            let next_node = parse(&next).ok()?;
            phases::supply_error(&next_node, tree.node(parent_id), &children)
        });
    if let Some(error) = error {
        return Err(error.into());
    }
    let system_phase = tree.system_phase(id);
    if has_pole_and_qty(existing, pole_and_qty(existing, system_phase)) {
        let (pole, qty) = pole_and_qty(&next, system_phase);
        next["pole"] = json!(pole);
        next["conductor_qty"] = json!(qty);
    }
    let mut plan = Plan::default();
    if moved {
        set_or_remove(&mut next, "phase_assignment", None);
        set_or_remove(&mut next, "coordination_reference", None);
        plan.put = reparent(tree, id, existing_node.parent_id.as_deref(), parent_id);
        // Every circuit below now has other supply-side devices: its documented selection no longer holds.
        plan.put.extend(
            tree.subtree(id, &mut HashSet::new())
                .into_iter()
                .filter(|node| node.id != id && node.coordination_reference.is_some())
                .filter_map(|node| tree.doc(&node.id).cloned())
                .map(|mut doc| {
                    set_or_remove(&mut doc, "coordination_reference", None);
                    doc
                }),
        );
    }
    plan.put.insert(0, next);
    Ok(plan)
}

/// The old and new parents of `id` with their child lists updated.
fn reparent(tree: Tree, id: &str, old_parent: Option<&str>, new_parent: &str) -> Vec<Value> {
    let without = |parent: &str| -> Vec<Value> {
        tree.child_ids(parent)
            .into_iter()
            .filter(|child| child != id)
            .collect()
    };
    let mut put = Vec::new();
    if let Some(old) = old_parent.filter(|old| *old != new_parent) {
        if let Some(doc) = tree.doc(old) {
            let mut doc = doc.clone();
            doc["child_ids"] = Value::Array(without(old));
            put.push(doc);
        }
    }
    if let Some(doc) = tree.doc(new_parent) {
        let mut doc = doc.clone();
        let mut child_ids = without(new_parent);
        child_ids.push(json!(id));
        doc["child_ids"] = Value::Array(child_ids);
        put.push(doc);
    }
    put
}

/// Moves a circuit under another panel (the sidebar's drag and drop). A circuit
/// number already used there is replaced with the next free one, answered as
/// `renumbered_to`.
pub fn move_node(tree: Tree, id: &str, parent_id: &str) -> Result<Plan, String> {
    let doc = tree.doc(id).ok_or("Circuit not found.")?;
    let node = parse(doc)?;
    if let Some(error) = move_error(tree, &node, parent_id) {
        return Err(error.into());
    }
    let used: Vec<f64> = tree
        .graph
        .children(parent_id)
        .filter(|child| child.id != id)
        .map(|child| child.circuit_number.unwrap_or(0.0))
        .collect();
    let mut moved = doc.clone();
    moved["parent_id"] = json!(parent_id);
    set_or_remove(&mut moved, "phase_assignment", None);
    let mut plan = Plan::default();
    if used.contains(&node.circuit_number.unwrap_or(0.0)) {
        let next = used.iter().fold(0.0_f64, |max, number| max.max(*number)) + 1.0;
        moved["circuit_number"] = json!(next);
        plan.result.insert("renumbered_to".into(), json!(next));
    }
    plan.put = reparent(tree, id, node.parent_id.as_deref(), parent_id);
    plan.put.insert(0, moved);
    Ok(plan)
}

/// Removes each node with its subtree. A node inside an earlier one's subtree goes
/// with it; parents that stay lose the removed ids from their child lists.
pub fn remove_nodes(tree: Tree, ids: &[String]) -> Plan {
    let mut seen = HashSet::new();
    let mut roots = Vec::new();
    let mut remove = Vec::new();
    for id in ids {
        let subtree = tree.subtree(id, &mut seen);
        if let Some(root) = subtree.first() {
            roots.push(*root);
        }
        remove.extend(subtree.into_iter().map(|node| node.id.clone()));
    }
    let mut parents: Vec<String> = Vec::new();
    let mut child_ids: HashMap<String, Vec<Value>> = HashMap::new();
    for root in roots {
        let Some(parent) = root
            .parent_id
            .as_deref()
            .filter(|parent| !seen.contains(*parent))
        else {
            continue;
        };
        let Some(list) = child_ids.get(parent).cloned().or_else(|| {
            tree.doc(parent)?;
            Some(tree.child_ids(parent))
        }) else {
            continue;
        };
        if !child_ids.contains_key(parent) {
            parents.push(parent.to_owned());
        }
        child_ids.insert(
            parent.to_owned(),
            list.into_iter()
                .filter(|child| child != root.id.as_str())
                .collect(),
        );
    }
    let mut put: Vec<Value> = parents
        .into_iter()
        .filter_map(|parent| {
            let mut doc = tree.doc(&parent)?.clone();
            doc["child_ids"] = Value::Array(child_ids.remove(&parent)?);
            Some(doc)
        })
        .collect();
    drop_standby_panels(tree, &seen, &mut put);
    Plan {
        put,
        remove,
        result: Map::new(),
    }
}

/// A removed panel leaves the supply's standby panels in the same step, so the riser no
/// longer counts it and the settings never keep an id they cannot show.
fn drop_standby_panels(tree: Tree, removed: &HashSet<String>, put: &mut Vec<Value>) {
    for (id, doc) in tree.docs {
        let Some(list) = doc["highest_unit_form"]["standby_panels"].as_array() else {
            continue;
        };
        let gone = |panel: &Value| panel.as_str().is_some_and(|panel| removed.contains(panel));
        if !list.iter().any(gone) {
            continue;
        }
        let kept: Vec<Value> = list.iter().filter(|panel| !gone(panel)).cloned().collect();
        let index = match put.iter().position(|doc| doc["id"] == id.as_str()) {
            Some(index) => index,
            None => {
                put.push(doc.clone());
                put.len() - 1
            }
        };
        put[index]["highest_unit_form"]["standby_panels"] = Value::Array(kept);
    }
}

/// `count` copies of `id` and its subtree, as siblings (or under `parent_id`). The
/// copies take the next free circuit numbers from the original's on; a copy drops its
/// phase pick, and the circuits inside it keep theirs. Answers the copies' `ids`.
pub fn copy_nodes(
    tree: Tree,
    id: &str,
    count: f64,
    parent_id: Option<&str>,
    mut new_id: impl FnMut() -> String,
) -> Result<Plan, String> {
    let original = tree.node(id).ok_or("Node not found")?;
    let count = if count.is_finite() {
        count.floor()
    } else {
        0.0
    };
    if count < 1.0 {
        return Ok(Plan::default());
    }
    let target = parent_id
        .filter(|parent| !parent.is_empty())
        .or(original.parent_id.as_deref());
    let target_node = target.and_then(|target| tree.node(target));
    if target.is_some() && target_node.is_none() {
        return Err("Target parent no longer exists".into());
    }
    if let Some(error) = phases::supply_error(original, target_node, &[]) {
        return Err(error.into());
    }
    let subtree = tree.subtree(id, &mut HashSet::new());
    if subtree.len() as f64 * count > MAX_COPY_NODES as f64 {
        return Err(format!(
            "Copy would create more than {MAX_COPY_NODES} nodes"
        ));
    }

    let mut used: HashSet<u64> = target
        .map(|target| {
            tree.graph
                .children(target)
                .filter_map(|child| child.circuit_number.map(f64::to_bits))
                .collect()
        })
        .unwrap_or_default();
    let mut next_number = original.circuit_number.unwrap_or(1.0);
    let mut plan = Plan::default();
    let mut root_ids = Vec::new();
    for _ in 0..count as usize {
        let ids: HashMap<&str, String> = subtree
            .iter()
            .map(|node| (node.id.as_str(), new_id()))
            .collect();
        for node in &subtree {
            let mut clone = tree.doc(&node.id).cloned().unwrap_or_default();
            let is_root = node.id == id;
            clone["id"] = json!(ids[node.id.as_str()]);
            // A documented selection was read for the original's supply-side devices only.
            set_or_remove(&mut clone, "coordination_reference", None);
            clone["child_ids"] = Value::Array(
                tree.graph
                    .children(&node.id)
                    .filter_map(|child| ids.get(child.id.as_str()).map(|id| json!(id)))
                    .collect(),
            );
            if is_root {
                set_or_remove(&mut clone, "parent_id", target.map(|target| json!(target)));
                set_or_remove(&mut clone, "phase_assignment", None);
                while used.contains(&next_number.to_bits()) {
                    next_number += 1.0;
                }
                used.insert(next_number.to_bits());
                clone["circuit_number"] = json!(next_number);
                next_number += 1.0;
                root_ids.push(json!(ids[node.id.as_str()]));
            } else if let Some(parent) = node.parent_id.as_deref() {
                clone["parent_id"] = json!(ids[parent]);
            }
            defaults::with_node_defaults(&mut clone);
            plan.put.push(clone);
        }
    }
    if let Some(target) = target.and_then(|target| tree.doc(target)) {
        let mut target = target.clone();
        let mut child_ids = target["child_ids"].as_array().cloned().unwrap_or_default();
        child_ids.extend(root_ids.iter().cloned());
        target["child_ids"] = Value::Array(child_ids);
        plan.put.push(target);
    }
    plan.result.insert("ids".into(), Value::Array(root_ids));
    Ok(plan)
}

/// Whether a stored value is set: true, a nonzero number, non-empty text, a list or object.
fn is_set(value: &Value) -> bool {
    match value {
        Value::Bool(flag) => *flag,
        Value::Null => false,
        Value::Number(number) => number.as_f64().is_some_and(|n| n != 0.0),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}
