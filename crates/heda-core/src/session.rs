//! The open project: the stored documents, as the app wrote them, and the
//! calculation cache. Rust owns this state; the app keeps a mirror for its sync
//! reads and sends every write here.
//!
//! A row depends on the node, its descendants and the phase of the panel feeding it,
//! so a write recomputes the written nodes, their ancestors (old and new parents)
//! and their direct children, plus the service disconnect, the first panel on the
//! supply (its 2.30.6.10 minimum rating depends on every circuit below it); everything
//! else stays cached. Each write answers with the rows it recomputed.

use crate::graph::Graph;
use crate::load_schedule::{load_row, LoadRow};
use crate::model::Node;
use crate::riser::{layout_riser, riser_tree, RiserLayout};
use crate::sheet_set::{self, SheetSetInputs};
use crate::short_circuit::{short_circuits, InterruptingRatingStatus, ShortCircuitRow};
use crate::voltage_drop::{voltage_drops, VoltageDropRow};
use crate::workbook::{self, Kind};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

/// `Clone` so a long build (the sheet set) can run on a copy without holding the app's lock.
#[derive(Debug, Default, Clone)]
pub struct Session {
    graph: Graph,
    /// Every node exactly as stored, fields the engine does not read included.
    docs: HashMap<String, Value>,
    project: Value,
    load_rows: HashMap<String, LoadRow>,
    history: History,
}

/// How many edits undo reaches back; each holds whole documents, so older ones go.
pub const MAX_HISTORY: usize = 100;

/// One committed edit: every node it touched, as it was before and after (`None`
/// where the node did not exist). Undo stores `before` again, redo `after`.
#[derive(Debug, Clone)]
struct Change {
    before: Vec<(String, Option<Value>)>,
    after: Vec<(String, Option<Value>)>,
}

/// The undo and redo stacks of the open project.
#[derive(Debug, Default)]
struct History {
    undo: Vec<Change>,
    redo: Vec<Change>,
}

impl Clone for History {
    /// A copy of the session only builds a file and never undoes, so it takes no
    /// history (which can hold up to `MAX_HISTORY` whole subtrees).
    fn clone(&self) -> Self {
        History::default()
    }
}

/// How many edits undo and redo can step through.
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize)]
pub struct HistoryDepth {
    pub undo: usize,
    pub redo: usize,
}

/// What an edit, undo or redo stored: the documents written and the ids removed, the
/// rows it recomputed, the history depth after it, and what the command adds (a
/// created id, a new circuit number).
#[derive(Debug, Default, Serialize)]
pub struct Edited {
    pub nodes: Vec<Value>,
    pub removed: Vec<String>,
    #[serde(flatten)]
    pub computed: Computed,
    pub history: HistoryDepth,
    #[serde(flatten)]
    pub result: serde_json::Map<String, Value>,
}

/// Recomputed load-schedule rows by node id: what a node shows in its parent's
/// load schedule, its sidebar entry and its page header.
#[derive(Debug, Default, Serialize)]
pub struct Computed {
    pub rows: HashMap<String, LoadRow>,
}

/// The whole session, for a webview that reloads while the app keeps running.
#[derive(Debug, Serialize)]
pub struct Snapshot {
    pub project: Value,
    pub nodes: Vec<Value>,
    #[serde(flatten)]
    pub computed: Computed,
    pub history: HistoryDepth,
}

/// A file opened as the session (`open_file`): its documents as migrated, and
/// whether they predate the current PEC 2017 revision.
#[derive(Debug, Serialize)]
pub struct OpenedFile {
    #[serde(flatten)]
    pub snapshot: Snapshot,
    pub pec_2017_migrated: bool,
}

