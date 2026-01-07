//! 外部 API 调用端点
//!
//! 提供外部系统调用已发布流程的能力：
//! - 外部执行端点：使用 API Key 认证执行流程
//! - Webhook 端点：接收外部事件触发流程
//!
//! 所有操作都需要有效的 API Key 认证。

use crate::converter::FrontendFlow;
use crate::state::{AppState, ExecutionStatus as ExecStatus};
use axum::{
    Json, Router,
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::post,
};
use fdl_auth::{hash_api_key, extract_api_key};
use fdl_executor::Executor;
use fdl_gml::Value;
use fdl_tools::{ManagedToolRegistry, ToolContext};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;

/// 外部执行请求
#[derive(Deserialize)]
pub struct ExternalExecuteRequest {
    /// 输入参数
    #[serde(default)]
    pub inputs: serde_json::Value,
    /// 是否等待执行完成（默认 false，异步执行）
    #[serde(default)]
    pub wait: bool,
    /// 等待超时（秒，最大 300）
    #[serde(default = "default_timeout")]
    pub timeout: u32,
}

fn default_timeout() -> u32 {
    30
}

/// 执行响应
#[derive(Serialize)]
pub struct ExecuteResponse {
    pub execution_id: String,
    pub status: String,
    pub outputs: Option<serde_json::Value>,
    pub error: Option<String>,
    pub duration_ms: Option<u64>,
}

/// Webhook 请求
#[derive(Deserialize)]
pub struct WebhookRequest {
    /// 事件类型
    pub event: String,
    /// 事件数据
    pub data: serde_json::Value,
}

/// Webhook 响应
#[derive(Serialize)]
pub struct WebhookResponse {
    pub received: bool,
    pub execution_id: Option<String>,
    pub message: String,
}

/// 构建外部 API 路由
///
/// 路由设计：
/// - /v1/flows/{flow_id}/execute - 使用 API Key 执行已发布流程
/// - /v1/webhook/{flow_id} - 接收 Webhook 事件
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/flows/{flow_id}/execute", post(external_execute))
        .route("/webhook/{flow_id}", post(webhook))
}

/// 外部执行端点
///
/// 使用 API Key 认证执行已发布的流程。
async fn external_execute(
    State(state): State<Arc<AppState>>,
    Path(flow_id): Path<String>,
    headers: HeaderMap,
    Json(req): Json<ExternalExecuteRequest>,
) -> Result<Json<ExecuteResponse>, (StatusCode, Json<serde_json::Value>)> {
    // 提取并验证 API Key
    let api_key = extract_api_key(&headers).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "API key is required",
                "code": "missing_api_key"
            })),
        )
    })?;

    let key_hash = hash_api_key(&api_key);
    let api_key_record = state
        .storage
        .as_flow_storage()
        .get_api_key_by_hash(&key_hash)
        .await
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Invalid API key",
                    "code": "invalid_api_key"
                })),
            )
        })?;

    // 验证 Key 是否激活
    if !api_key_record.is_active {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "API key is inactive",
                "code": "key_inactive"
            })),
        ));
    }

    // 验证流程 ID 匹配
    if api_key_record.flow_id.to_string() != flow_id {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "API key is not authorized for this flow",
                "code": "flow_mismatch"
            })),
        ));
    }

    let tenant_id = api_key_record.tenant_id.to_string();

    // 获取流程信息
    let flow = state
        .get_flow(&tenant_id, &flow_id)
        .await
        .map_err(|_| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Flow not found",
                    "code": "flow_not_found"
                })),
            )
        })?;

    // 检查流程是否已发布
    if !flow.published {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "Flow is not published",
                "code": "flow_not_published"
            })),
        ));
    }

    // 获取已发布版本
    let version_id = flow.published_version_id.ok_or_else(|| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": "Published version not found",
                "code": "version_not_found"
            })),
        )
    })?;

    let version = state
        .get_version(&tenant_id, &flow_id, &version_id.to_string())
        .await
        .map_err(|_| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Version not found",
                    "code": "version_not_found"
                })),
            )
        })?;

    // 解析流程数据
    let frontend_flow: FrontendFlow = serde_json::from_value(version.data.clone())
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": format!("Invalid flow data: {}", e),
                    "code": "invalid_flow_data"
                })),
            )
        })?;

    // 记录 API Key 使用
    let _ = state
        .storage
        .as_flow_storage()
        .update_api_key_usage(api_key_record.id)
        .await;

    // 创建执行状态
    let exec_state = state.create_execution(&flow_id, &tenant_id);
    let execution_id = exec_state.execution_id.clone();

    // 执行流程
    execute_flow(
        state,
        execution_id,
        flow_id,
        tenant_id,
        frontend_flow,
        req.inputs,
        req.wait,
    )
    .await
}

