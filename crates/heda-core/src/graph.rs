//! The node tree, indexed the way `src/lib/db/queries/snapshot.ts` indexes it:
//! nodes in insertion order, and each parent's children sorted by circuit number
//! (ties keep insertion order, as Array.prototype.sort is stable).

use crate::model::Node;
use std::collections::HashMap;

#[derive(Debug, Default, Clone)]
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
        for node in nodes {
            graph.order.insert(node.id.clone(), graph.next_order);
            graph.next_order += 1;
            graph.nodes.insert(node.id.clone(), node);
        }
        graph.index_children();
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

    /// Every node id in insertion order.
    pub fn ids_in_order(&self) -> Vec<&str> {
        let mut ids: Vec<(u64, &str)> = self
            .order
            .iter()
            .map(|(id, order)| (*order, id.as_str()))
            .collect();
        ids.sort_unstable();
        ids.into_iter().map(|(_, id)| id).collect()
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

    /// Inserts or replaces nodes. An edit or an added node updates only its parent's
    /// child list; a move rebuilds the whole index (moves are what can loop a chain).
    pub fn upsert(&mut self, nodes: Vec<Node>) {
        let mut moved = false;
        let mut added = Vec::new();
        let mut parents = std::collections::HashSet::new();
        for node in nodes {
            match self.nodes.get(&node.id) {
                Some(old) => moved |= old.parent_id != node.parent_id,
                None => {
                    self.order.insert(node.id.clone(), self.next_order);
                    self.next_order += 1;
                    added.push(node.id.clone());
                }
            }
            parents.extend(parent_of(&node).map(str::to_owned));
            self.nodes.insert(node.id.clone(), node);
        }
        if moved {
            return self.index_children();
        }
        let mut anchored = HashMap::new();
        let links: Vec<(String, String)> = added
            .iter()
            .filter_map(|id| {
                let parent = parent_of(&self.nodes[id])?;
                self.is_anchored(id, &mut anchored)
                    .then(|| (parent.to_owned(), id.clone()))
            })
            .collect();
        for (parent, id) in links {
            self.children.entry(parent).or_default().push(id);
        }
        for parent in parents {
            self.sort_children(&parent);
        }
    }

    pub fn remove(&mut self, ids: &[String]) {
        let mut unlinked = false;
        for id in ids {
            self.order.remove(id);
            let Some(node) = self.nodes.remove(id) else {
                continue;
            };
            let siblings = parent_of(&node).and_then(|parent| self.children.get_mut(parent));
            match siblings.and_then(|list| Some((list.iter().position(|c| c == id)?, list))) {
                Some((index, list)) => {
                    list.remove(index);
                }
                // Not linked: it sat on a loop, whose other nodes may now be anchored.
                None => unlinked |= parent_of(&node).is_some(),
            }
        }
        if unlinked {
            self.index_children();
        }
    }

    fn sort_children(&mut self, parent: &str) {
        let Some(mut ids) = self.children.remove(parent) else {
            return;
        };
        let mut keyed: Vec<(f64, u64, String)> = ids
            .drain(..)
            .map(|id| {
                let circuit = self.nodes[&id].circuit_number.unwrap_or(0.0);
                (circuit, self.order[&id], id)
            })
            .collect();
        keyed.sort_by(|a, b| {
            a.0.partial_cmp(&b.0)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.1.cmp(&b.1))
        });
        self.children.insert(
            parent.to_owned(),
            keyed.into_iter().map(|(_, _, id)| id).collect(),
        );
    }

    fn index_children(&mut self) {
        // A tampered file can loop a parent chain; nodes on or below a loop stay
        // unlinked, so no calculation can recurse forever.
        let mut anchored: HashMap<&str, bool> = HashMap::new();
        let mut children: HashMap<String, Vec<String>> = HashMap::new();
        for node in self.nodes.values() {
            if let Some(parent_id) = parent_of(node) {
                if !self.is_anchored(&node.id, &mut anchored) {
                    continue;
                }
                children
                    .entry(parent_id.to_owned())
                    .or_default()
                    .push(node.id.clone());
            }
        }
        self.children = children;
        let parents: Vec<String> = self.children.keys().cloned().collect();
        for parent in parents {
            self.sort_children(&parent);
        }
    }

    /// Whether the parent chain above `id` ends (at a node without a parent, or a
    /// missing one) instead of looping. Answers are memoized in `known`.
    fn is_anchored<'a>(&'a self, id: &'a str, known: &mut HashMap<&'a str, bool>) -> bool {
        let mut chain: Vec<&str> = Vec::new();
        let mut current = Some(id);
        let answer = loop {
            let Some(id) = current else { break true };
            if let Some(&answer) = known.get(id) {
                break answer;
            }
            if chain.contains(&id) {
                break false;
            }
            chain.push(id);
            current = self
                .nodes
                .get(id)
                .and_then(|node| node.parent_id.as_deref())
                .filter(|parent| !parent.is_empty() && self.nodes.contains_key(*parent));
        };
        for id in chain {
            known.insert(id, answer);
        }
        answer
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

fn parent_of(node: &Node) -> Option<&str> {
    node.parent_id.as_deref().filter(|id| !id.is_empty())
}