impl Session {
    /// Opens a file's project and nodes as the session, migrated to the current
    /// format first (`migrate::migrate_file`). A rejected file leaves the session empty.
    pub fn open_file(&mut self, project: Value, nodes: Vec<Value>) -> Result<OpenedFile, String> {
        let opened = crate::migrate::migrate_file(project, nodes).and_then(|migrated| {
            let computed = self.open(migrated.project, migrated.nodes)?;
            Ok((computed, migrated.pec_2017_migrated))
        });
        let (computed, pec_2017_migrated) = opened.inspect_err(|_| *self = Session::default())?;
        Ok(OpenedFile {
            snapshot: Snapshot {
                project: self.project.clone(),
                nodes: self.nodes_in_order(),
                computed,
                history: HistoryDepth::default(),
            },
            pec_2017_migrated,
        })
    }

    /// Replaces the open project (`project` is null and `nodes` empty to close it).
    pub fn open(&mut self, project: Value, nodes: Vec<Value>) -> Result<Computed, String> {
        let parsed = parse_nodes(&nodes)?;
        *self = Session {
            project,
            graph: Graph::new(parsed),
            docs: nodes.into_iter().map(|doc| (id_of(&doc), doc)).collect(),
            ..Session::default()
        };
        Ok(self.compute_all())
    }

    /// Replaces the project document; no result reads it, so nothing recomputes.
    pub fn set_project(&mut self, project: Value) -> Computed {
        self.project = project;
        Computed::default()
    }

    /// Inserts or replaces nodes.
    pub fn put(&mut self, nodes: Vec<Value>) -> Result<Computed, String> {
        let parsed = parse_nodes(&nodes)?;
        let ids: Vec<String> = parsed.iter().map(|node| node.id.clone()).collect();
        // The old chain (a move leaves its old parents stale), then the new one.
        let mut touched: Vec<String> = ids
            .iter()
            .flat_map(|id| self.graph.ancestors_and_self(id))
            .collect();
        self.graph.upsert(parsed);
        for doc in nodes {
            self.docs.insert(id_of(&doc), doc);
        }
        touched.extend(ids.iter().flat_map(|id| self.graph.ancestors_and_self(id)));
        // A panel's phase sets its circuits' voltage, phase and VA.
        let children: Vec<String> = ids
            .iter()
            .flat_map(|id| self.graph.children(id).map(|child| child.id.clone()))
            .collect();
        touched.extend(children);
        touched.extend(self.service_panels());
        Ok(self.recompute(touched))
    }

    pub fn remove(&mut self, ids: &[String]) -> Computed {
        let mut touched: Vec<String> = ids
            .iter()
            .flat_map(|id| self.graph.ancestors_and_self(id))
            .collect();
        self.graph.remove(ids);
        touched.extend(self.service_panels());
        for id in ids {
            self.docs.remove(id);
        }
        self.recompute(touched)
    }

    pub fn snapshot(&mut self) -> Snapshot {
        Snapshot {
            project: self.project.clone(),
            nodes: self.nodes_in_order(),
            computed: self.compute_all(),
            history: self.history_depth(),
        }
    }

    /// Every stored node, in the graph's order.
    fn nodes_in_order(&self) -> Vec<Value> {
        self.graph
            .ids_in_order()
            .into_iter()
            .filter_map(|id| self.docs.get(id).cloned())
            .collect()
    }

