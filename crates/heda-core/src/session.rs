//! The open project and its calculation cache. Results depend only on a node and
//! its descendants, so a change evicts the changed nodes and their ancestors (old
//! and new parents) and everything else stays cached, as
//! `invalidateComputed` in `src/lib/db/queries/snapshot.ts` does.

use crate::graph::Graph;
use crate::load_schedule::{load_row, node_result, LoadRow};
use crate::model::{Node, Settings};
use crate::short_circuit::{short_circuits, ShortCircuitRow};
use crate::voltage_drop::{voltage_drops, VoltageDropRow};
use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct Session {
    graph: Graph,
    is_dynamic: bool,
    load_rows: HashMap<String, LoadRow>,
    node_results: HashMap<String, LoadRow>,
}

impl Session {
    /// Replaces the open project.
    pub fn open(&mut self, nodes: Vec<Node>, settings: Settings) {
        *self = Session {
            graph: Graph::new(nodes),
            is_dynamic: settings.is_adjustment_factor_dynamic.unwrap_or(false),
            ..Session::default()
        };
    }

    pub fn set_settings(&mut self, settings: Settings) {
        let is_dynamic = settings.is_adjustment_factor_dynamic.unwrap_or(false);
        if is_dynamic != self.is_dynamic {
            self.is_dynamic = is_dynamic;
            self.load_rows.clear();
            self.node_results.clear();
        }
    }

    /// Inserts or replaces nodes.
    pub fn upsert(&mut self, nodes: Vec<Node>) {
        let ids: Vec<String> = nodes.iter().map(|node| node.id.clone()).collect();
        // A node that did not exist before has nothing stale cached, only its ancestors.
        let starts: Vec<String> = nodes
            .iter()
            .filter_map(|node| {
                if self.graph.get(&node.id).is_some() {
                    Some(node.id.clone())
                } else {
                    node.parent_id.clone()
                }
            })
            .collect();
        self.evict(&starts);
        self.graph.upsert(nodes);
        self.evict(&starts);
        self.evict(
            &ids.iter()
                .filter_map(|id| self.graph.get(id)?.parent_id.clone())
                .collect::<Vec<_>>(),
        );
    }

    pub fn remove(&mut self, ids: &[String]) {
        self.evict(ids);
        self.graph.remove(ids);
        for id in ids {
            self.load_rows.remove(id);
            self.node_results.remove(id);
        }
    }

    fn evict(&mut self, starts: &[String]) {
        for start in starts {
            for id in self.graph.ancestors_and_self(start) {
                self.load_rows.remove(&id);
                self.node_results.remove(&id);
            }
        }
    }

    pub fn graph(&self) -> &Graph {
        &self.graph
    }

    /// The rows of a panel's (or the root's) load schedule, in circuit order.
    pub fn load_schedule(&mut self, parent_id: &str) -> Vec<(String, LoadRow)> {
        let children: Vec<&Node> = self.graph.children(parent_id).collect();
        children
            .into_iter()
            .map(|child| {
                (
                    child.id.clone(),
                    load_row(&self.graph, child, self.is_dynamic, &mut self.load_rows),
                )
            })
            .collect()
    }

    pub fn node_result(&mut self, id: &str) -> Option<LoadRow> {
        let node = self.graph.get(id)?;
        Some(node_result(
            &self.graph,
            node,
            self.is_dynamic,
            &mut self.node_results,
        ))
    }

    pub fn voltage_drops(&mut self) -> Vec<VoltageDropRow> {
        voltage_drops(&self.graph, self.is_dynamic, &mut self.load_rows)
    }

    pub fn short_circuits(&mut self) -> Vec<ShortCircuitRow> {
        short_circuits(&self.graph, self.is_dynamic, &mut self.load_rows)
    }
}
