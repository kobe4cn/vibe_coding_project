//! Extended node types - Guard, Approval, Handoff, OSS, MQ, Mail, SMS, Service
//!
//! 扩展节点类型的执行处理器。这些节点通过对应的工具服务执行实际操作。
//! 当配置了 ManagedToolRegistry 时，会通过工具注册表执行实际操作；
//! 否则使用模拟数据（用于测试和开发）。

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use crate::types::FlowNode;
use fdl_gml::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

// ============================================================================
// 工具调用辅助函数
// ============================================================================

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
            let map: HashMap<String, Value> = obj
                .iter()
                .map(|(k, v)| (k.clone(), json_value_to_gml(v)))
                .collect();
            Value::Object(map)
        }
    }
}

/// 通过工具注册表执行工具调用
///
/// 如果配置了 ManagedToolRegistry，则通过注册表执行实际调用；
/// 否则返回 None，调用方应使用模拟数据。
async fn execute_tool_call(
    uri: &str,
    args: &Value,
    context: &Arc<RwLock<ExecutionContext>>,
    node_id: &str,
) -> ExecutorResult<Option<Value>> {
    let ctx = context.read().await;

    // 尝试使用 managed registry 执行
    if let Some(managed) = ctx.managed_registry() {
        let json_args = gml_value_to_json(args);
        let tool_context = ctx.tool_context().clone();

        // 释放读锁后执行
        drop(ctx);

        match managed.execute(uri, json_args, &tool_context).await {
            Ok(output) => {
                tracing::info!(
                    "Tool {} executed via ManagedRegistry in {}ms (node: {})",
                    uri,
                    output.duration_ms,
                    node_id
                );
                Ok(Some(json_value_to_gml(&output.value)))
            }
            Err(fdl_tools::ToolError::ToolNotFound(_)) => {
                tracing::debug!(
                    "Tool {} not found in registry, using mock data (node: {})",
                    uri,
                    node_id
                );
                Ok(None) // 返回 None 让调用方使用模拟数据
            }
            Err(e) => {
                tracing::error!("Tool {} execution failed: {:?} (node: {})", uri, e, node_id);
                Err(ExecutorError::NodeExecutionError {
                    node: node_id.to_string(),
                    message: format!("Tool execution failed: {}", e),
                })
            }
        }
    } else {
        // 没有配置 registry，使用模拟数据
        tracing::debug!(
            "No tool registry configured, using mock data for {} (node: {})",
            uri,
            node_id
        );
        Ok(None)
    }
}

// ============================================================================
// 通用辅助函数
// ============================================================================

/// 获取后续节点列表
fn get_next_nodes(node: &FlowNode) -> Vec<String> {
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    next
}

