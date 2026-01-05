//! Switch (case/when) node

use crate::context::ExecutionContext;
use crate::error::ExecutorResult;
use crate::types::FlowNode;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Execute a switch node
pub async fn execute_switch_node(
    _node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let cases = node.case.as_ref().unwrap();

    let eval_ctx = context.read().await.build_eval_context();

    // Evaluate each case in order
    for case in cases {
        let condition_result = fdl_gml::evaluate(&case.when, &eval_ctx)?;
        if condition_result.is_truthy() {
            return Ok(vec![case.then.clone()]);
        }
    }

    // No case matched, use else branch if present
    if let Some(else_node) = &node.else_branch {
        return Ok(vec![else_node.clone()]);
    }

    // No match and no else
    Ok(vec![])
}
