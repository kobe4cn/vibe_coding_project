//! OSS (Object Storage Service) Handler
//!
//! 提供对象存储服务的工具处理器，支持多种云存储后端：
//! - AWS S3
//! - 阿里云 OSS
//! - MinIO
//! - Azure Blob Storage
//! - Google Cloud Storage

use crate::error::{ToolError, ToolResult};
use crate::models::OssConfig;
use crate::registry::{ToolHandler, ToolMetadata};
use crate::{ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// OSS 操作类型
#[derive(Debug, Clone, PartialEq)]
pub enum OssOperation {
    /// 上传对象
    Upload,
    /// 下载对象
    Download,
    /// 删除对象
    Delete,
    /// 列出对象
    List,
    /// 生成预签名 URL
    Presign,
    /// 复制对象
    Copy,
    /// 获取对象元数据
    Head,
}

impl OssOperation {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "upload" | "put" | "save" => Some(OssOperation::Upload),
            "download" | "get" | "load" => Some(OssOperation::Download),
            "delete" | "remove" | "del" => Some(OssOperation::Delete),
            "list" | "ls" => Some(OssOperation::List),
            "presign" | "sign" => Some(OssOperation::Presign),
            "copy" | "cp" => Some(OssOperation::Copy),
            "head" | "meta" | "metadata" => Some(OssOperation::Head),
            _ => None,
        }
    }
}

/// OSS 服务连接配置缓存
struct OssConnection {
    config: OssConfig,
    // 实际实现时这里会有 S3 客户端等
}

/// OSS 工具处理器
///
/// 处理 oss:// URI 格式的工具调用。
///
/// 支持两种 URI 格式：
/// 1. 显式 operation：`oss://service-id/operation/key`
/// 2. 隐式 operation：`oss://service-id/path/to/key` + args 中指定 `operation`
///
/// 示例：
/// ```yaml
/// # 方式1: operation 在 URI 中
/// exec: oss://minio/upload/reports/customer-5.json
///
/// # 方式2: operation 在 args 中
/// exec: oss://minio/reports/customer-5.json
/// args: |
///     operation = 'upload'
///     content = toJson($)
/// ```
pub struct OssHandler {
    /// 配置缓存：service_id -> OssConnection
    connections: Arc<RwLock<HashMap<String, OssConnection>>>,
}

impl OssHandler {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 注册 OSS 服务配置
    pub async fn register_service(&self, service_id: &str, config: OssConfig) {
        let mut connections = self.connections.write().await;
        connections.insert(
            service_id.to_string(),
            OssConnection { config },
        );
    }

    /// 解析路径，支持从 args 中获取 operation
    ///
    /// 优先级：
    /// 1. 如果 args 中有 operation，则使用它，路径剩余部分作为 key
    /// 2. 否则尝试从路径中解析 operation
    fn parse_path_with_args(
        &self,
        path: &str,
        args: &Value,
    ) -> ToolResult<(String, OssOperation, Option<String>)> {
        // 检查 args 中是否有 operation
        let operation_from_args = args
            .get("operation")
            .and_then(|v| v.as_str())
            .and_then(OssOperation::from_str);

        if let Some(op) = operation_from_args {
            // args 中指定了 operation，路径格式为 service-id/path/to/key
            let parts: Vec<&str> = path.splitn(2, '/').collect();

            if parts.is_empty() {
                return Err(ToolError::InvalidUri("Empty OSS path".to_string()));
            }

            let service_id = parts[0].to_string();
            let key = if parts.len() > 1 && !parts[1].is_empty() {
                Some(parts[1].to_string())
            } else {
                None
            };

            return Ok((service_id, op, key));
        }

        // 尝试从路径解析 operation
        let parts: Vec<&str> = path.splitn(3, '/').collect();

        if parts.is_empty() {
            return Err(ToolError::InvalidUri("Empty OSS path".to_string()));
        }

        let service_id = parts[0].to_string();

        // 检查第二部分是否是有效的 operation
        if parts.len() > 1 {
            if let Some(op) = OssOperation::from_str(parts[1]) {
                // 路径格式: service-id/operation/key
                let key = if parts.len() > 2 {
                    Some(parts[2].to_string())
                } else {
                    None
                };
                return Ok((service_id, op, key));
            } else {
                // 第二部分不是 operation，整个路径作为 key，使用默认 operation
                let key = Some(parts[1..].join("/"));
                return Ok((service_id, OssOperation::Download, key));
            }
        }

        // 只有 service-id，使用默认 operation
        Ok((service_id, OssOperation::Download, None))
    }