    /// The stored documents an edit is planned on (`edit.rs`).
    pub fn tree(&self) -> crate::edit::Tree<'_> {
        crate::edit::Tree {
            graph: &self.graph,
            docs: &self.docs,
        }
    }

    /// Stores `plan` as one edit undo can take back. A plan that changes nothing is
    /// not recorded, and leaves the redo stack as it is.
    pub fn commit(&mut self, plan: crate::edit::Plan) -> Result<Edited, String> {
        let crate::edit::Plan {
            put,
            remove,
            result,
        } = plan;
        let after: Vec<(String, Option<Value>)> = remove
            .iter()
            .map(|id| (id.clone(), None))
            .chain(put.into_iter().map(|doc| (id_of(&doc), Some(doc))))
            .filter(|(id, doc)| self.docs.get(id) != doc.as_ref())
            .collect();
        if after.is_empty() {
            return Ok(Edited {
                history: self.history_depth(),
                result,
                ..Edited::default()
            });
        }
        let before = after
            .iter()
            .map(|(id, _)| (id.clone(), self.docs.get(id).cloned()))
            .collect();
        let mut edited = self.store(after.clone())?;
        self.history.undo.push(Change { before, after });
        if self.history.undo.len() > MAX_HISTORY {
            self.history.undo.remove(0);
        }
        self.history.redo.clear();
        edited.history = self.history_depth();
        edited.result = result;
        Ok(edited)
    }

    /// Takes back the last edit; nothing to undo stores nothing.
    pub fn undo(&mut self) -> Result<Edited, String> {
        let Some(change) = self.history.undo.pop() else {
            return Ok(Edited {
                history: self.history_depth(),
                ..Edited::default()
            });
        };
        let edited = self.store(change.before.clone());
        self.settle(edited, change, true)
    }

    /// Makes the last undone edit again.
    pub fn redo(&mut self) -> Result<Edited, String> {
        let Some(change) = self.history.redo.pop() else {
            return Ok(Edited {
                history: self.history_depth(),
                ..Edited::default()
            });
        };
        let edited = self.store(change.after.clone());
        self.settle(edited, change, false)
    }

    /// Moves `change` to the other stack once it is stored; a failed store puts it back.
    fn settle(
        &mut self,
        edited: Result<Edited, String>,
        change: Change,
        undone: bool,
    ) -> Result<Edited, String> {
        let (from, to) = if undone {
            (&mut self.history.undo, &mut self.history.redo)
        } else {
            (&mut self.history.redo, &mut self.history.undo)
        };
        match edited {
            Ok(mut edited) => {
                to.push(change);
                edited.history = self.history_depth();
                Ok(edited)
            }
            Err(error) => {
                from.push(change);
                Err(error)
            }
        }
    }

    /// Writes each node as given: a document to store, or `None` to remove it.
    fn store(&mut self, states: Vec<(String, Option<Value>)>) -> Result<Edited, String> {
        let mut removed = Vec::new();
        let mut nodes = Vec::new();
        for (id, doc) in states {
            match doc {
                Some(doc) => nodes.push(doc),
                None if self.docs.contains_key(&id) => removed.push(id),
                None => {}
            }
        }
        // Checked before anything is written, so a bad document leaves the session as it was.
        parse_nodes(&nodes)?;
        let mut computed = self.remove(&removed);
        computed.rows.extend(self.put(nodes.clone())?.rows);
        for id in &removed {
            computed.rows.remove(id);
        }
        Ok(Edited {
            nodes,
            removed,
            computed,
            ..Edited::default()
        })
    }

    pub fn history_depth(&self) -> HistoryDepth {
        HistoryDepth {
            undo: self.history.undo.len(),
            redo: self.history.redo.len(),
        }
    }

    /// The first panel on the supply: as the service disconnect, its minimum rating
    /// (PEC 2017 2.30.6.10) depends on every circuit below it, and the combined rating
    /// of 2.30.6.11 on its siblings'.
    fn service_panels(&self) -> Vec<String> {
        self.graph
            .root()
            .and_then(|root| {
                self.graph
                    .children(&root.id)
                    .find(|child| child.panel_data.is_some())
            })
            .map(|panel| vec![panel.id.clone()])
            .unwrap_or_default()
    }

    pub fn graph(&self) -> &Graph {
        &self.graph
    }

    pub fn voltage_drops(&mut self) -> Vec<VoltageDropRow> {
        voltage_drops(&self.graph, &mut self.load_rows)
    }

    pub fn short_circuits(&mut self) -> Vec<ShortCircuitRow> {
        short_circuits(&self.graph, &mut self.load_rows)
    }

    /// Phases (or line pairs) for the single-phase circuits of the three-phase panel
    /// `panel_id` (or the root), from their computed rows (`phases::balanced_phase_assignments`).
    pub fn balance_panel(&mut self, panel_id: &str) -> Vec<(String, &'static str)> {
        let (supply, rows) =
            crate::load_schedule::balance_circuits(&self.graph, panel_id, &mut self.load_rows);
        let circuits: Vec<_> = rows
            .iter()
            .map(|(id, row)| crate::load_schedule::balance_circuit(id, row, supply))
            .collect();
        crate::phases::balanced_phase_assignments(&circuits, supply)
            .into_iter()
            .map(|(id, phase)| (id.to_owned(), phase))
            .collect()
    }

    /// The riser diagram from `id` down; from the project root it starts at the service.
    pub fn riser(&mut self, id: &str) -> Option<RiserLayout> {
        let tree = riser_tree(&self.graph, &self.docs, &mut self.load_rows, id)?;
        let node = tree.circuit.node;
        let source =
            (node.node_type == "root").then(|| node.highest_unit_form.clone().unwrap_or_default());
        Some(layout_riser(&tree, source.as_ref()))
    }

    /// The overcurrent device pairs the PEC requires to be selectively coordinated
    /// (`coordination`).
    pub fn coordination(&mut self) -> Vec<crate::coordination::Pair> {
        let faults = self.short_circuits();
        crate::coordination::coordination(&self.graph, &mut self.load_rows, &faults)
    }

    /// The bill of materials of `id` and everything below it (`bom`).
    pub fn bill_of_materials(&mut self, id: &str) -> Result<crate::bom::Bom, String> {
        crate::bom::bill_of_materials(&self.graph, &self.docs, &mut self.load_rows, id)
    }

    /// The riser diagram from `id` down as an SVG file (`riser_svg`).
    pub fn riser_svg(&mut self, id: &str) -> Result<Vec<u8>, String> {
        let layout = self.riser(id).ok_or("Node not found")?;
        Ok(crate::riser_svg::riser_svg(&layout).into_bytes())
    }

    /// The permit sheet set PDF of the whole project (`sheet_set::build`), with the title
    /// block stored on the project.
    pub fn sheet_set(&mut self, project_name: String, date: String) -> Result<Vec<u8>, String> {
        sheet_set::build(self.sheet_set_inputs(project_name, date)?)
    }

    /// An Excel export (`workbook::layout`), as an xlsx file.
    pub fn workbook(
        &mut self,
        kind: Kind,
        node_id: &str,
        title: String,
    ) -> Result<Vec<u8>, String> {
        workbook::render(&self.workbook_layout(kind, node_id, title)?)
    }

    /// An Excel export's sheets and cells, before they are written.
    pub fn workbook_layout(
        &mut self,
        kind: Kind,
        node_id: &str,
        title: String,
    ) -> Result<workbook::Layout, String> {
        let voltage_drops = match kind {
            Kind::VoltageDrop => self.voltage_drops(),
            Kind::LoadSchedule => Vec::new(),
        };
        let input = workbook::Inputs {
            graph: &self.graph,
            docs: &self.docs,
            rows: &mut self.load_rows,
        };
        workbook::layout(input, kind, node_id, title, &voltage_drops)
    }

    /// Each sheet's title and texts (`sheet_set::sheet_texts`).
    pub fn sheet_set_texts(
        &mut self,
        project_name: String,
        date: String,
    ) -> Result<Vec<(String, Vec<String>)>, String> {
        Ok(sheet_set::sheet_texts(
            self.sheet_set_inputs(project_name, date)?,
        ))
    }

    fn sheet_set_inputs(
        &mut self,
        project_name: String,
        date: String,
    ) -> Result<SheetSetInputs<'_>, String> {
        let root_id = self.graph.root().ok_or("no project is open")?.id.clone();
        let riser = self.riser(&root_id).unwrap_or_default();
        let voltage_drops = self.voltage_drops();
        let mut short_circuits = self.short_circuits();
        // Without a utility and transformer there is nothing to compute; no sheet of dashes.
        if short_circuits
            .iter()
            .all(|row| row.status == InterruptingRatingStatus::NoSource)
        {
            short_circuits.clear();
        }
        let title_block: sheet_set::TitleBlock = self
            .project
            .get("title_block")
            .and_then(|block| serde_json::from_value(block.clone()).ok())
            .unwrap_or_default();
        if title_block.sheet_size.as_deref() == Some("A3") {
            // As the app totals it: the rows under the root, a NaN row counting as 0.
            let total_va: f64 = self
                .graph
                .children(&root_id)
                .map(|child| load_row(&self.graph, child, &mut self.load_rows).va)
                .filter(|va| !va.is_nan())
                .sum();
            if total_va > sheet_set::A3_SHEET_MAX_VA {
                return Err(format!(
                    "A3 sheets are only for a dwelling unit of at most 3680 VA (PEC 2017 1.3.1.1(C)); this project is {} VA. Pick a larger sheet.",
                    crate::num::display(total_va)
                ));
            }
        }
        Ok(SheetSetInputs {
            graph: &self.graph,
            docs: &self.docs,
            rows: &mut self.load_rows,
            voltage_drops,
            short_circuits,
            riser,
            title_block,
            project_name,
            date,
        })
    }

    fn compute_all(&mut self) -> Computed {
        let ids: Vec<String> = self
            .graph
            .ids_in_order()
            .into_iter()
            .map(str::to_owned)
            .collect();
        self.compute(&ids)
    }

    /// Drops the cached results of `touched` and computes them again (the ones still present).
    fn recompute(&mut self, touched: Vec<String>) -> Computed {
        let mut seen = HashSet::new();
        let touched: Vec<String> = touched
            .into_iter()
            .filter(|id| seen.insert(id.clone()))
            .collect();
        for id in &touched {
            self.load_rows.remove(id);
        }
        self.compute(&touched)
    }

    fn compute(&mut self, ids: &[String]) -> Computed {
        let mut computed = Computed::default();
        for id in ids {
            let Some(node) = self.graph.get(id) else {
                continue;
            };
            let row = load_row(&self.graph, node, &mut self.load_rows);
            computed.rows.insert(id.clone(), row);
        }
        computed
    }
}