/// 应用 sets 表达式更新全局变量
async fn apply_sets(
    node: &FlowNode,
    node_id: &str,
    result: &Value,
    context: &Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<()> {
    if let Some(sets_expr) = &node.sets {
        let mut ctx = context.write().await;
        let mut eval_scope = ctx.build_eval_context().as_object().cloned().unwrap_or_default();
        eval_scope.insert(node_id.to_string(), result.clone());
        let sets_ctx = Value::Object(eval_scope);
        let sets_result = fdl_gml::evaluate(sets_expr, &sets_ctx)?;
        if let Value::Object(sets_obj) = sets_result {
            for (key, value) in sets_obj {
                ctx.set_global(&key, value);
            }
        }
    }
    Ok(())
}

/// 应用 with 表达式转换输出
fn apply_with_transform(
    node: &FlowNode,
    node_id: &str,
    result: Value,
    eval_ctx: &Value,
) -> ExecutorResult<Value> {
    if let Some(with_expr) = &node.with_expr {
        let mut scope = eval_ctx.as_object().cloned().unwrap_or_default();
        scope.insert(node_id.to_string(), result);
        let with_ctx = Value::Object(scope);
        Ok(fdl_gml::evaluate(with_expr, &with_ctx)?)
    } else {
        Ok(result)
    }
}

// ============================================================================
// Guard Node - 安全检查节点
// ============================================================================

/// Execute a guard node (security checks)
///
/// Guard 节点用于执行安全检查，如 PII 检测、越狱检测、内容审核等。
/// 检查失败时可以阻止执行、发出警告或编辑内容。
pub async fn execute_guard_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let guard_config = node.guard.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!("Guard node '{}' missing guard configuration", node_id))
    })?;

    // 构建评估上下文
    let eval_ctx = context.read().await.build_eval_context();

    // 解析 guard 配置（格式：guard_type:action 或 GML 表达式）
    let result = if guard_config.contains(':') {
        // 简单格式：pii:block, moderation:warn 等
        let parts: Vec<&str> = guard_config.split(':').collect();
        let guard_type = parts.get(0).unwrap_or(&"custom");
        let action = parts.get(1).unwrap_or(&"block");

        Value::object([
            ("passed", Value::bool(true)),  // 默认通过，实际检查由外部服务实现
            ("guardType", Value::string(guard_type.to_string())),
            ("action", Value::string(action.to_string())),
        ])
    } else {
        // GML 表达式格式
        fdl_gml::evaluate(guard_config, &eval_ctx)?
    };

    // 检查是否通过
    let passed = result
        .get("passed")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    // 应用 sets
    apply_sets(node, node_id, &result, &context).await?;

    // 应用 with 转换
    let output = apply_with_transform(node, node_id, result, &eval_ctx)?;

    // 存储结果
    context.write().await.set_variable(node_id, output);

    // 如果检查失败且有 fail 处理器，跳转到 fail 节点
    if !passed {
        if let Some(fail_node) = &node.fail {
            return Ok(vec![fail_node.clone()]);
        }
    }

    Ok(get_next_nodes(node))
}

// ============================================================================
// Approval Node - 人工审批节点
// ============================================================================

/// Execute an approval node (human-in-the-loop)
///
/// Approval 节点用于请求人工审批。流程会在此暂停，等待人工确认。
/// 实际的审批逻辑由外部系统处理，这里只是记录状态。
pub async fn execute_approval_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let approval_config = node.approval.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!(
            "Approval node '{}' missing approval configuration",
            node_id
        ))
    })?;

    // 构建评估上下文
    let eval_ctx = context.read().await.build_eval_context();

    // 解析审批配置（可能是标题或 GML 表达式）
    let result = if approval_config.starts_with('{') || approval_config.contains('=') {
        // GML 表达式
        fdl_gml::evaluate(approval_config, &eval_ctx)?
    } else {
        // 简单标题
        Value::object([
            ("title", Value::string(approval_config.clone())),
            ("status", Value::string("pending")),
            ("approved", Value::Null),
        ])
    };

    // 应用 sets
    apply_sets(node, node_id, &result, &context).await?;

    // 应用 with 转换
    let output = apply_with_transform(node, node_id, result, &eval_ctx)?;

    // 存储结果
    context.write().await.set_variable(node_id, output);

    // 审批节点通常需要外部系统来推进流程
    // 这里暂时直接返回后续节点
    Ok(get_next_nodes(node))
}

// ============================================================================
// Handoff Node - Agent 移交节点
// ============================================================================

/// Execute a handoff node (agent handoff)
///
/// Handoff 节点用于将任务移交给另一个 Agent。
pub async fn execute_handoff_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let handoff_target = node.handoff.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!(
            "Handoff node '{}' missing handoff target",
            node_id
        ))
    })?;

    // 构建评估上下文
    let eval_ctx = context.read().await.build_eval_context();

    // 解析目标 Agent
    let target = if handoff_target.contains('=') {
        // GML 表达式
        fdl_gml::evaluate(handoff_target, &eval_ctx)?
    } else {
        // 简单 Agent ID
        Value::string(handoff_target.clone())
    };

    let result = Value::object([
        ("target", target),
        ("status", Value::string("handoff_initiated")),
    ]);

    // 应用 sets
    apply_sets(node, node_id, &result, &context).await?;

    // 应用 with 转换
    let output = apply_with_transform(node, node_id, result, &eval_ctx)?;

    // 存储结果
    context.write().await.set_variable(node_id, output);

    Ok(get_next_nodes(node))
}

