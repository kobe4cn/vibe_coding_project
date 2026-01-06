//! 流程执行路由模块
//!
//! 本模块提供流程执行的 HTTP API 端点，支持三种执行模式：
//! 1. 通过流程 ID 执行（使用最新版本）
//! 2. 执行指定版本（用于版本回滚和测试）
//! 3. 直接执行（无需存储，用于临时测试）
//!
//! 设计要点：
//! - 同步和异步执行模式分离，避免长时间运行阻塞 HTTP 连接
//! - 统一的内部执行逻辑，减少代码重复
//! - 执行状态管理，支持查询和取消操作
//! - 多租户隔离，通过 tenant_id 确保数据安全

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use fdl_executor::Executor;
use fdl_gml::Value;
use fdl_tools::{ManagedToolRegistry, ToolContext};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;

use crate::converter::{ExecutionResult, FrontendFlow, convert_frontend_to_executor};
use crate::state::{AppState, ExecutionStatus as ExecStatus};

/// 执行流程请求
///
/// 用于通过流程 ID 或版本 ID 执行已存储的流程。
/// 所有字段都设置了默认值，确保向后兼容和可选参数支持。
#[derive(Deserialize)]
pub struct ExecuteRequest {
    /// 流程输入参数，以 JSON 对象形式传递
    /// 使用 default 确保即使不提供也能正常解析
    #[serde(default)]
    pub inputs: serde_json::Value,
    /// 是否异步执行：true 时立即返回执行 ID，false 时等待执行完成
    /// 异步模式适用于长时间运行的流程，避免 HTTP 连接超时
    #[serde(default)]
    pub async_mode: bool,
    /// 租户 ID，用于多租户隔离
    /// 默认值为 "default"，允许单租户场景下不显式指定
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// 默认租户 ID 生成函数
///
/// 用于 serde 的 default 函数，确保在没有提供 tenant_id 时使用默认值。
/// 这样设计是为了支持单租户场景，同时保持多租户架构的灵活性。
fn default_tenant() -> String {
    "default".to_string()
}

/// 直接执行请求（无需存储流程）
///
/// 与 ExecuteRequest 的区别在于包含完整的流程定义，而不是通过 ID 引用。
/// 这种设计允许：
/// 1. 临时测试流程，无需先保存
/// 2. 执行外部传入的流程定义
/// 3. 支持流程编辑器的实时预览功能
#[derive(Deserialize)]
pub struct ExecuteWithFlowRequest {
    /// 前端格式的流程定义（React Flow 格式）
    /// 必须提供，因为这是直接执行模式的核心数据
    pub flow: FrontendFlow,
    /// 流程输入参数
    #[serde(default)]
    pub inputs: serde_json::Value,
    /// 是否异步执行
    #[serde(default)]
    pub async_mode: bool,
    /// 租户 ID，用于执行状态隔离
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// 执行查询参数
///
/// 用于列表查询接口，通过租户 ID 过滤执行记录。
/// 这是多租户架构的关键设计，确保用户只能看到自己租户的执行记录。
#[derive(Deserialize)]
pub struct ExecutionQuery {
    /// 租户 ID，用于过滤执行记录
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// 执行状态响应
///
/// 提供执行过程的完整状态信息，支持前端实时更新执行进度。
/// 设计考虑：
/// - progress 使用 f32 表示 0.0-1.0 的进度，便于显示进度条
/// - current_node 为可选，因为某些阶段可能没有明确的当前节点
/// - result 和 error 互斥，但都设为可选以支持中间状态查询
#[derive(Serialize)]
pub struct ExecutionStatusResponse {
    pub execution_id: String,
    pub flow_id: String,
    /// 执行状态：running, completed, failed, cancelled
    pub status: String,
    /// 执行进度，范围 0.0-1.0
    pub progress: f32,
    /// 当前正在执行的节点 ID（如果可用）
    pub current_node: Option<String>,
    /// 执行结果（仅在完成时可用）
    pub result: Option<serde_json::Value>,
    /// 错误信息（仅在失败时可用）
    pub error: Option<String>,
    /// 开始时间，ISO 8601 格式
    pub started_at: String,
    /// 完成时间，ISO 8601 格式（仅在完成或失败时可用）
    pub completed_at: Option<String>,
}

/// 构建执行相关的路由
///
/// 路由设计遵循 RESTful 原则：
/// - POST 用于创建执行（幂等性由业务逻辑保证）
/// - GET 用于查询状态和列表
/// - 路径参数用于资源标识，查询参数用于过滤
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        // 通过流程 ID 执行（使用最新版本）
        // 这是最常见的执行方式，适用于生产环境
        .route("/{flow_id}", post(execute_flow))
        // 执行指定版本
        // 用于版本回滚、A/B 测试或特定版本验证
        .route("/{flow_id}/version/{version_id}", post(execute_version))
        // 直接执行（无需存储）
        // 用于临时测试和流程编辑器预览
        .route("/run", post(execute_direct))
        // 状态查询和控制
        .route("/status/{execution_id}", get(get_status))
        .route("/cancel/{execution_id}", post(cancel_execution))
        .route("/list", get(list_executions))
}

/// 通过流程 ID 执行已存储的流程
///
/// 执行流程：
/// 1. 验证流程存在性（包含租户隔离检查）
/// 2. 获取最新版本（确保执行的是最新代码）
/// 3. 解析流程数据（处理可能的序列化错误）
/// 4. 调用内部执行逻辑
///
/// 错误处理策略：
/// - NOT_FOUND: 流程不存在或租户不匹配（不泄露租户信息）
/// - BAD_REQUEST: 流程存在但没有版本（数据不一致状态）
/// - INTERNAL_SERVER_ERROR: 数据库错误或数据格式错误
async fn execute_flow(
    State(state): State<Arc<AppState>>,
    Path(flow_id): Path<String>,
    Json(req): Json<ExecuteRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // 检查流程是否存在，同时验证租户权限
    // 如果流程不存在或不属于该租户，返回 NOT_FOUND（不区分以保护租户信息）
    let flow_entry = match state.get_flow(&req.tenant_id, &flow_id).await {
        Ok(f) => f,
        Err(_) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Flow not found"})),
            ));
        }
    };

    // 获取最新版本
    // 使用最新版本确保执行的是最新代码，这是生产环境的默认行为
    // 如果需要执行特定版本，应使用 execute_version 接口
    let version = match state.get_latest_version(&req.tenant_id, &flow_id).await {
        Ok(Some(v)) => v,
        Ok(None) => {
            // 流程存在但没有版本，这是数据不一致的状态
            // 可能发生在流程刚创建但还未保存版本时
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Flow has no versions"})),
            ));
        }
        Err(e) => {
            // 数据库查询错误，返回内部错误
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to get version: {}", e)})),
            ));
        }
    };

    // 从版本数据中解析流程定义
    // 版本数据以 JSON 格式存储，需要反序列化为 FrontendFlow
    // 如果数据格式不匹配，说明版本数据已损坏
    let frontend_flow: FrontendFlow = match serde_json::from_value(version.data.clone()) {
        Ok(f) => f,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Invalid flow data: {}", e)})),
            ));
        }
    };

    // 调用统一的内部执行逻辑
    execute_flow_internal(state, flow_id, flow_entry.name, frontend_flow, req).await
}