fn parse_nodes(docs: &[Value]) -> Result<Vec<Node>, String> {
    docs.iter()
        .map(|doc| Node::deserialize(doc).map_err(|error| format!("invalid node: {error}")))
        .collect()
}

fn id_of(doc: &Value) -> String {
    doc["id"].as_str().unwrap_or_default().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn load(id: &str, parent: &str, circuit: f64, va: f64) -> Value {
        json!({
            "id": id, "node_type": "load", "parent_id": parent, "circuit_number": circuit,
            "conductor_sets": 1, "conductor_qty": 2,
            "load_data": { "load_type": "convenience_outlet", "quantity": 1, "varies": va }
        })
    }

    fn panel(id: &str, parent: &str, circuit: f64) -> Value {
        json!({
            "id": id, "node_type": "panel", "parent_id": parent, "circuit_number": circuit,
            "conductor_sets": 1, "conductor_qty": 2,
            "panel_data": { "name": id, "phase": "one_phase", "ambient_temperature": 30 }
        })
    }

    fn keys(map: &HashMap<String, LoadRow>) -> Vec<&str> {
        let mut keys: Vec<&str> = map.keys().map(String::as_str).collect();
        keys.sort_unstable();
        keys
    }

    fn session() -> Session {
        let mut session = Session::default();
        let root = json!({ "id": "root", "node_type": "root" });
        let nodes = vec![
            root,
            panel("a", "root", 1.0),
            panel("b", "root", 2.0),
            load("x", "a", 1.0, 180.0),
        ];
        let all = session.open(json!({}), nodes).unwrap();
        assert_eq!(keys(&all.rows), ["a", "b", "root", "x"]);
        session
    }

    #[test]
    fn a_write_recomputes_the_node_and_its_ancestors_only() {
        let mut session = session();
        let changed = session.put(vec![load("x", "a", 1.0, 360.0)]).unwrap();
        assert_eq!(keys(&changed.rows), ["a", "root", "x"]);
        assert_eq!(changed.rows["a"].va, 360.0);
    }

    #[test]
    fn a_move_recomputes_the_old_and_the_new_parent() {
        let mut session = session();
        let changed = session.put(vec![load("x", "b", 1.0, 180.0)]).unwrap();
        assert_eq!(keys(&changed.rows), ["a", "b", "root", "x"]);
        assert_eq!(changed.rows["a"].va, 0.0);
        assert_eq!(changed.rows["b"].va, 180.0);
    }

    #[test]
    fn a_removal_recomputes_the_ancestors() {
        let mut session = session();
        let changed = session.remove(&["x".to_owned()]);
        assert_eq!(keys(&changed.rows), ["a", "root"]);
        assert_eq!(changed.rows["a"].va, 0.0);
        assert_eq!(session.snapshot().nodes.len(), 3);
    }

    #[test]
    fn the_snapshot_keeps_every_stored_field_in_insertion_order() {
        let mut session = session();
        let mut x = load("x", "a", 1.0, 180.0);
        x["not_read_by_the_engine"] = json!("kept");
        session.put(vec![x.clone()]).unwrap();
        let snapshot = session.snapshot();
        let ids: Vec<&str> = snapshot
            .nodes
            .iter()
            .map(|n| n["id"].as_str().unwrap())
            .collect();
        assert_eq!(ids, ["root", "a", "b", "x"]);
        assert_eq!(snapshot.nodes[3], x);
    }

    #[test]
    fn a_looping_parent_chain_is_left_unlinked_instead_of_recursing() {
        let mut session = session();
        // a → b → a, from a tampered file; x below the loop is unlinked too.
        let changed = session
            .put(vec![panel("a", "b", 1.0), panel("b", "a", 2.0)])
            .unwrap();
        assert_eq!(changed.rows["a"].va, 0.0);
        assert_eq!(changed.rows["root"].va, 0.0);
        assert!(session.graph().children("a").next().is_none());
        assert!(session.graph().children("b").next().is_none());
        let changed = session.put(vec![panel("a", "a", 1.0)]).unwrap();
        assert_eq!(changed.rows["a"].va, 0.0);
    }

    #[test]
    fn a_panel_grounds_on_its_main_breaker() {
        let mut session = Session::default();
        let root = json!({ "id": "root", "node_type": "root" });
        let nodes = vec![root, panel("a", "root", 1.0), load("x", "a", 1.0, 23_000.0)];
        let all = session.open(json!({}), nodes).unwrap();
        // 23 000 VA / 230 V = 100 A, a 1.25 × 100 = 125 A main, so PEC 2017 Table 2.50.6.13
        // gives 14 mm² (over 100 A up to 200 A), not the 5.5 mm² of a bare 30 A trip.
        assert_eq!(all.rows["a"].at, 125.0);
        assert_eq!(all.rows["a"].egc_size, crate::sizing::Egc::Size(14.0));
    }

    #[test]
    fn the_header_sizes_a_load_breaker_by_its_load_type() {
        let session = &mut session();
        let all = session.snapshot().computed;
        // 180 VA outlets: 0.78 A × 1.25 = 0.98 A, the smallest rating of PEC 2017 Table
        // 2.40.1.6(A); an outlet that is no dwelling circuit of 2.10.1.11(C) needs no 20 A.
        assert_eq!(all.rows["x"].at, 15.0);
    }

    #[test]
    fn a_circuit_no_conductor_fits_gets_no_conduit_either() {
        let mut session = Session::default();
        let root = json!({ "id": "root", "node_type": "root" });
        let nodes = vec![
            root,
            panel("a", "root", 1.0),
            load("x", "a", 1.0, 150_000.0),
        ];
        let all = session.open(json!({}), nodes).unwrap();
        // 652 A on one set: the largest size of Table 3.10.2.6(B)(16), 500 mm², carries
        // less, so there is no conductor (-1) and no conduit to fill (-1), not a message.
        assert_eq!(all.rows["x"].conductor_size, -1.0);
        assert_eq!(
            all.rows["x"].conduit_size,
            crate::sizing::Conduit::Size(-1.0)
        );
    }

    #[test]
    fn renaming_the_project_recomputes_nothing() {
        let mut session = session();
        assert!(session
            .set_project(json!({ "title": "renamed" }))
            .rows
            .is_empty());
    }
}