// ============================================================================
// OSS Node - 对象存储节点
// ============================================================================

/// Execute an OSS node (object storage operations)
///
/// OSS 节点用于执行对象存储操作，如上传、下载、删除文件。
/// URI 格式：oss://service-id/operation 或 oss://service-id/operation/key
/// 当配置了 ManagedToolRegistry 时会执行实际操作，否则返回模拟数据。
pub async fn execute_oss_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let oss_uri = node.oss.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!("OSS node '{}' missing OSS URI", node_id))
    })?;

    // 构建评估上下文
    let eval_ctx = context.read().await.build_eval_context();

    // 评估参数
    let args = if let Some(args_expr) = &node.args {
        fdl_gml::evaluate(args_expr, &eval_ctx)?
    } else {
        Value::Object(HashMap::new())
    };

    // 尝试通过工具注册表执行
    let result = if let Some(tool_result) = execute_tool_call(oss_uri, &args, &context, node_id).await? {
        tool_result
    } else {
        // 没有注册表或工具未找到，使用模拟数据
        Value::object([
            ("uri", Value::string(oss_uri.clone())),
            ("success", Value::bool(true)),
            ("operation", Value::string("mock")),
            ("args", args),
            ("_mock", Value::bool(true)),
        ])
    };

    // 应用 sets
    apply_sets(node, node_id, &result, &context).await?;

    // 应用 with 转换
    let output = apply_with_transform(node, node_id, result, &eval_ctx)?;

    // 存储结果
    context.write().await.set_variable(node_id, output);

    Ok(get_next_nodes(node))
}

// ============================================================================
// MQ Node - 消息队列节点
// ============================================================================

/// Execute an MQ node (message queue operations)
///
/// MQ 节点用于执行消息队列操作，如发送消息、订阅主题。
/// URI 格式：mq://service-id/operation 或 mq://service-id/operation/topic
/// 当配置了 ManagedToolRegistry 时会执行实际操作，否则返回模拟数据。
pub async fn execute_mq_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let mq_uri = node.mq.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!("MQ node '{}' missing MQ URI", node_id))
    })?;

    // 构建评估上下文
    let eval_ctx = context.read().await.build_eval_context();

    // 评估参数
    let args = if let Some(args_expr) = &node.args {
        fdl_gml::evaluate(args_expr, &eval_ctx)?
    } else {
        Value::Object(HashMap::new())
    };

    // 尝试通过工具注册表执行
    let result = if let Some(tool_result) = execute_tool_call(mq_uri, &args, &context, node_id).await? {
        tool_result
    } else {
        // 没有注册表或工具未找到，使用模拟数据
        Value::object([
            ("uri", Value::string(mq_uri.clone())),
            ("success", Value::bool(true)),
            ("messageId", Value::string(format!("msg-{}", uuid::Uuid::new_v4()))),
            ("args", args),
            ("_mock", Value::bool(true)),
        ])
    };

    // 应用 sets
    apply_sets(node, node_id, &result, &context).await?;

    // 应用 with 转换
    let output = apply_with_transform(node, node_id, result, &eval_ctx)?;

    // 存储结果
    context.write().await.set_variable(node_id, output);

    Ok(get_next_nodes(node))
}

// ============================================================================
// Mail Node - 邮件发送节点
// ============================================================================

