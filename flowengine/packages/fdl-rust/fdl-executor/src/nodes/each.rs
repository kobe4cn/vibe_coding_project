//! Each (iteration) node

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use crate::types::{Flow, FlowNode};
use fdl_gml::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Execute an each (iteration) node
pub async fn execute_each_node(
    flow: &Flow,
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let each_expr = node.each.as_ref().unwrap();
    let sub_nodes = node.node.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!("Each node {} has no sub-nodes", node_id))
    })?;

    // Parse each expression: "source => item, index" or "source => item"
    let (source_name, item_name, index_name) = parse_each_expr(each_expr)?;

    // Get source array - use GML evaluation to resolve the path
    let eval_ctx = context.read().await.build_eval_context();
    let source = fdl_gml::evaluate(&source_name, &eval_ctx).unwrap_or(Value::Null);

    let items = match source {
        Value::Array(arr) => arr,
        Value::Null => vec![],
        _ => {
            return Err(ExecutorError::NodeExecutionError {
                node: node_id.to_string(),
                message: format!("Each source '{}' is not an array", source_name),
            });
        }
    };

    // Initialize vars if present
    if let Some(vars_expr) = &node.vars {
        let vars_result = fdl_gml::evaluate(vars_expr, &eval_ctx)?;
        if let Value::Object(vars) = vars_result {
            let mut ctx = context.write().await;
            for (k, v) in vars {
                ctx.set_global(&k, v);
            }
        }
    }

    // Iterate over items
    for (index, item) in items.into_iter().enumerate() {
        // Create iteration context
        let mut ctx = context.write().await;
        ctx.set_variable(&item_name, item);
        if let Some(ref idx_name) = index_name {
            ctx.set_variable(idx_name, Value::Int(index as i64));
        }
        drop(ctx);

        // Execute sub-nodes (simplified - should use scheduler)
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

/// Parse each expression: "source => item, index" or "source => item"
fn parse_each_expr(expr: &str) -> ExecutorResult<(String, String, Option<String>)> {
    let parts: Vec<&str> = expr.split("=>").collect();
    if parts.len() != 2 {
        return Err(ExecutorError::InvalidFlow(format!(
            "Invalid each expression: {}",
            expr
        )));
    }

    let source = parts[0].trim().to_string();
    let vars = parts[1].trim();

    let var_parts: Vec<&str> = vars.split(',').map(|s| s.trim()).collect();
    let item_name = var_parts
        .first()
        .ok_or_else(|| ExecutorError::InvalidFlow("Missing item name in each".to_string()))?
        .to_string();
    let index_name = var_parts.get(1).map(|s| s.to_string());

    Ok((source, item_name, index_name))
}

/// Execute sub-flow nodes (simplified implementation)
async fn execute_sub_flow(
    _flow: &Flow,
    sub_nodes: &std::collections::HashMap<String, FlowNode>,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<()> {
    // Simplified: execute nodes in order
    // In production, this should use the scheduler for proper dependency handling
    for (sub_node_id, sub_node) in sub_nodes {
        let eval_ctx = context.read().await.build_eval_context();

        // Check only condition
        if let Some(only_expr) = &sub_node.only {
            let only_result = fdl_gml::evaluate(only_expr, &eval_ctx)?;
            if !only_result.is_truthy() {
                continue;
            }
        }

        // Execute based on type (simplified - only mapping for now)
        if let Some(with_expr) = &sub_node.with_expr {
            let output = fdl_gml::evaluate(with_expr, &eval_ctx)?;
            context.write().await.set_variable(sub_node_id, output);
        }

        // Apply sets - 将表达式结果更新到全局变量
        if let Some(sets_expr) = &sub_node.sets {
            let sets_result = fdl_gml::evaluate(sets_expr, &eval_ctx)?;
            if let Value::Object(sets_obj) = sets_result {
                let mut ctx = context.write().await;
                for (key, value) in sets_obj {
                    ctx.set_global(&key, value);
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_each_expr() {
        let (source, item, index) = parse_each_expr("items => item, idx").unwrap();
        assert_eq!(source, "items");
        assert_eq!(item, "item");
        assert_eq!(index, Some("idx".to_string()));

        let (source, item, index) = parse_each_expr("data => d").unwrap();
        assert_eq!(source, "data");
        assert_eq!(item, "d");
        assert_eq!(index, None);
    }
}