/// 执行指定版本的流程
///
/// 与 execute_flow 的区别：
/// - 执行特定版本而非最新版本
/// - 用于版本回滚、A/B 测试、历史版本验证等场景
///
/// 设计考虑：
/// - 仍然需要验证流程存在性，确保版本属于正确的流程
/// - 版本 ID 必须精确匹配，不支持模糊查询
async fn execute_version(
    State(state): State<Arc<AppState>>,
    Path((flow_id, version_id)): Path<(String, String)>,
    Json(req): Json<ExecuteRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // 验证流程存在性，确保版本查询的上下文正确
    // 即使版本 ID 正确，如果流程不存在，也应该返回流程未找到
    let flow_entry = match state.get_flow(&req.tenant_id, &flow_id).await {
        Ok(f) => f,
        Err(_) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Flow not found"})),
            ));
        }
    };

    // 获取指定版本
    // 版本 ID 必须精确匹配，且必须属于指定的流程和租户
    let version = match state
        .get_version(&req.tenant_id, &flow_id, &version_id)
        .await
    {
        Ok(v) => v,
        Err(_) => {
            // 版本不存在或不属于该流程/租户
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Version not found"})),
            ));
        }
    };

    // 解析流程数据（与 execute_flow 相同的逻辑）
    let frontend_flow: FrontendFlow = match serde_json::from_value(version.data.clone()) {
        Ok(f) => f,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Invalid flow data: {}", e)})),
            ));
        }
    };

    execute_flow_internal(state, flow_id, flow_entry.name, frontend_flow, req).await
}