/// Webhook 端点
///
/// 接收外部事件并触发流程执行。
async fn webhook(
    State(state): State<Arc<AppState>>,
    Path(flow_id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<WebhookResponse>, (StatusCode, Json<serde_json::Value>)> {
    // 提取并验证 API Key
    let api_key = extract_api_key(&headers).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "API key is required",
                "code": "missing_api_key"
            })),
        )
    })?;

    let key_hash = hash_api_key(&api_key);
    let api_key_record = state
        .storage
        .as_flow_storage()
        .get_api_key_by_hash(&key_hash)
        .await
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "Invalid API key",
                    "code": "invalid_api_key"
                })),
            )
        })?;

    // 验证流程匹配
    if api_key_record.flow_id.to_string() != flow_id {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "API key is not authorized for this flow",
                "code": "flow_mismatch"
            })),
        ));
    }

    // 解析请求体
    let webhook_req: WebhookRequest = serde_json::from_slice(&body).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": format!("Invalid JSON: {}", e),
                "code": "invalid_json"
            })),
        )
    })?;

    let tenant_id = api_key_record.tenant_id.to_string();

    // 获取流程
    let flow = state.get_flow(&tenant_id, &flow_id).await.map_err(|_| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Flow not found",
                "code": "flow_not_found"
            })),
        )
    })?;

    // 检查流程是否已发布
    if !flow.published {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "Flow is not published",
                "code": "flow_not_published"
            })),
        ));
    }

    // 创建执行记录
    let exec_state = state.create_execution(&flow_id, &tenant_id);
    let execution_id = exec_state.execution_id.clone();

    // 准备输入：将 webhook 数据包装为输入
    let inputs = serde_json::json!({
        "webhook": {
            "event": webhook_req.event,
            "data": webhook_req.data
        }
    });

    // 异步执行
    if let Some(version_id) = flow.published_version_id {
        let state_clone = state.clone();
        let exec_id_clone = execution_id.clone();
        let tenant_clone = tenant_id.clone();
        let flow_id_clone = flow_id.clone();

        tokio::spawn(async move {
            if let Ok(version) = state_clone
                .get_version(&tenant_clone, &flow_id_clone, &version_id.to_string())
                .await
            {
                if let Ok(frontend_flow) = serde_json::from_value::<FrontendFlow>(version.data) {
                    let _ = execute_flow(
                        state_clone,
                        exec_id_clone,
                        flow_id_clone,
                        tenant_clone,
                        frontend_flow,
                        inputs,
                        false,
                    )
                    .await;
                }
            }
        });
    }

    // 记录 API Key 使用
    let _ = state
        .storage
        .as_flow_storage()
        .update_api_key_usage(api_key_record.id)
        .await;

    Ok(Json(WebhookResponse {
        received: true,
        execution_id: Some(execution_id),
        message: format!("Webhook received for event: {}", webhook_req.event),
    }))
}

