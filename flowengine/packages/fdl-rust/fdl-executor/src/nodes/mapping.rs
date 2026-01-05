//! Data mapping node

use crate::context::ExecutionContext;
use crate::error::ExecutorResult;
use crate::types::FlowNode;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Execute a data mapping node
pub async fn execute_mapping_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let with_expr = node.with_expr.as_ref().unwrap();

    // Evaluate mapping expression
    let eval_ctx = context.read().await.build_eval_context();
    let output = fdl_gml::evaluate(with_expr, &eval_ctx)?;

    // Store result
    context.write().await.set_variable(node_id, output);

    // Return next nodes
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    Ok(next)
}
