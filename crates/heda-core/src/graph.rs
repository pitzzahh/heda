//! The node tree, indexed the way `src/lib/db/queries/snapshot.ts` indexes it:
//! nodes in insertion order, and each parent's children sorted by circuit number
//! (ties keep insertion order, as Array.prototype.sort is stable).

use crate::model::Node;
use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct Graph {
    nodes: HashMap<String, Node>,
    /// Insertion order: an update keeps a node's place, a re-insert goes last.
    order: HashMap<String, u64>,
    next_order: u64,
    children: HashMap<String, Vec<String>>,
}

impl Graph {
    pub fn new(nodes: Vec<Node>) -> Self {
        let mut graph = Graph::default();
        graph.upsert(nodes);
        graph
    }

    pub fn get(&self, id: &str) -> Option<&Node> {
        self.nodes.get(id)
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// The first root in insertion order.
    pub fn root(&self) -> Option<&Node> {
        self.nodes
            .values()
            .filter(|node| node.node_type == "root")
            .min_by_key(|node| self.order[&node.id])
    }

    pub fn children<'a>(&'a self, parent_id: &str) -> impl Iterator<Item = &'a Node> + 'a {
        self.children
            .get(parent_id)
            .into_iter()
            .flatten()
            .map(|id| &self.nodes[id])
    }

    /// Ids of `id` and every ancestor, nearest first. Bounded by the node count, so a
    /// looping parent chain in a tampered file cannot spin forever.
    pub fn ancestors_and_self(&self, id: &str) -> Vec<String> {
        let mut chain = Vec::new();
        let mut current = Some(id.to_owned());
        while let Some(id) = current {
            if chain.len() > self.nodes.len() || chain.contains(&id) {
                break;
            }
            current = self.nodes.get(&id).and_then(|node| node.parent_id.clone());
            chain.push(id);
        }
        chain
    }

    /// Inserts or replaces nodes, then rebuilds the child index.
    pub fn upsert(&mut self, nodes: Vec<Node>) {
        for node in nodes {
            if !self.order.contains_key(&node.id) {
                self.order.insert(node.id.clone(), self.next_order);
                self.next_order += 1;
            }
            self.nodes.insert(node.id.clone(), node);
        }
        self.index_children();
    }

    pub fn remove(&mut self, ids: &[String]) {
        for id in ids {
            self.nodes.remove(id);
            self.order.remove(id);
        }
        self.index_children();
    }

    fn index_children(&mut self) {
        let mut children: HashMap<String, Vec<String>> = HashMap::new();
        for node in self.nodes.values() {
            if let Some(parent_id) = node.parent_id.as_deref().filter(|id| !id.is_empty()) {
                children
                    .entry(parent_id.to_owned())
                    .or_default()
                    .push(node.id.clone());
            }
        }
        for ids in children.values_mut() {
            ids.sort_by(|a, b| {
                let key = |id: &String| self.nodes[id].circuit_number.unwrap_or(0.0);
                key(a)
                    .partial_cmp(&key(b))
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then(self.order[a].cmp(&self.order[b]))
            });
        }
        self.children = children;
    }

    /// Every node below the root, each before its subtree, children in order.
    pub fn preorder(&self, root: &Node) -> Vec<&Node> {
        let mut order = Vec::new();
        let mut stack: Vec<&Node> = self.children(&root.id).collect();
        stack.reverse();
        while let Some(node) = stack.pop() {
            order.push(node);
            let children: Vec<&Node> = self.children(&node.id).collect();
            stack.extend(children.into_iter().rev());
        }
        order
    }
}