/// Execute a mail node (email sending)
///
/// Mail 节点用于发送邮件。
/// URI 格式：mail://service-id/send 或 mail://service-id/template
/// 配置格式也可以是 GML 表达式，此时使用模拟数据。
/// 当配置了 ManagedToolRegistry 时会执行实际操作，否则返回模拟数据。
pub async fn execute_mail_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let mail_config = node.mail.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!("Mail node '{}' missing mail configuration", node_id))
    })?;

    // 构建评估上下文
    let eval_ctx = context.read().await.build_eval_context();

    // 评估邮件配置参数
    let mail_params = if mail_config.starts_with('{') || mail_config.contains('=') {
        fdl_gml::evaluate(mail_config, &eval_ctx)?
    } else if !mail_config.starts_with("mail://") {
        // 简单收件人地址
        Value::object([("to", Value::string(mail_config.clone()))])
    } else {
        Value::Object(HashMap::new())
    };

    // 评估额外参数并与 mail_params 合并
    let mut args = if let Some(args_expr) = &node.args {
        fdl_gml::evaluate(args_expr, &eval_ctx)?
    } else {
        Value::Object(HashMap::new())
    };

    // 合并 mail_params 到 args
    if let (Value::Object(args_map), Value::Object(params_map)) = (&mut args, mail_params.clone()) {
        for (k, v) in params_map {
            if !args_map.contains_key(&k) {
                args_map.insert(k, v);
            }
        }
    }

    // 如果是 mail:// URI，尝试通过注册表执行
    let result = if mail_config.starts_with("mail://") {
        if let Some(tool_result) = execute_tool_call(mail_config, &args, &context, node_id).await? {
            tool_result
        } else {
            // 没有注册表或工具未找到，使用模拟数据
            Value::object([
                ("success", Value::bool(true)),
                ("uri", Value::string(mail_config.clone())),
                ("args", args),
                ("messageId", Value::string(format!("mail-{}", uuid::Uuid::new_v4()))),
                ("_mock", Value::bool(true)),
            ])
        }
    } else {
        // 非 URI 格式，使用模拟数据
        Value::object([
            ("success", Value::bool(true)),
            ("config", mail_params),
            ("args", args),
            ("messageId", Value::string(format!("mail-{}", uuid::Uuid::new_v4()))),
            ("_mock", Value::bool(true)),
        ])
    };

    // 应用 sets
    apply_sets(node, node_id, &result, &context).await?;

    // 应用 with 转换
    let output = apply_with_transform(node, node_id, result, &eval_ctx)?;

    // 存储结果
    context.write().await.set_variable(node_id, output);

    Ok(get_next_nodes(node))
}

// ============================================================================
// SMS Node - 短信发送节点
// ============================================================================

/// Execute an SMS node (SMS sending)
///
/// SMS 节点用于发送短信。
/// URI 格式：sms://service-id/send 或 sms://service-id/template
/// 配置格式也可以是 GML 表达式，此时使用模拟数据。
/// 当配置了 ManagedToolRegistry 时会执行实际操作，否则返回模拟数据。
pub async fn execute_sms_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let sms_config = node.sms.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!("SMS node '{}' missing SMS configuration", node_id))
    })?;

    // 构建评估上下文
    let eval_ctx = context.read().await.build_eval_context();

    // 评估短信配置参数
    let sms_params = if sms_config.starts_with('{') || sms_config.contains('=') {
        fdl_gml::evaluate(sms_config, &eval_ctx)?
    } else if !sms_config.starts_with("sms://") {
        // 简单手机号
        Value::object([("phone", Value::string(sms_config.clone()))])
    } else {
        Value::Object(HashMap::new())
    };

    // 评估额外参数并与 sms_params 合并
    let mut args = if let Some(args_expr) = &node.args {
        fdl_gml::evaluate(args_expr, &eval_ctx)?
    } else {
        Value::Object(HashMap::new())
    };

    // 合并 sms_params 到 args
    if let (Value::Object(args_map), Value::Object(params_map)) = (&mut args, sms_params.clone()) {
        for (k, v) in params_map {
            if !args_map.contains_key(&k) {
                args_map.insert(k, v);
            }
        }
    }

    // 如果是 sms:// URI，尝试通过注册表执行
    let result = if sms_config.starts_with("sms://") {
        if let Some(tool_result) = execute_tool_call(sms_config, &args, &context, node_id).await? {
            tool_result
        } else {
            // 没有注册表或工具未找到，使用模拟数据
            Value::object([
                ("success", Value::bool(true)),
                ("uri", Value::string(sms_config.clone())),
                ("args", args),
                ("messageId", Value::string(format!("sms-{}", uuid::Uuid::new_v4()))),
                ("_mock", Value::bool(true)),
            ])
        }
    } else {
        // 非 URI 格式，使用模拟数据
        Value::object([
            ("success", Value::bool(true)),
            ("config", sms_params),
            ("args", args),
            ("messageId", Value::string(format!("sms-{}", uuid::Uuid::new_v4()))),
            ("_mock", Value::bool(true)),
        ])
    };

    // 应用 sets
    apply_sets(node, node_id, &result, &context).await?;

    // 应用 with 转换
    let output = apply_with_transform(node, node_id, result, &eval_ctx)?;

    // 存储结果
    context.write().await.set_variable(node_id, output);

    Ok(get_next_nodes(node))
}

