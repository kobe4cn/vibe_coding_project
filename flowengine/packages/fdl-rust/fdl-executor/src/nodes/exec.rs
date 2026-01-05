//! Tool execution node

use crate::context::ExecutionContext;
use crate::error::ExecutorResult;
use crate::types::FlowNode;
use fdl_gml::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Execute a tool call node
pub async fn execute_exec_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let exec_uri = node.exec.as_ref().unwrap();

    // Build arguments
    let eval_ctx = context.read().await.build_eval_context();
    let args = if let Some(args_expr) = &node.args {
        fdl_gml::evaluate(args_expr, &eval_ctx)?
    } else {
        Value::Object(std::collections::HashMap::new())
    };

    // Execute tool (placeholder)
    tracing::info!("Executing tool: {} with args: {:?}", exec_uri, args);

    // TODO: Use ToolRegistry to execute the tool
    let result = Value::object([
        ("success", Value::bool(true)),
        ("tool", Value::string(exec_uri.clone())),
    ]);

    // Apply sets if present
    if let Some(sets_expr) = &node.sets {
        let ctx = context.write().await;
        let eval_ctx = ctx.build_eval_context();
        let _sets_result = fdl_gml::evaluate(sets_expr, &eval_ctx)?;
        // TODO: Apply sets to context
    }

    // Apply with transformation if present
    let output = if let Some(with_expr) = &node.with_expr {
        let mut scope = eval_ctx.as_object().cloned().unwrap_or_default();
        scope.insert(node_id.to_string(), result);
        let with_ctx = Value::Object(scope);
        fdl_gml::evaluate(with_expr, &with_ctx)?
    } else {
        result
    };

    // Store result in context
    context.write().await.set_variable(node_id, output);

    // Return next nodes
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    Ok(next)
}
