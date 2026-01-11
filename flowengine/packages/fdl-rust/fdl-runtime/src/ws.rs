//! WebSocket 处理：实时执行更新
//!
//! 提供基于 WebSocket 的实时通信，支持：
//! - JSON-RPC 2.0 协议
//! - 执行事件订阅
//! - 双向通信（客户端请求 + 服务器推送）

use crate::jsonrpc::{JsonRpcRequest, JsonRpcResponse, RpcMethod};
use crate::state::AppState;
use axum::{
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tracing::{info, warn};

/// WebSocket 连接状态
///
/// 维护每个连接的状态信息，包括订阅的执行 ID 列表。
pub struct WsConnection {
    /// 连接 ID（用于日志和调试）
    pub id: String,
    /// 租户 ID（从认证中获取，用于多租户隔离）
    pub tenant_id: Option<String>,
    /// 订阅的执行 ID 集合（用于过滤推送事件）
    pub subscriptions: HashSet<String>,
}

/// Execution event for broadcast
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionEvent {
    /// Execution ID
    pub execution_id: String,
    /// Event type
    pub event_type: ExecutionEventType,
    /// Event data
    pub data: serde_json::Value,
    /// Timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Execution event types
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionEventType {
    Started,
    NodeStarted,
    NodeCompleted,
    NodeFailed,
    Progress,
    Completed,
    Failed,
    Cancelled,
}

impl ExecutionEvent {
    pub fn new(
        execution_id: &str,
        event_type: ExecutionEventType,
        data: serde_json::Value,
    ) -> Self {
        Self {
            execution_id: execution_id.to_string(),
            event_type,
            data,
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn to_notification(&self) -> JsonRpcResponse {
        JsonRpcResponse::success(
            None,
            serde_json::json!({
                "method": "execution.event",
                "params": self
            }),
        )
    }
}

/// WebSocket handler
pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// 处理 WebSocket 连接
///
/// 使用分离的发送和接收通道实现双向通信：
/// - 接收任务：处理客户端消息并生成响应
/// - 发送任务：将响应发送给客户端
///
/// 这种设计允许服务器主动推送事件（如执行更新）。
async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let conn_id = uuid::Uuid::new_v4().to_string();
    info!("WebSocket connection established: {}", conn_id);

    // 分离发送和接收通道
    let (mut sender, mut receiver) = socket.split();
    // 使用通道缓冲待发送的消息
    let (tx, mut rx) = mpsc::channel::<Message>(100);

    // 连接状态（共享，用于订阅管理）
    let conn_state = Arc::new(RwLock::new(WsConnection {
        id: conn_id.clone(),
        tenant_id: None,
        subscriptions: HashSet::new(),
    }));

    // 发送任务：从通道接收消息并发送到 WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // 接收任务：处理客户端消息
    while let Some(result) = receiver.next().await {
        match result {
            Ok(msg) => {
                // 处理消息并生成响应（如果有）
                if let Some(response) = process_message(msg, &state, &conn_state).await {
                    let json = serde_json::to_string(&response).unwrap_or_default();
                    // 通过通道发送响应（由发送任务处理）
                    if tx.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
            Err(e) => {
                warn!("WebSocket error: {}", e);
                break;
            }
        }
    }

    // 清理：中止发送任务
    send_task.abort();
    info!("WebSocket connection closed: {}", conn_id);
}

/// Process a WebSocket message
async fn process_message(
    msg: Message,
    state: &Arc<AppState>,
    conn_state: &Arc<RwLock<WsConnection>>,
) -> Option<JsonRpcResponse> {
    match msg {
        Message::Text(text) => {
            let text_str = text.to_string();
            match serde_json::from_str::<JsonRpcRequest>(&text_str) {
                Ok(request) => Some(handle_rpc_request(request, state, conn_state).await),
                Err(_) => Some(JsonRpcResponse::parse_error()),
            }
        }
        Message::Binary(data) => {
            // Try to parse as JSON-RPC
            match serde_json::from_slice::<JsonRpcRequest>(&data) {
                Ok(request) => Some(handle_rpc_request(request, state, conn_state).await),
                Err(_) => Some(JsonRpcResponse::parse_error()),
            }
        }
        Message::Ping(_) | Message::Pong(_) => None,
        Message::Close(_) => None,
    }
}

/// Handle a JSON-RPC request over WebSocket
async fn handle_rpc_request(
    request: JsonRpcRequest,
    state: &Arc<AppState>,
    conn_state: &Arc<RwLock<WsConnection>>,
) -> JsonRpcResponse {
    // Validate request
    if let Err(e) = request.validate() {
        return JsonRpcResponse::error(request.id, e);
    }

    let method = match RpcMethod::from_strs(&request.method) {
        Some(m) => m,
        None => return JsonRpcResponse::method_not_found(request.id, &request.method),
    };

    match method {
        RpcMethod::Subscribe => handle_subscribe(request, conn_state).await,
        RpcMethod::Unsubscribe => handle_unsubscribe(request, conn_state).await,
        RpcMethod::ExecuteStatus => handle_execute_status(request, state).await,
        RpcMethod::FlowList => handle_flow_list(request, state).await,
        RpcMethod::FlowGet => handle_flow_get(request, state).await,
        _ => JsonRpcResponse::method_not_found(request.id, &request.method),
    }
}

async fn handle_subscribe(
    request: JsonRpcRequest,
    conn_state: &Arc<RwLock<WsConnection>>,
) -> JsonRpcResponse {
    let params = request.params.unwrap_or_default();
    let execution_id = params
        .get("execution_id")
        .and_then(|v| v.as_str())
        .map(String::from);

    match execution_id {
        Some(id) => {
            let mut state = conn_state.write().await;
            state.subscriptions.insert(id.clone());
            JsonRpcResponse::success(
                request.id,
                serde_json::json!({
                    "subscribed": true,
                    "execution_id": id
                }),
            )
        }
        None => JsonRpcResponse::invalid_params(request.id, "Missing execution_id"),
    }
}

async fn handle_unsubscribe(
    request: JsonRpcRequest,
    conn_state: &Arc<RwLock<WsConnection>>,
) -> JsonRpcResponse {
    let params = request.params.unwrap_or_default();
    let execution_id = params
        .get("execution_id")
        .and_then(|v| v.as_str())
        .map(String::from);

    match execution_id {
        Some(id) => {
            let mut state = conn_state.write().await;
            state.subscriptions.remove(&id);
            JsonRpcResponse::success(
                request.id,
                serde_json::json!({
                    "unsubscribed": true,
                    "execution_id": id
                }),
            )
        }
        None => JsonRpcResponse::invalid_params(request.id, "Missing execution_id"),
    }
}

async fn handle_execute_status(request: JsonRpcRequest, state: &Arc<AppState>) -> JsonRpcResponse {
    let params = request.params.unwrap_or_default();
    let execution_id = params.get("execution_id").and_then(|v| v.as_str());

    match execution_id {
        Some(id) => {
            if state.get_executor(id).is_some() {
                JsonRpcResponse::success(
                    request.id,
                    serde_json::json!({
                        "execution_id": id,
                        "status": "running"
                    }),
                )
            } else {
                JsonRpcResponse::success(
                    request.id,
                    serde_json::json!({
                        "execution_id": id,
                        "status": "not_found"
                    }),
                )
            }
        }
        None => JsonRpcResponse::invalid_params(request.id, "Missing execution_id"),
    }
}

async fn handle_flow_list(request: JsonRpcRequest, _state: &Arc<AppState>) -> JsonRpcResponse {
    // Placeholder: return empty list
    JsonRpcResponse::success(
        request.id,
        serde_json::json!({
            "flows": [],
            "total": 0
        }),
    )
}

async fn handle_flow_get(request: JsonRpcRequest, _state: &Arc<AppState>) -> JsonRpcResponse {
    let params = request.params.unwrap_or_default();
    let flow_id = params.get("flow_id").and_then(|v| v.as_str());

    match flow_id {
        Some(id) => JsonRpcResponse::success(
            request.id,
            serde_json::json!({
                "id": id,
                "name": "Sample Flow",
                "description": null
            }),
        ),
        None => JsonRpcResponse::invalid_params(request.id, "Missing flow_id"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_execution_event_creation() {
        let event = ExecutionEvent::new(
            "exec-1",
            ExecutionEventType::Started,
            serde_json::json!({"node": "start"}),
        );
        assert_eq!(event.execution_id, "exec-1");
    }

    #[test]
    fn test_execution_event_to_notification() {
        let event = ExecutionEvent::new(
            "exec-1",
            ExecutionEventType::Progress,
            serde_json::json!({"progress": 0.5}),
        );
        let notification = event.to_notification();
        assert!(notification.result.is_some());
    }

    #[tokio::test]
    async fn test_ws_connection_subscriptions() {
        let conn = Arc::new(RwLock::new(WsConnection {
            id: "conn-1".to_string(),
            tenant_id: None,
            subscriptions: HashSet::new(),
        }));

        {
            let mut state = conn.write().await;
            state.subscriptions.insert("exec-1".to_string());
        }

        let state = conn.read().await;
        assert!(state.subscriptions.contains("exec-1"));
    }
}