/// 直接执行流程（无需存储）
///
/// 设计目的：
/// 1. 支持流程编辑器的实时预览功能
/// 2. 允许临时测试流程，无需先保存
/// 3. 支持执行外部传入的流程定义
///
/// 实现细节：
/// - 使用 "direct" 作为 flow_id，标识这是临时执行
/// - 流程定义直接从请求中获取，不查询数据库
/// - 执行状态仍然会被记录，但不会持久化流程定义
async fn execute_direct(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteWithFlowRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // 从流程元数据中提取名称，用于响应和日志
    let flow_name = req.flow.meta.name.clone();
    // 转换为统一的 ExecuteRequest 格式，复用内部执行逻辑
    let execute_req = ExecuteRequest {
        inputs: req.inputs,
        async_mode: req.async_mode,
        tenant_id: req.tenant_id,
    };

    // 使用 "direct" 作为 flow_id，标识这是临时执行
    // 这样设计可以区分存储执行和直接执行，便于监控和调试
    execute_flow_internal(
        state,
        "direct".to_string(),
        flow_name,
        req.flow,
        execute_req,
    )
    .await
}

/// 内部流程执行逻辑（统一入口）
///
/// 这是所有执行路径的统一实现，确保执行逻辑的一致性。
/// 设计要点：
/// 1. 格式转换：前端格式 -> 执行器格式，输入 JSON -> GML Value
/// 2. 状态管理：创建执行记录、注册执行器、更新状态
/// 3. 执行模式：同步（阻塞等待）和异步（后台执行）两种模式
///
/// 同步 vs 异步模式的选择：
/// - 同步：适用于快速执行的流程，客户端需要立即得到结果
/// - 异步：适用于长时间运行的流程，避免 HTTP 连接超时
async fn execute_flow_internal(
    state: Arc<AppState>,
    flow_id: String,
    flow_name: String,
    frontend_flow: FrontendFlow,
    req: ExecuteRequest,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // 将前端格式的流程转换为执行器格式
    // 前端使用 React Flow 格式（便于可视化编辑），执行器使用内部格式（便于执行）
    let executor_flow = convert_frontend_to_executor(&frontend_flow);
    tracing::debug!(
        "Executing flow '{}' with {} nodes",
        flow_name,
        executor_flow.nodes.len()
    );

    // 创建执行状态记录
    // 执行状态用于跟踪执行进度，支持查询和取消操作
    let exec_state = state.create_execution(&flow_id, &req.tenant_id);
    let execution_id = exec_state.execution_id.clone();

    // 创建工具上下文（包含租户 ID 和业务单元代码）
    let tool_context = ToolContext {
        tenant_id: req.tenant_id.clone(),
        bu_code: "default".to_string(), // TODO: 从请求或配置中获取
        timeout_ms: 30000,
        metadata: std::collections::HashMap::new(),
    };

    // 创建执行器实例，使用 ManagedToolRegistry 支持动态工具配置
    // ManagedToolRegistry 通过 ConfigStore 解析 api:// 和 db:// URI
    let managed_registry = Arc::new(ManagedToolRegistry::new(state.config_store_arc()));
    let executor = Arc::new(
        Executor::with_managed_registry(managed_registry)
            .with_tool_context(tool_context)
    );
    state.register_executor(&execution_id, executor.clone());

    // 更新执行状态为运行中
    // 初始进度为 0.0，表示刚刚开始
    state.update_execution(&execution_id, ExecStatus::Running, 0.0, None);

    // 将 JSON 格式的输入转换为 GML Value 格式
    // GML 是执行器的内部数据格式，支持更丰富的数据类型
    let inputs = json_to_gml_value(&req.inputs);

    if req.async_mode {
        // 异步执行模式：在后台任务中执行，立即返回执行 ID
        // 这种设计避免长时间运行的流程阻塞 HTTP 连接
        let state_clone = state.clone();
        let execution_id_clone = execution_id.clone();

        tokio::spawn(async move {
            let start = Instant::now();
            match executor.execute(&executor_flow, inputs).await {
                Ok(_result) => {
                    // 执行成功，更新状态为完成
                    state_clone.update_execution(
                        &execution_id_clone,
                        ExecStatus::Completed,
                        1.0,
                        None,
                    );
                    tracing::info!(
                        "Flow {} completed in {:?}",
                        execution_id_clone,
                        start.elapsed()
                    );
                }
                Err(e) => {
                    // 执行失败，记录错误信息
                    state_clone.fail_execution(&execution_id_clone, &e.to_string());
                    tracing::error!("Flow {} failed: {}", execution_id_clone, e);
                }
            }
            // 执行完成后清理执行器，释放资源
            state_clone.remove_executor(&execution_id_clone);
        });

        // 异步模式下返回 202 Accepted，表示请求已接受但未完成
        Ok((
            StatusCode::ACCEPTED,
            Json(serde_json::json!({
                "execution_id": execution_id,
                "flow_id": flow_id,
                "flow_name": flow_name,
                "status": "running",
                "message": "Execution started in async mode"
            })),
        ))
    } else {
        // 同步执行模式：等待执行完成后再返回结果
        // 适用于快速执行的流程，客户端需要立即得到结果
        let start = Instant::now();
        let result = executor.execute(&executor_flow, inputs).await;
        let duration_ms = start.elapsed().as_millis() as u64;

        // 同步执行完成后立即清理执行器
        state.remove_executor(&execution_id);

        match result {
            Ok(value) => {
                // 执行成功：转换输出格式并返回结果
                let raw_outputs = gml_value_to_json(&value);
                // 过滤系统变量，只返回节点结果
                let outputs = filter_system_vars(&raw_outputs);
                state.update_execution(&execution_id, ExecStatus::Completed, 1.0, None);

                Ok((
                    StatusCode::OK,
                    Json(serde_json::json!({
                        "execution_id": execution_id,
                        "flow_id": flow_id,
                        "flow_name": flow_name,
                        "status": "completed",
                        "result": ExecutionResult {
                            success: true,
                            outputs: outputs.clone(),
                            // 从输出中提取每个节点的结果，便于前端展示
                            node_results: extract_node_results(&raw_outputs),
                            error: None,
                            duration_ms,
                        }
                    })),
                ))
            }
            Err(e) => {
                // 执行失败：记录错误信息，但仍返回 200 OK
                // 使用 200 而不是 500，因为这是业务逻辑错误，不是服务器错误
                let error_msg = e.to_string();
                state.fail_execution(&execution_id, &error_msg);

                Ok((
                    StatusCode::OK,
                    Json(serde_json::json!({
                        "execution_id": execution_id,
                        "flow_id": flow_id,
                        "flow_name": flow_name,
                        "status": "failed",
                        "result": ExecutionResult {
                            success: false,
                            outputs: serde_json::Value::Null,
                            node_results: std::collections::HashMap::new(),
                            error: Some(error_msg),
                            duration_ms,
                        }
                    })),
                ))
            }
        }
    }
}

