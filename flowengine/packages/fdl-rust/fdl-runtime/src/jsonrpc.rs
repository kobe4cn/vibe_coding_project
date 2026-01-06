//! JSON-RPC 2.0 协议实现
//!
//! 提供 JSON-RPC 2.0 标准的请求/响应处理，支持：
//! - 标准请求和通知（无 ID）
//! - 错误响应
//! - 批量请求（类型定义）

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JSON-RPC 版本号（必须为 "2.0"）
pub const JSONRPC_VERSION: &str = "2.0";

/// JSON-RPC 请求
/// 
/// 符合 JSON-RPC 2.0 规范的请求结构。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    /// JSON-RPC 版本（必须为 "2.0"）
    pub jsonrpc: String,
    /// 方法名
    pub method: String,
    /// 参数（可选）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
    /// 请求 ID（可选，无 ID 表示通知请求）
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<JsonRpcId>,
}

/// JSON-RPC ID (can be string, number, or null)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum JsonRpcId {
    String(String),
    Number(i64),
    Null,
}

/// JSON-RPC response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    /// JSON-RPC version
    pub jsonrpc: String,
    /// Result (present on success)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    /// Error (present on failure)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
    /// Request ID
    pub id: Option<JsonRpcId>,
}

/// JSON-RPC error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    /// Error code
    pub code: i32,
    /// Error message
    pub message: String,
    /// Additional data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// 标准 JSON-RPC 错误代码
/// 
/// 遵循 JSON-RPC 2.0 规范：
/// - -32700 到 -32603：标准错误代码
/// - -32000 到 -32099：自定义错误代码（保留范围）
pub mod error_codes {
    pub const PARSE_ERROR: i32 = -32700;
    pub const INVALID_REQUEST: i32 = -32600;
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS: i32 = -32602;
    pub const INTERNAL_ERROR: i32 = -32603;

    // 自定义错误代码（-32000 到 -32099 是保留范围）
    pub const EXECUTION_ERROR: i32 = -32000;
    pub const AUTH_ERROR: i32 = -32001;
    pub const NOT_FOUND: i32 = -32002;
    pub const VALIDATION_ERROR: i32 = -32003;
}

impl JsonRpcRequest {
    /// Create a new request
    pub fn new(method: &str, params: Option<Value>, id: Option<JsonRpcId>) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            method: method.to_string(),
            params,
            id,
        }
    }

    /// Check if this is a notification (no ID)
    pub fn is_notification(&self) -> bool {
        self.id.is_none()
    }

    /// 验证请求
    /// 
    /// 检查 JSON-RPC 版本和方法名的有效性。
    /// 方法名不能为空，且不能以 "rpc." 开头（保留前缀）。
    pub fn validate(&self) -> Result<(), JsonRpcError> {
        if self.jsonrpc != JSONRPC_VERSION {
            return Err(JsonRpcError {
                code: error_codes::INVALID_REQUEST,
                message: "Invalid JSON-RPC version".to_string(),
                data: None,
            });
        }
        // 方法名不能为空，且不能使用保留前缀 "rpc."
        if self.method.is_empty() || self.method.starts_with("rpc.") {
            return Err(JsonRpcError {
                code: error_codes::INVALID_REQUEST,
                message: "Invalid method name".to_string(),
                data: None,
            });
        }
        Ok(())
    }
}

impl JsonRpcResponse {
    /// Create a success response
    pub fn success(id: Option<JsonRpcId>, result: Value) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            result: Some(result),
            error: None,
            id,
        }
    }

    /// Create an error response
    pub fn error(id: Option<JsonRpcId>, error: JsonRpcError) -> Self {
        Self {
            jsonrpc: JSONRPC_VERSION.to_string(),
            result: None,
            error: Some(error),
            id,
        }
    }

    /// Create a parse error response
    pub fn parse_error() -> Self {
        Self::error(
            None,
            JsonRpcError {
                code: error_codes::PARSE_ERROR,
                message: "Parse error".to_string(),
                data: None,
            },
        )
    }

    /// Create a method not found error response
    pub fn method_not_found(id: Option<JsonRpcId>, method: &str) -> Self {
        Self::error(
            id,
            JsonRpcError {
                code: error_codes::METHOD_NOT_FOUND,
                message: format!("Method not found: {}", method),
                data: None,
            },
        )
    }

    /// Create an invalid params error response
    pub fn invalid_params(id: Option<JsonRpcId>, message: &str) -> Self {
        Self::error(
            id,
            JsonRpcError {
                code: error_codes::INVALID_PARAMS,
                message: message.to_string(),
                data: None,
            },
        )
    }

    /// Create an internal error response
    pub fn internal_error(id: Option<JsonRpcId>, message: &str) -> Self {
        Self::error(
            id,
            JsonRpcError {
                code: error_codes::INTERNAL_ERROR,
                message: message.to_string(),
                data: None,
            },
        )
    }
}