    /// 执行上传操作
    async fn execute_upload(
        &self,
        config: &OssConfig,
        args: &Value,
    ) -> ToolResult<Value> {
        let key = args.get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'key' parameter".to_string()))?;

        let content = args.get("content")
            .or_else(|| args.get("data"))
            .or_else(|| args.get("body"));

        let content_type = args.get("contentType")
            .or_else(|| args.get("content_type"))
            .and_then(|v| v.as_str())
            .unwrap_or("application/octet-stream");

        // 模拟上传结果（实际实现需要调用 S3 SDK）
        let result = json!({
            "success": true,
            "bucket": config.bucket,
            "key": key,
            "contentType": content_type,
            "size": content.map(|c| c.to_string().len()).unwrap_or(0),
            "etag": format!("\"{}\"", uuid::Uuid::new_v4().to_string().replace("-", "")),
            "url": format!("{}/{}/{}", config.endpoint.as_deref().unwrap_or("https://s3.amazonaws.com"), config.bucket, key),
        });

        Ok(result)
    }

    /// 执行下载操作
    async fn execute_download(
        &self,
        config: &OssConfig,
        args: &Value,
    ) -> ToolResult<Value> {
        let key = args.get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'key' parameter".to_string()))?;

        // 模拟下载结果
        let result = json!({
            "success": true,
            "bucket": config.bucket,
            "key": key,
            "content": format!("[Content of {}]", key),
            "contentType": "application/octet-stream",
            "size": 1024,
            "lastModified": chrono::Utc::now().to_rfc3339(),
        });

        Ok(result)
    }

    /// 执行删除操作
    async fn execute_delete(
        &self,
        config: &OssConfig,
        args: &Value,
    ) -> ToolResult<Value> {
        let key = args.get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'key' parameter".to_string()))?;

        let result = json!({
            "success": true,
            "bucket": config.bucket,
            "key": key,
            "deleted": true,
        });

        Ok(result)
    }

    /// 执行列表操作
    async fn execute_list(
        &self,
        config: &OssConfig,
        args: &Value,
    ) -> ToolResult<Value> {
        let prefix = args.get("prefix")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let max_keys = args.get("maxKeys")
            .or_else(|| args.get("limit"))
            .and_then(|v| v.as_i64())
            .unwrap_or(1000);

        // 模拟列表结果
        let result = json!({
            "success": true,
            "bucket": config.bucket,
            "prefix": prefix,
            "maxKeys": max_keys,
            "isTruncated": false,
            "contents": [
                {
                    "key": format!("{}example1.txt", prefix),
                    "size": 1024,
                    "lastModified": chrono::Utc::now().to_rfc3339(),
                },
                {
                    "key": format!("{}example2.json", prefix),
                    "size": 2048,
                    "lastModified": chrono::Utc::now().to_rfc3339(),
                }
            ],
        });

        Ok(result)
    }

    /// 执行预签名操作
    async fn execute_presign(
        &self,
        config: &OssConfig,
        args: &Value,
    ) -> ToolResult<Value> {
        let key = args.get("key")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'key' parameter".to_string()))?;

        let expires_in = args.get("expiresIn")
            .or_else(|| args.get("expires"))
            .and_then(|v| v.as_i64())
            .unwrap_or(3600); // 默认 1 小时

        let operation = args.get("operation")
            .and_then(|v| v.as_str())
            .unwrap_or("get");

        // 模拟预签名 URL
        let signed_url = format!(
            "{}/{}/{}?X-Signature=mock_signature&X-Expires={}",
            config.endpoint.as_deref().unwrap_or("https://s3.amazonaws.com"),
            config.bucket,
            key,
            expires_in
        );

        let result = json!({
            "success": true,
            "bucket": config.bucket,
            "key": key,
            "operation": operation,
            "signedUrl": signed_url,
            "expiresIn": expires_in,
            "expiresAt": (chrono::Utc::now() + chrono::Duration::seconds(expires_in)).to_rfc3339(),
        });

        Ok(result)
    }
}

