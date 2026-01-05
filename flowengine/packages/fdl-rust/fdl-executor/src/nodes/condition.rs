//! Condition (if/else) node

use crate::context::ExecutionContext;
use crate::error::ExecutorResult;
use crate::types::FlowNode;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Execute a condition node
pub async fn execute_condition_node(
    _node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let when_expr = node.when.as_ref().unwrap();
    let then_node = node.then.as_ref().unwrap();

    // Evaluate condition
    let eval_ctx = context.read().await.build_eval_context();
    let condition_result = fdl_gml::evaluate(when_expr, &eval_ctx)?;

    // Determine next node
    let next = if condition_result.is_truthy() {
        vec![then_node.clone()]
    } else if let Some(else_node) = &node.else_branch {
        vec![else_node.clone()]
    } else {
        vec![]
    };

    Ok(next)
}
