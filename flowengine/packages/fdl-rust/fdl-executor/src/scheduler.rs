//! Parallel execution scheduler

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use crate::nodes;
use crate::types::{Flow, NodeType};
use fdl_gml::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Flow execution scheduler
pub struct Scheduler {
    max_parallel: usize,
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new()
    }
}

impl Scheduler {
    /// Create a new scheduler
    pub fn new() -> Self {
        Self { max_parallel: 100 }
    }

    /// Set maximum parallel executions
    pub fn with_max_parallel(mut self, max: usize) -> Self {
        self.max_parallel = max;
        self
    }

    /// Execute a flow
    pub async fn execute(
        &self,
        flow: &Flow,
        context: Arc<RwLock<ExecutionContext>>,
    ) -> ExecutorResult<Value> {
        // Build dependency graph
        let graph = self.build_dependency_graph(flow)?;

        // Find start nodes (nodes with no incoming edges)
        let start_nodes = self.find_start_nodes(flow, &graph);

        if start_nodes.is_empty() {
            return Err(ExecutorError::InvalidFlow(
                "No start nodes found".to_string(),
            ));
        }

        // Execute using parallel scheduling
        self.execute_from_nodes(flow, &start_nodes, context.clone())
            .await?;

        // Build output from context
        let ctx = context.read().await;
        Ok(ctx.build_eval_context())
    }

    /// Build dependency graph from flow
    fn build_dependency_graph(&self, flow: &Flow) -> ExecutorResult<HashMap<String, Vec<String>>> {
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();

        // Initialize all nodes
        for node_id in flow.nodes.keys() {
            graph.insert(node_id.clone(), Vec::new());
        }

        // Add edges from `next`, `then`, `else`, `fail`
        for (node_id, node) in &flow.nodes {
            // Process next
            if let Some(next) = &node.next {
                for target in next.split(',').map(|s| s.trim()) {
                    if let Some(deps) = graph.get_mut(target) {
                        deps.push(node_id.clone());
                    }
                }
            }

            // Process then/else for condition nodes
            if let Some(then) = &node.then {
                if let Some(deps) = graph.get_mut(then) {
                    deps.push(node_id.clone());
                }
            }
            if let Some(else_branch) = &node.else_branch {
                if let Some(deps) = graph.get_mut(else_branch) {
                    deps.push(node_id.clone());
                }
            }

            // Process case branches
            if let Some(cases) = &node.case {
                for case in cases {
                    if let Some(deps) = graph.get_mut(&case.then) {
                        deps.push(node_id.clone());
                    }
                }
            }
        }

        Ok(graph)
    }

    /// Find start nodes (nodes with no dependencies)
    fn find_start_nodes(
        &self,
        flow: &Flow,
        graph: &HashMap<String, Vec<String>>,
    ) -> Vec<String> {
        graph
            .iter()
            .filter(|(node_id, deps)| {
                deps.is_empty() && flow.nodes.contains_key(*node_id)
            })
            .map(|(node_id, _)| node_id.clone())
            .collect()
    }

    /// Execute from a set of nodes
    async fn execute_from_nodes(
        &self,
        flow: &Flow,
        node_ids: &[String],
        context: Arc<RwLock<ExecutionContext>>,
    ) -> ExecutorResult<()> {
        let mut pending: HashSet<String> = node_ids.iter().cloned().collect();
        let mut executing: HashSet<String> = HashSet::new();

        while !pending.is_empty() || !executing.is_empty() {
            // Get ready nodes (not yet executing)
            let ready: Vec<String> = pending
                .iter()
                .filter(|id| !executing.contains(*id))
                .take(self.max_parallel - executing.len())
                .cloned()
                .collect();

            if ready.is_empty() && !executing.is_empty() {
                // Wait for some executing nodes to complete
                tokio::task::yield_now().await;
                continue;
            }

            // Execute ready nodes in parallel
            let mut handles = Vec::new();
            for node_id in ready {
                pending.remove(&node_id);
                executing.insert(node_id.clone());

                let flow_clone = flow.clone();
                let ctx_clone = context.clone();
                let node_id_clone = node_id.clone();

                let handle = tokio::spawn(async move {
                    let result =
                        execute_single_node(&flow_clone, &node_id_clone, ctx_clone.clone()).await;
                    (node_id_clone, result)
                });
                handles.push(handle);
            }

            // Wait for all spawned tasks
            for handle in handles {
                let (node_id, result) = handle.await.map_err(|e| {
                    ExecutorError::NodeExecutionError {
                        node: "scheduler".to_string(),
                        message: e.to_string(),
                    }
                })?;

                executing.remove(&node_id);

                match result {
                    Ok(next_nodes) => {
                        // Add next nodes to pending
                        for next in next_nodes {
                            if !context.read().await.is_completed(&next) {
                                pending.insert(next);
                            }
                        }
                    }
                    Err(e) => {
                        // Check if there's a fail handler
                        let node = flow.nodes.get(&node_id);
                        if let Some(fail_node) = node.and_then(|n| n.fail.as_ref()) {
                            pending.insert(fail_node.clone());
                        } else {
                            return Err(e);
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

/// Execute a single node
async fn execute_single_node(
    flow: &Flow,
    node_id: &str,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let node = flow
        .nodes
        .get(node_id)
        .ok_or_else(|| ExecutorError::NodeNotFound(node_id.to_string()))?;

    // Check `only` condition
    if let Some(only_expr) = &node.only {
        let should_skip = {
            let ctx = context.read().await;
            let eval_ctx = ctx.build_eval_context();
            let only_result = fdl_gml::evaluate(only_expr, &eval_ctx)?;
            !only_result.is_truthy()
        }; // read lock dropped here

        if should_skip {
            // Skip this node
            context.write().await.mark_completed(node_id);
            return Ok(get_next_nodes(node));
        }
    }

    // Execute based on node type
    let result = match node.node_type() {
        NodeType::Exec => nodes::execute_exec_node(node_id, node, context.clone()).await,
        NodeType::Mapping => nodes::execute_mapping_node(node_id, node, context.clone()).await,
        NodeType::Condition => {
            nodes::execute_condition_node(node_id, node, context.clone()).await
        }
        NodeType::Switch => nodes::execute_switch_node(node_id, node, context.clone()).await,
        NodeType::Delay => nodes::execute_delay_node(node_id, node, context.clone()).await,
        NodeType::Each => {
            nodes::execute_each_node(flow, node_id, node, context.clone()).await
        }
        NodeType::Loop => {
            nodes::execute_loop_node(flow, node_id, node, context.clone()).await
        }
        NodeType::Agent => nodes::execute_agent_node(node_id, node, context.clone()).await,
        NodeType::Mcp => nodes::execute_mcp_node(node_id, node, context.clone()).await,
        NodeType::Unknown => Err(ExecutorError::InvalidFlow(format!(
            "Unknown node type: {}",
            node_id
        ))),
    };

    match result {
        Ok(next) => {
            context.write().await.mark_completed(node_id);
            Ok(next)
        }
        Err(e) => {
            context.write().await.mark_failed(node_id);
            Err(e)
        }
    }
}

/// Get next nodes from a node definition
fn get_next_nodes(node: &crate::types::FlowNode) -> Vec<String> {
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    next
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scheduler_creation() {
        let scheduler = Scheduler::new().with_max_parallel(50);
        assert_eq!(scheduler.max_parallel, 50);
    }
}
