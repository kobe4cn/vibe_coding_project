//! Tool execution node
//!
//! 执行工具调用节点，支持多种工具类型：
//! - `api://` - HTTP API 调用
//! - `db://` - 数据库操作
//! - `mcp://` - MCP 服务调用
//! - `flow://` - 子流程调用

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
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

    // Build arguments from GML expression
    let eval_ctx = context.read().await.build_eval_context();
    let args = if let Some(args_expr) = &node.args {
        fdl_gml::evaluate(args_expr, &eval_ctx)?
    } else {
        Value::Object(std::collections::HashMap::new())
    };

    tracing::info!("Executing tool: {} with args: {:?}", exec_uri, args);

    // Convert GML Value to serde_json::Value for tool execution
    let json_args = gml_value_to_json(&args);

    // Execute tool using ManagedToolRegistry (priority) or ToolRegistry (fallback)
    let result = {
        let ctx = context.read().await;
        let tool_context = ctx.tool_context();

        // Try managed registry first (uses ConfigStore for dynamic resolution)
        if let Some(managed) = ctx.managed_registry() {
            match managed.execute(exec_uri, json_args.clone(), tool_context).await {
                Ok(output) => {
                    tracing::info!(
                        "Tool {} executed via ManagedRegistry in {}ms",
                        exec_uri,
                        output.duration_ms
                    );
                    json_value_to_gml(&output.value)
                }
                Err(fdl_tools::ToolError::ToolNotFound(_)) => {
                    tracing::warn!(
                        "Tool not found in ManagedRegistry, using placeholder for {}",
                        exec_uri
                    );
                    create_placeholder_result(exec_uri)
                }
                Err(e) => {
                    tracing::error!("Tool {} execution failed (ManagedRegistry): {:?}", exec_uri, e);
                    return Err(ExecutorError::NodeExecutionError {
                        node: node_id.to_string(),
                        message: format!("Tool execution failed: {}", e),
                    });
                }
            }
        }
        // Fallback to simple registry
        else if let Some(registry) = ctx.tool_registry() {
            match registry.execute(exec_uri, json_args, tool_context).await {
                Ok(output) => {
                    tracing::info!(
                        "Tool {} executed via ToolRegistry in {}ms",
                        exec_uri,
                        output.duration_ms
                    );
                    json_value_to_gml(&output.value)
                }
                Err(fdl_tools::ToolError::ToolNotFound(_)) => {
                    tracing::warn!(
                        "Tool not registered, using placeholder for {}",
                        exec_uri
                    );
                    create_placeholder_result(exec_uri)
                }
                Err(e) => {
                    tracing::error!("Tool {} execution failed: {:?}", exec_uri, e);
                    return Err(ExecutorError::NodeExecutionError {
                        node: node_id.to_string(),
                        message: format!("Tool execution failed: {}", e),
                    });
                }
            }
        } else {
            // No registry - return placeholder result for testing
            tracing::warn!(
                "No tool registry configured, using placeholder for {}",
                exec_uri
            );
            create_placeholder_result(exec_uri)
        }
    };

    // Apply sets if present (update global variables)
    if let Some(sets_expr) = &node.sets {
        let mut ctx = context.write().await;
        let mut eval_scope = ctx.build_eval_context().as_object().cloned().unwrap_or_default();
        eval_scope.insert(node_id.to_string(), result.clone());
        let sets_ctx = Value::Object(eval_scope);
        let sets_result = fdl_gml::evaluate(sets_expr, &sets_ctx)?;
        // Apply sets results to globals
        if let Value::Object(sets_obj) = sets_result {
            for (key, value) in sets_obj {
                ctx.set_global(&key, value);
            }
        }
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

/// Create a placeholder result for tools that are not registered
fn create_placeholder_result(exec_uri: &str) -> Value {
    Value::object([
        ("success", Value::bool(true)),
        ("tool", Value::string(exec_uri.to_string())),
        ("_placeholder", Value::bool(true)),
    ])
}

/// Convert GML Value to serde_json::Value
fn gml_value_to_json(value: &Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Bool(b) => serde_json::Value::Bool(*b),
        Value::Int(i) => serde_json::Value::Number((*i).into()),
        Value::Float(f) => {
            serde_json::Number::from_f64(*f)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null)
        }
        Value::String(s) => serde_json::Value::String(s.clone()),
        Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(gml_value_to_json).collect())
        }
        Value::Object(obj) => {
            let map: serde_json::Map<String, serde_json::Value> = obj
                .iter()
                .map(|(k, v)| (k.clone(), gml_value_to_json(v)))
                .collect();
            serde_json::Value::Object(map)
        }
    }
}

/// Convert serde_json::Value to GML Value
fn json_value_to_gml(value: &serde_json::Value) -> Value {
    match value {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Bool(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::Int(i)
            } else if let Some(f) = n.as_f64() {
                Value::Float(f)
            } else {
                Value::Null
            }
        }
        serde_json::Value::String(s) => Value::String(s.clone()),
        serde_json::Value::Array(arr) => {
            Value::Array(arr.iter().map(json_value_to_gml).collect())
        }
        serde_json::Value::Object(obj) => {
            let map: std::collections::HashMap<String, Value> = obj
                .iter()
                .map(|(k, v)| (k.clone(), json_value_to_gml(v)))
                .collect();
            Value::Object(map)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gml_to_json_conversion() {
        let gml = Value::object([
            ("name", Value::string("test")),
            ("count", Value::int(42)),
            ("active", Value::bool(true)),
        ]);

        let json = gml_value_to_json(&gml);
        assert_eq!(json.get("name"), Some(&serde_json::json!("test")));
        assert_eq!(json.get("count"), Some(&serde_json::json!(42)));
        assert_eq!(json.get("active"), Some(&serde_json::json!(true)));
    }

    #[test]
    fn test_json_to_gml_conversion() {
        let json = serde_json::json!({
            "name": "test",
            "count": 42,
            "active": true
        });

        let gml = json_value_to_gml(&json);
        assert_eq!(gml.get("name"), Some(&Value::string("test")));
        assert_eq!(gml.get("count"), Some(&Value::int(42)));
        assert_eq!(gml.get("active"), Some(&Value::bool(true)));
    }
}
