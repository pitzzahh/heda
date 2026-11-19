//! The open project: the stored documents, as the app wrote them, and the
//! calculation cache. Rust owns this state; the app keeps a mirror for its sync
//! reads and sends every write here.
//!
//! A row depends on the node, its descendants and the phase of the panel feeding it,
//! so a write recomputes the written nodes, their ancestors (old and new parents)
//! and their direct children, plus the service disconnect, the first panel on the
//! supply (its minimum rating counts every circuit, PEC 2017 2.30.6.10); everything
//! else stays cached. Each write answers with the rows it recomputed.

use crate::graph::Graph;
use crate::load_schedule::{load_row, LoadRow};
use crate::model::Node;
use crate::riser::{layout_riser, riser_tree, RiserLayout};
use crate::short_circuit::{short_circuits, ShortCircuitRow};
use crate::voltage_drop::{voltage_drops, VoltageDropRow};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Default)]
pub struct Session {
    graph: Graph,
    /// Every node exactly as stored, fields the engine does not read included.
    docs: HashMap<String, Value>,
    project: Value,
    load_rows: HashMap<String, LoadRow>,
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
}

impl Session {
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
            nodes: self
                .graph
                .ids_in_order()
                .into_iter()
                .filter_map(|id| self.docs.get(id).cloned())
                .collect(),
            computed: self.compute_all(),
        }
    }

    /// The first panel on the supply: as the service disconnect, its minimum rating
    /// counts every circuit and its siblings' ratings (PEC 2017 2.30.6.10, 2.30.6.11).
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

    /// The riser diagram from `id` down; from the project root it starts at the service.
    pub fn riser(&mut self, id: &str) -> Option<RiserLayout> {
        let tree = riser_tree(&self.graph, &self.docs, &mut self.load_rows, id)?;
        let node = tree.circuit.node;
        let source =
            (node.node_type == "root").then(|| node.highest_unit_form.clone().unwrap_or_default());
        Some(layout_riser(&tree, source.as_ref()))
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