impl Default for OssHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ToolHandler for OssHandler {
    async fn execute(
        &self,
        path: &str,
        args: Value,
        _context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = std::time::Instant::now();

        // 使用支持 args 中 operation 的解析方法
        let (service_id, operation, key_from_path) = self.parse_path_with_args(path, &args)?;

        // 获取服务配置
        let connections = self.connections.read().await;
        let connection = connections.get(&service_id).ok_or_else(|| {
            ToolError::ToolNotFound(format!("OSS service not found: {}", service_id))
        })?;

        // 如果路径中有 key，合并到 args 中
        let mut args = args;
        if let Some(key) = key_from_path {
            if let Value::Object(ref mut map) = args {
                if !map.contains_key("key") {
                    map.insert("key".to_string(), Value::String(key));
                }
            }
        }

        let result = match operation {
            OssOperation::Upload => self.execute_upload(&connection.config, &args).await?,
            OssOperation::Download => self.execute_download(&connection.config, &args).await?,
            OssOperation::Delete => self.execute_delete(&connection.config, &args).await?,
            OssOperation::List => self.execute_list(&connection.config, &args).await?,
            OssOperation::Presign => self.execute_presign(&connection.config, &args).await?,
            OssOperation::Copy => {
                // TODO: 实现复制操作
                json!({ "error": "Copy operation not yet implemented" })
            }
            OssOperation::Head => {
                // TODO: 实现元数据获取
                json!({ "error": "Head operation not yet implemented" })
            }
        };

        Ok(ToolOutput {
            value: result,
            duration_ms: start.elapsed().as_millis() as u64,
            messages: vec![],
        })
    }

    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "oss".to_string(),
            description: "Object Storage Service handler for S3-compatible storage".to_string(),
            input_schema: Some(json!({
                "type": "object",
                "properties": {
                    "operation": {
                        "type": "string",
                        "description": "Operation type: upload/download/delete/list/presign/copy/head",
                        "enum": ["upload", "download", "delete", "list", "presign", "copy", "head"]
                    },
                    "key": { "type": "string", "description": "Object key/path" },
                    "content": { "type": "string", "description": "Content to upload" },
                    "contentType": { "type": "string", "description": "MIME type" },
                    "prefix": { "type": "string", "description": "List prefix filter" },
                    "maxKeys": { "type": "integer", "description": "Max items to list" },
                    "expiresIn": { "type": "integer", "description": "Presign expiry in seconds" },
                }
            })),
            output_schema: Some(json!({
                "type": "object",
                "properties": {
                    "success": { "type": "boolean" },
                    "bucket": { "type": "string" },
                    "key": { "type": "string" },
                }
            })),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{OssCredentials, OssProvider};

    #[tokio::test]
    async fn test_oss_handler_upload() {
        let handler = OssHandler::new();

        // 注册测试服务
        let config = OssConfig {
            provider: OssProvider::S3,
            bucket: "test-bucket".to_string(),
            region: Some("us-east-1".to_string()),
            endpoint: Some("https://s3.amazonaws.com".to_string()),
            credentials: OssCredentials {
                access_key_id: "test-key".to_string(),
                secret_access_key: "test-secret".to_string(),
                session_token: None,
            },
            path_style: false,
        };
        handler.register_service("test-oss", config).await;

        let context = ToolContext::default();
        let args = json!({
            "key": "test/file.txt",
            "content": "Hello, World!",
            "contentType": "text/plain"
        });

        let result = handler.execute("test-oss/upload", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&json!(true)));
        assert_eq!(output.value.get("key"), Some(&json!("test/file.txt")));
    }

    #[tokio::test]
    async fn test_oss_handler_list() {
        let handler = OssHandler::new();

        let config = OssConfig {
            provider: OssProvider::S3,
            bucket: "test-bucket".to_string(),
            region: None,
            endpoint: None,
            credentials: OssCredentials {
                access_key_id: "test".to_string(),
                secret_access_key: "test".to_string(),
                session_token: None,
            },
            path_style: false,
        };
        handler.register_service("test-oss", config).await;

        let context = ToolContext::default();
        let args = json!({ "prefix": "reports/" });

        let result = handler.execute("test-oss/list", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(output.value.get("contents").is_some());
    }

    #[tokio::test]
    async fn test_oss_handler_upload_with_operation_in_args() {
        let handler = OssHandler::new();

        let config = OssConfig {
            provider: OssProvider::S3,
            bucket: "test-bucket".to_string(),
            region: Some("us-east-1".to_string()),
            endpoint: Some("https://s3.amazonaws.com".to_string()),
            credentials: OssCredentials {
                access_key_id: "test-key".to_string(),
                secret_access_key: "test-secret".to_string(),
                session_token: None,
            },
            path_style: false,
        };
        handler.register_service("minio", config).await;

        let context = ToolContext::default();
        // operation 在 args 中指定，路径格式为 service-id/path/to/key
        let args = json!({
            "operation": "upload",
            "content": "{\"id\": 5, \"name\": \"test\"}",
            "contentType": "application/json"
        });

        // 路径格式: minio/reports/customer-5.json (不包含 operation)
        let result = handler.execute("minio/reports/customer-5.json", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&json!(true)));
        assert_eq!(output.value.get("key"), Some(&json!("reports/customer-5.json")));
    }

    #[tokio::test]
    async fn test_oss_handler_presign_with_operation_in_args() {
        let handler = OssHandler::new();

        let config = OssConfig {
            provider: OssProvider::S3,
            bucket: "customer-assets".to_string(),
            region: None,
            endpoint: Some("http://localhost:9000".to_string()),
            credentials: OssCredentials {
                access_key_id: "test".to_string(),
                secret_access_key: "test".to_string(),
                session_token: None,
            },
            path_style: true,
        };
        handler.register_service("minio", config).await;

        let context = ToolContext::default();
        let args = json!({
            "operation": "presign",
            "expiresIn": 3600
        });

        let result = handler.execute("minio/avatars/5.jpg", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&json!(true)));
        assert_eq!(output.value.get("key"), Some(&json!("avatars/5.jpg")));
        assert!(output.value.get("signedUrl").is_some());
    }
}
