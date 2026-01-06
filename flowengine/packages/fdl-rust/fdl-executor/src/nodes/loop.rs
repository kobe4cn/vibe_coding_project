//! Loop (while) node

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use crate::types::{Flow, FlowNode};
use fdl_gml::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

const MAX_ITERATIONS: usize = 10000;

/// Execute a loop node
pub async fn execute_loop_node(
    flow: &Flow,
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let vars_expr = node
        .vars
        .as_ref()
        .ok_or_else(|| ExecutorError::InvalidFlow(format!("Loop node {} missing vars", node_id)))?;
    let when_expr = node
        .when
        .as_ref()
        .ok_or_else(|| ExecutorError::InvalidFlow(format!("Loop node {} missing when", node_id)))?;
    let sub_nodes = node.node.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!("Loop node {} has no sub-nodes", node_id))
    })?;

    // Initialize loop variables
    {
        let eval_ctx = context.read().await.build_eval_context();
        let vars_result = fdl_gml::evaluate(vars_expr, &eval_ctx)?;
        if let Value::Object(vars) = vars_result {
            let mut ctx = context.write().await;
            for (k, v) in vars {
                ctx.set_global(&k, v);
            }
        }
    }

    // Loop execution
    let mut iteration = 0;
    loop {
        iteration += 1;
        if iteration > MAX_ITERATIONS {
            return Err(ExecutorError::MaxIterationsExceeded(node_id.to_string()));
        }

        // Check loop condition
        let eval_ctx = context.read().await.build_eval_context();
        let condition_result = fdl_gml::evaluate(when_expr, &eval_ctx)?;
        if !condition_result.is_truthy() {
            break;
        }

        // Execute sub-nodes
        execute_sub_flow(flow, sub_nodes, context.clone()).await?;
    }

    // Apply with transformation if present
    if let Some(with_expr) = &node.with_expr {
        let eval_ctx = context.read().await.build_eval_context();
        let output = fdl_gml::evaluate(with_expr, &eval_ctx)?;
        context.write().await.set_variable(node_id, output);
    }

    // Return next nodes
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    Ok(next)
}

/// Execute sub-flow nodes (simplified implementation)
async fn execute_sub_flow(
    _flow: &Flow,
    sub_nodes: &std::collections::HashMap<String, FlowNode>,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<()> {
    // Simplified: execute nodes in order
    for (sub_node_id, sub_node) in sub_nodes {
        let eval_ctx = context.read().await.build_eval_context();

        // Check only condition
        if let Some(only_expr) = &sub_node.only {
            let only_result = fdl_gml::evaluate(only_expr, &eval_ctx)?;
            if !only_result.is_truthy() {
                continue;
            }
        }

        // Execute based on type
        if let Some(with_expr) = &sub_node.with_expr {
            let output = fdl_gml::evaluate(with_expr, &eval_ctx)?;
            context.write().await.set_variable(sub_node_id, output);
        }

        // Apply sets
        if let Some(sets_expr) = &sub_node.sets {
            let sets_ctx = context.read().await.build_eval_context();
            let sets_result = fdl_gml::evaluate(sets_expr, &sets_ctx)?;
            if let Value::Object(updates) = sets_result {
                let mut ctx = context.write().await;
                for (k, v) in updates {
                    ctx.set_global(&k, v);
                }
            }
        }
    }

    Ok(())
}