/// 获取执行状态
///
/// 用于查询异步执行的进度和结果。
/// 设计考虑：
/// - 不进行租户验证，因为 execution_id 本身已经包含了租户信息（通过创建时的隔离）
/// - 返回标准化的状态响应，便于前端统一处理
/// - 时间戳使用 ISO 8601 格式，便于跨时区处理
async fn get_status(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<ExecutionStatusResponse>, StatusCode> {
    match state.get_execution(&execution_id) {
        Some(exec) => Ok(Json(ExecutionStatusResponse {
            execution_id: exec.execution_id,
            flow_id: exec.flow_id,
            // 将枚举格式化为小写字符串，便于前端使用
            status: format!("{:?}", exec.status).to_lowercase(),
            progress: exec.progress,
            current_node: exec.current_node,
            // TODO: 当前结果未存储在执行状态中，需要从执行器获取
            // 这限制了异步执行后查询结果的能力
            result: None,
            error: exec.error,
            // 使用 RFC 3339 格式（ISO 8601 的子集），确保时间戳的可读性和标准化
            started_at: exec.started_at.to_rfc3339(),
            completed_at: exec.completed_at.map(|t| t.to_rfc3339()),
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// 取消执行
///
/// 取消正在运行的执行。设计要点：
/// 1. 仅更新状态为取消，不强制终止执行器（优雅取消）
/// 2. 移除执行器注册，释放资源
/// 3. 已完成的执行无法取消（幂等操作）
///
/// 限制：
/// - 当前实现是"软取消"，仅标记状态，不强制终止
/// - 执行器需要主动检查取消状态才能响应取消请求
async fn cancel_execution(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 验证执行是否存在
    if state.get_execution(&execution_id).is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // 更新状态为已取消
    // 进度保持为 0.0，因为取消时可能还未开始或刚开始
    state.update_execution(&execution_id, ExecStatus::Cancelled, 0.0, None);
    // 移除执行器注册，释放资源
    // 注意：这不会强制终止正在运行的执行，执行器需要检查状态来响应取消
    state.remove_executor(&execution_id);

    Ok(Json(serde_json::json!({
        "execution_id": execution_id,
        "status": "cancelled"
    })))
}

/// 列出执行记录
///
/// 返回指定租户的所有执行记录。
/// 设计考虑：
/// - 通过租户 ID 过滤，确保多租户隔离
/// - 返回简化的执行信息，不包含完整的执行结果（减少响应大小）
/// - 当前实现基于内存状态，仅返回当前运行时的执行记录
///
/// 限制：
/// - 不包含历史执行记录（需要持久化存储）
/// - 没有分页支持（如果执行记录很多，可能影响性能）
async fn list_executions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ExecutionQuery>,
) -> Json<serde_json::Value> {
    // 过滤并转换执行记录
    // 只返回属于指定租户的执行，确保多租户隔离
    let executions: Vec<serde_json::Value> = state
        .executions
        .iter()
        .filter(|e| e.tenant_id == query.tenant_id)
        .map(|e| {
            serde_json::json!({
                "execution_id": e.execution_id,
                "flow_id": e.flow_id,
                "status": format!("{:?}", e.status).to_lowercase(),
                "progress": e.progress,
                "started_at": e.started_at.to_rfc3339(),
                "completed_at": e.completed_at.map(|t| t.to_rfc3339())
            })
        })
        .collect();

    Json(serde_json::json!({
        "executions": executions,
        "total": executions.len()
    }))
}

/// 将 JSON 值转换为 GML Value
///
/// GML（Graph Manipulation Language）是执行器的内部数据格式。
/// 转换规则：
/// - 基本类型（null, bool, string）直接映射
/// - 数字优先尝试转换为整数，失败则转为浮点数，都失败则转为 null
/// - 数组和对象递归转换
///
/// 设计原因：
/// - JSON 的数字类型是统一的 Number，需要根据值判断是整数还是浮点数
/// - GML 区分 Int 和 Float，提供更精确的类型信息
fn json_to_gml_value(json: &serde_json::Value) -> Value {
    match json {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Bool(*b),
        serde_json::Value::Number(n) => {
            // JSON 数字可能是整数或浮点数，需要尝试两种转换
            // 优先尝试整数（更精确），失败则尝试浮点数
            if let Some(i) = n.as_i64() {
                Value::Int(i)
            } else if let Some(f) = n.as_f64() {
                Value::Float(f)
            } else {
                // 理论上不会到达这里，但为了类型安全保留
                Value::Null
            }
        }
        serde_json::Value::String(s) => Value::String(s.clone()),
        // 数组递归转换每个元素
        serde_json::Value::Array(arr) => Value::Array(arr.iter().map(json_to_gml_value).collect()),
        // 对象转换为 HashMap，递归转换每个值
        serde_json::Value::Object(obj) => {
            let map: std::collections::HashMap<String, Value> = obj
                .iter()
                .map(|(k, v)| (k.clone(), json_to_gml_value(v)))
                .collect();
            Value::Object(map)
        }
    }
}

/// 将 GML Value 转换为 JSON 值
///
/// 这是 json_to_gml_value 的逆操作，用于将执行结果返回给客户端。
/// 转换规则：
/// - 基本类型直接映射
/// - Int 和 Float 都转换为 JSON Number（JSON 不区分整数和浮点数）
/// - 数组和对象递归转换
///
/// 注意：GML 的 Int 和 Float 在 JSON 中都表示为 Number，
/// 这是 JSON 格式的限制，但通常不影响使用。
fn gml_value_to_json(value: &Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Bool(b) => serde_json::Value::Bool(*b),
        // 使用 json! 宏自动处理整数和浮点数的序列化
        Value::Int(i) => serde_json::json!(*i),
        Value::Float(f) => serde_json::json!(*f),
        Value::String(s) => serde_json::Value::String(s.clone()),
        // 数组递归转换每个元素
        Value::Array(arr) => serde_json::Value::Array(arr.iter().map(gml_value_to_json).collect()),
        // 对象转换为 JSON Object，递归转换每个值
        Value::Object(obj) => {
            let map: serde_json::Map<String, serde_json::Value> = obj
                .iter()
                .map(|(k, v)| (k.clone(), gml_value_to_json(v)))
                .collect();
            serde_json::Value::Object(map)
        }
    }
}

/// 从执行输出中提取每个节点的结果
///
/// 系统内部变量，不应该出现在节点结果中
const SYSTEM_VARS: &[&str] = &["buCode", "tenantId"];

/// 执行器的输出通常是一个对象，其中键是节点 ID，值是该节点的输出。
/// 这个函数将输出对象转换为 HashMap，便于前端按节点展示结果。
///
/// 设计考虑：
/// - 过滤掉系统变量（buCode, tenantId），只返回节点结果
/// - 如果输出不是对象（如单个值或数组），返回空 HashMap
/// - 这允许执行器返回不同格式的输出，同时保持接口的灵活性
fn extract_node_results(
    outputs: &serde_json::Value,
) -> std::collections::HashMap<String, serde_json::Value> {
    match outputs {
        // 输出是对象时，过滤系统变量后转换为 HashMap
        serde_json::Value::Object(obj) => obj
            .iter()
            .filter(|(k, _)| !SYSTEM_VARS.contains(&k.as_str()))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect(),
        // 输出不是对象时，返回空 HashMap
        _ => std::collections::HashMap::new(),
    }
}

/// 过滤系统变量，返回干净的输出结果
fn filter_system_vars(outputs: &serde_json::Value) -> serde_json::Value {
    match outputs {
        serde_json::Value::Object(obj) => {
            let filtered: serde_json::Map<String, serde_json::Value> = obj
                .iter()
                .filter(|(k, _)| !SYSTEM_VARS.contains(&k.as_str()))
                .map(|(k, v)| (k.clone(), v.clone()))
                .collect();
            serde_json::Value::Object(filtered)
        }
        other => other.clone(),
    }
}