/// 内部执行流程
async fn execute_flow(
    state: Arc<AppState>,
    execution_id: String,
    _flow_id: String,
    tenant_id: String,
    frontend_flow: FrontendFlow,
    inputs: serde_json::Value,
    wait: bool,
) -> Result<Json<ExecuteResponse>, (StatusCode, Json<serde_json::Value>)> {
    use crate::converter::{convert_frontend_to_executor, filter_output_by_definition};

    // 转换流程
    let executor_flow = convert_frontend_to_executor(&frontend_flow);

    // 创建工具上下文
    let tool_context = ToolContext {
        tenant_id: tenant_id.clone(),
        bu_code: "default".to_string(),
        timeout_ms: 30000,
        metadata: std::collections::HashMap::new(),
    };

    // 创建执行器
    let managed_registry = Arc::new(ManagedToolRegistry::new(state.config_store_arc()));
    let executor = Arc::new(
        Executor::with_managed_registry(managed_registry)
            .with_tool_context(tool_context)
    );

    state.register_executor(&execution_id, executor.clone());
    state.update_execution(&execution_id, ExecStatus::Running, 0.0, None);

    // 转换输入
    let gml_inputs = json_to_gml_value(&inputs);

    if !wait {
        // 异步模式
        let state_clone = state.clone();
        let exec_id_clone = execution_id.clone();

        tokio::spawn(async move {
            match executor.execute(&executor_flow, gml_inputs).await {
                Ok(_) => {
                    state_clone.update_execution(&exec_id_clone, ExecStatus::Completed, 1.0, None);
                }
                Err(e) => {
                    state_clone.fail_execution(&exec_id_clone, &e.to_string());
                }
            }
            state_clone.remove_executor(&exec_id_clone);
        });

        return Ok(Json(ExecuteResponse {
            execution_id,
            status: "running".to_string(),
            outputs: None,
            error: None,
            duration_ms: None,
        }));
    }

    // 同步模式
    let start = Instant::now();
    let result = executor.execute(&executor_flow, gml_inputs).await;
    let duration_ms = start.elapsed().as_millis() as u64;

    state.remove_executor(&execution_id);

    match result {
        Ok(value) => {
            state.update_execution(&execution_id, ExecStatus::Completed, 1.0, None);
            // 将执行上下文转换为 JSON，然后根据流程输出定义过滤
            let raw_outputs = gml_value_to_json(&value);
            let filtered_outputs = filter_output_by_definition(&frontend_flow, &raw_outputs);
            Ok(Json(ExecuteResponse {
                execution_id,
                status: "completed".to_string(),
                outputs: Some(filtered_outputs),
                error: None,
                duration_ms: Some(duration_ms),
            }))
        }
        Err(e) => {
            state.fail_execution(&execution_id, &e.to_string());
            Ok(Json(ExecuteResponse {
                execution_id,
                status: "failed".to_string(),
                outputs: None,
                error: Some(e.to_string()),
                duration_ms: Some(duration_ms),
            }))
        }
    }
}

/// JSON 转 GML Value
fn json_to_gml_value(json: &serde_json::Value) -> Value {
    match json {
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
        serde_json::Value::Array(arr) => Value::Array(arr.iter().map(json_to_gml_value).collect()),
        serde_json::Value::Object(obj) => {
            let map: std::collections::HashMap<String, Value> = obj
                .iter()
                .map(|(k, v)| (k.clone(), json_to_gml_value(v)))
                .collect();
            Value::Object(map)
        }
    }
}

/// GML Value 转 JSON
fn gml_value_to_json(value: &Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Bool(b) => serde_json::Value::Bool(*b),
        Value::Int(i) => serde_json::json!(*i),
        Value::Float(f) => serde_json::json!(*f),
        Value::String(s) => serde_json::Value::String(s.clone()),
        Value::Array(arr) => serde_json::Value::Array(arr.iter().map(gml_value_to_json).collect()),
        Value::Object(obj) => {
            let map: serde_json::Map<String, serde_json::Value> = obj
                .iter()
                .map(|(k, v)| (k.clone(), gml_value_to_json(v)))
                .collect();
            serde_json::Value::Object(map)
        }
    }
}