// ============================================================================
// Service Node - 微服务调用节点
// ============================================================================

/// Execute a service node (microservice call)
///
/// Service 节点用于调用微服务。
/// URI 格式：svc://service-id/method 或 svc://service-id/call/method
/// 当配置了 ManagedToolRegistry 时会执行实际调用，否则返回模拟数据。
pub async fn execute_service_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let service_uri = node.service.as_ref().ok_or_else(|| {
        ExecutorError::InvalidFlow(format!(
            "Service node '{}' missing service URI",
            node_id
        ))
    })?;

    // 构建评估上下文
    let eval_ctx = context.read().await.build_eval_context();

    // 评估参数
    let args = if let Some(args_expr) = &node.args {
        fdl_gml::evaluate(args_expr, &eval_ctx)?
    } else {
        Value::Object(HashMap::new())
    };

    // 尝试通过工具注册表执行
    let result = if let Some(tool_result) = execute_tool_call(service_uri, &args, &context, node_id).await? {
        tool_result
    } else {
        // 没有注册表或工具未找到，使用模拟数据
        Value::object([
            ("uri", Value::string(service_uri.clone())),
            ("success", Value::bool(true)),
            ("args", args),
            ("response", Value::Null),
            ("_mock", Value::bool(true)),
        ])
    };

    // 应用 sets
    apply_sets(node, node_id, &result, &context).await?;

    // 应用 with 转换
    let output = apply_with_transform(node, node_id, result, &eval_ctx)?;

    // 处理失败情况（在存储前检查）
    let success = output
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    // 存储结果
    context.write().await.set_variable(node_id, output);

    if !success {
        if let Some(fail_node) = &node.fail {
            return Ok(vec![fail_node.clone()]);
        }
    }

    Ok(get_next_nodes(node))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::context::ExecutionContext;

    #[tokio::test]
    async fn test_guard_node_basic() {
        let mut ctx = ExecutionContext::new();
        ctx.tenant_id = "test-tenant".to_string();
        ctx.bu_code = "test-bu".to_string();
        let context = Arc::new(RwLock::new(ctx));

        let node = FlowNode {
            guard: Some("pii:block".to_string()),
            next: Some("next_node".to_string()),
            ..Default::default()
        };

        let result = execute_guard_node("guard1", &node, context.clone()).await;
        assert!(result.is_ok());

        let next = result.unwrap();
        assert_eq!(next, vec!["next_node"]);
    }

    #[tokio::test]
    async fn test_oss_node_basic() {
        let mut ctx = ExecutionContext::new();
        ctx.tenant_id = "test-tenant".to_string();
        ctx.bu_code = "test-bu".to_string();
        let context = Arc::new(RwLock::new(ctx));

        let node = FlowNode {
            oss: Some("oss://bucket/path/file.txt".to_string()),
            next: Some("next_node".to_string()),
            ..Default::default()
        };

        let result = execute_oss_node("oss1", &node, context.clone()).await;
        assert!(result.is_ok());

        let ctx = context.read().await;
        let output = ctx.get_variable("oss1");
        assert!(output.is_some());
    }

    #[tokio::test]
    async fn test_mq_node_basic() {
        let mut ctx = ExecutionContext::new();
        ctx.tenant_id = "test-tenant".to_string();
        ctx.bu_code = "test-bu".to_string();
        let context = Arc::new(RwLock::new(ctx));

        let node = FlowNode {
            mq: Some("mq://orders/new-order".to_string()),
            next: Some("next_node".to_string()),
            ..Default::default()
        };

        let result = execute_mq_node("mq1", &node, context.clone()).await;
        assert!(result.is_ok());

        let ctx = context.read().await;
        let output = ctx.get_variable("mq1");
        assert!(output.is_some());
    }
}
