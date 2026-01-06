//! Flow execution routes

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use fdl_executor::Executor;
use fdl_gml::Value;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;

use crate::converter::{ExecutionResult, FrontendFlow, convert_frontend_to_executor};
use crate::state::{AppState, ExecutionStatus as ExecStatus};

/// Execute flow request
#[derive(Deserialize)]
pub struct ExecuteRequest {
    /// Input values for the flow
    #[serde(default)]
    pub inputs: serde_json::Value,
    /// Run in async mode (return immediately)
    #[serde(default)]
    pub async_mode: bool,
    /// Tenant ID
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_tenant() -> String {
    "default".to_string()
}

/// Execute with flow data (for direct execution)
#[derive(Deserialize)]
pub struct ExecuteWithFlowRequest {
    /// The flow definition (React Flow format)
    pub flow: FrontendFlow,
    /// Input values for the flow
    #[serde(default)]
    pub inputs: serde_json::Value,
    /// Run in async mode
    #[serde(default)]
    pub async_mode: bool,
    /// Tenant ID
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// Execution query parameters
#[derive(Deserialize)]
pub struct ExecutionQuery {
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// Execution status response
#[derive(Serialize)]
pub struct ExecutionStatusResponse {
    pub execution_id: String,
    pub flow_id: String,
    pub status: String,
    pub progress: f32,
    pub current_node: Option<String>,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

/// Build execution routes
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        // Execute flow by ID (uses stored version)
        .route("/{flow_id}", post(execute_flow))
        // Execute specific version
        .route("/{flow_id}/version/{version_id}", post(execute_version))
        // Execute with provided flow data (no storage needed)
        .route("/run", post(execute_direct))
        // Status and control
        .route("/status/{execution_id}", get(get_status))
        .route("/cancel/{execution_id}", post(cancel_execution))
        .route("/list", get(list_executions))
}

/// Execute a stored flow by ID
async fn execute_flow(
    State(state): State<Arc<AppState>>,
    Path(flow_id): Path<String>,
    Json(req): Json<ExecuteRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // Check if flow exists
    let flow_entry = match state.get_flow(&req.tenant_id, &flow_id).await {
        Ok(f) => f,
        Err(_) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Flow not found"})),
            ));
        }
    };

    // Get latest version
    let version = match state.get_latest_version(&req.tenant_id, &flow_id).await {
        Ok(Some(v)) => v,
        Ok(None) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Flow has no versions"})),
            ));
        }
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Failed to get version: {}", e)})),
            ));
        }
    };

    // Parse flow data from version
    let frontend_flow: FrontendFlow = match serde_json::from_value(version.data.clone()) {
        Ok(f) => f,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("Invalid flow data: {}", e)})),
            ));
        }
    };

    // Execute the flow
    execute_flow_internal(state, flow_id, flow_entry.name, frontend_flow, req).await
}

/// Execute a specific version
async fn execute_version(
    State(state): State<Arc<AppState>>,
    Path((flow_id, version_id)): Path<(String, String)>,
    Json(req): Json<ExecuteRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // Check if flow exists
    let flow_entry = match state.get_flow(&req.tenant_id, &flow_id).await {
        Ok(f) => f,
        Err(_) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Flow not found"})),
            ));
        }
    };

    // Get specific version
    let version = match state
        .get_version(&req.tenant_id, &flow_id, &version_id)
        .await
    {
        Ok(v) => v,
        Err(_) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Version not found"})),
            ));
        }
    };

    // Parse flow data
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

/// Execute a flow directly without storage
async fn execute_direct(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExecuteWithFlowRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    let flow_name = req.flow.meta.name.clone();
    let execute_req = ExecuteRequest {
        inputs: req.inputs,
        async_mode: req.async_mode,
        tenant_id: req.tenant_id,
    };

    execute_flow_internal(
        state,
        "direct".to_string(),
        flow_name,
        req.flow,
        execute_req,
    )
    .await
}

/// Internal flow execution logic
async fn execute_flow_internal(
    state: Arc<AppState>,
    flow_id: String,
    flow_name: String,
    frontend_flow: FrontendFlow,
    req: ExecuteRequest,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    // Convert frontend flow to executor format
    let executor_flow = convert_frontend_to_executor(&frontend_flow);

    // Create execution state
    let exec_state = state.create_execution(&flow_id, &req.tenant_id);
    let execution_id = exec_state.execution_id.clone();

    // Create executor
    let executor = Arc::new(Executor::new());
    state.register_executor(&execution_id, executor.clone());

    // Update execution to running
    state.update_execution(&execution_id, ExecStatus::Running, 0.0, None);

    // Convert inputs to GML Value
    let inputs = json_to_gml_value(&req.inputs);

    if req.async_mode {
        // Async execution - spawn and return immediately
        let state_clone = state.clone();
        let execution_id_clone = execution_id.clone();

        tokio::spawn(async move {
            let start = Instant::now();
            match executor.execute(&executor_flow, inputs).await {
                Ok(_result) => {
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
                    state_clone.fail_execution(&execution_id_clone, &e.to_string());
                    tracing::error!("Flow {} failed: {}", execution_id_clone, e);
                }
            }
            state_clone.remove_executor(&execution_id_clone);
        });

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
        // Synchronous execution - wait for result
        let start = Instant::now();
        let result = executor.execute(&executor_flow, inputs).await;
        let duration_ms = start.elapsed().as_millis() as u64;

        state.remove_executor(&execution_id);

        match result {
            Ok(value) => {
                let outputs = gml_value_to_json(&value);
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
                            node_results: extract_node_results(&outputs),
                            error: None,
                            duration_ms,
                        }
                    })),
                ))
            }
            Err(e) => {
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

/// Get execution status
async fn get_status(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<ExecutionStatusResponse>, StatusCode> {
    match state.get_execution(&execution_id) {
        Some(exec) => Ok(Json(ExecutionStatusResponse {
            execution_id: exec.execution_id,
            flow_id: exec.flow_id,
            status: format!("{:?}", exec.status).to_lowercase(),
            progress: exec.progress,
            current_node: exec.current_node,
            result: None, // TODO: Store result in execution state
            error: exec.error,
            started_at: exec.started_at.to_rfc3339(),
            completed_at: exec.completed_at.map(|t| t.to_rfc3339()),
        })),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Cancel an execution
async fn cancel_execution(
    State(state): State<Arc<AppState>>,
    Path(execution_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if state.get_execution(&execution_id).is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    state.update_execution(&execution_id, ExecStatus::Cancelled, 0.0, None);
    state.remove_executor(&execution_id);

    Ok(Json(serde_json::json!({
        "execution_id": execution_id,
        "status": "cancelled"
    })))
}

/// List executions
async fn list_executions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ExecutionQuery>,
) -> Json<serde_json::Value> {
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

/// Convert JSON to GML Value
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

/// Convert GML Value to JSON
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

/// Extract per-node results from execution output
fn extract_node_results(
    outputs: &serde_json::Value,
) -> std::collections::HashMap<String, serde_json::Value> {
    match outputs {
        serde_json::Value::Object(obj) => obj.clone().into_iter().collect(),
        _ => std::collections::HashMap::new(),
    }
}