/// JSON-RPC batch request
pub type JsonRpcBatchRequest = Vec<JsonRpcRequest>;

/// JSON-RPC batch response
pub type JsonRpcBatchResponse = Vec<JsonRpcResponse>;

/// Available RPC methods
#[derive(Debug, Clone, Copy)]
pub enum RpcMethod {
    // Flow methods
    FlowList,
    FlowGet,
    FlowCreate,
    FlowUpdate,
    FlowDelete,

    // Version methods
    VersionList,
    VersionGet,
    VersionSave,
    VersionDelete,

    // Execution methods
    Execute,
    ExecuteCancel,
    ExecuteStatus,

    // Subscription methods
    Subscribe,
    Unsubscribe,
}

impl RpcMethod {
    pub fn from_strs(s: &str) -> Option<Self> {
        match s {
            "flow.list" => Some(Self::FlowList),
            "flow.get" => Some(Self::FlowGet),
            "flow.create" => Some(Self::FlowCreate),
            "flow.update" => Some(Self::FlowUpdate),
            "flow.delete" => Some(Self::FlowDelete),
            "version.list" => Some(Self::VersionList),
            "version.get" => Some(Self::VersionGet),
            "version.save" => Some(Self::VersionSave),
            "version.delete" => Some(Self::VersionDelete),
            "execute" => Some(Self::Execute),
            "execute.cancel" => Some(Self::ExecuteCancel),
            "execute.status" => Some(Self::ExecuteStatus),
            "subscribe" => Some(Self::Subscribe),
            "unsubscribe" => Some(Self::Unsubscribe),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_creation() {
        let req = JsonRpcRequest::new(
            "flow.list",
            Some(serde_json::json!({"limit": 10})),
            Some(JsonRpcId::Number(1)),
        );
        assert_eq!(req.jsonrpc, "2.0");
        assert_eq!(req.method, "flow.list");
        assert!(!req.is_notification());
    }

    #[test]
    fn test_notification() {
        let req = JsonRpcRequest::new("ping", None, None);
        assert!(req.is_notification());
    }

    #[test]
    fn test_request_validation() {
        let valid = JsonRpcRequest::new("test", None, Some(JsonRpcId::Number(1)));
        assert!(valid.validate().is_ok());

        let invalid = JsonRpcRequest {
            jsonrpc: "1.0".to_string(),
            method: "test".to_string(),
            params: None,
            id: None,
        };
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_success_response() {
        let resp = JsonRpcResponse::success(
            Some(JsonRpcId::Number(1)),
            serde_json::json!({"status": "ok"}),
        );
        assert!(resp.result.is_some());
        assert!(resp.error.is_none());
    }

    #[test]
    fn test_error_response() {
        let resp = JsonRpcResponse::method_not_found(Some(JsonRpcId::Number(1)), "unknown");
        assert!(resp.error.is_some());
        assert!(resp.result.is_none());
        assert_eq!(resp.error.unwrap().code, error_codes::METHOD_NOT_FOUND);
    }

    #[test]
    fn test_rpc_method_from_str() {
        assert!(matches!(
            RpcMethod::from_strs("flow.list"),
            Some(RpcMethod::FlowList)
        ));
        assert!(matches!(
            RpcMethod::from_strs("execute"),
            Some(RpcMethod::Execute)
        ));
        assert!(RpcMethod::from_strs("unknown").is_none());
    }

    #[test]
    fn test_serialization() {
        let req = JsonRpcRequest::new("test", None, Some(JsonRpcId::String("abc".to_string())));
        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"jsonrpc\":\"2.0\""));
        assert!(json.contains("\"method\":\"test\""));

        let parsed: JsonRpcRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.method, "test");
    }
}
