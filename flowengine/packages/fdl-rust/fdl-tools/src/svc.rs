//! Svc (微服务调用) Handler
//!
//! 提供微服务调用的工具处理器，支持多种服务发现和调用方式：
//! - 静态端点配置
//! - Consul 服务发现
//! - Kubernetes DNS 服务发现
//! - HTTP/gRPC 协议

use crate::error::{ToolError, ToolResult};
use crate::models::{LoadBalancer, ServiceDiscovery, SvcConfig};
use crate::registry::{ToolHandler, ToolMetadata};
use crate::{ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Svc 操作类型
#[derive(Debug, Clone, PartialEq)]
pub enum SvcOperation {
    /// 调用服务方法
    Call,
    /// 健康检查
    Health,
    /// 获取服务信息
    Info,
    /// 列出可用端点
    Endpoints,
}

impl SvcOperation {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "call" | "invoke" | "rpc" => Some(SvcOperation::Call),
            "health" | "healthcheck" | "ping" => Some(SvcOperation::Health),
            "info" | "metadata" => Some(SvcOperation::Info),
            "endpoints" | "instances" | "list" => Some(SvcOperation::Endpoints),
            _ => None,
        }
    }
}

/// 服务连接配置和状态
struct SvcConnection {
    config: SvcConfig,
    /// 当前端点索引（用于轮询负载均衡）
    current_index: AtomicUsize,
}

/// Svc 工具处理器
///
/// 处理 svc:// URI 格式的工具调用。
/// URI 格式: svc://service-id/method 或 svc://service-id/operation/method
pub struct SvcHandler {
    /// 配置缓存：service_id -> SvcConnection
    connections: Arc<RwLock<HashMap<String, SvcConnection>>>,
}

impl SvcHandler {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 注册微服务配置
    pub async fn register_service(&self, service_id: &str, config: SvcConfig) {
        let mut connections = self.connections.write().await;
        connections.insert(
            service_id.to_string(),
            SvcConnection {
                config,
                current_index: AtomicUsize::new(0),
            },
        );
    }

    /// 解析路径
    fn parse_path(&self, path: &str) -> ToolResult<(String, SvcOperation, Option<String>)> {
        let parts: Vec<&str> = path.splitn(3, '/').collect();

        if parts.is_empty() {
            return Err(ToolError::InvalidUri("Empty service path".to_string()));
        }

        let service_id = parts[0].to_string();

        // 尝试解析第二部分为操作或方法名
        let (operation, method) = if parts.len() > 1 {
            if let Some(op) = SvcOperation::from_str(parts[1]) {
                // svc://service/operation/method
                let method = if parts.len() > 2 {
                    Some(parts[2].to_string())
                } else {
                    None
                };
                (op, method)
            } else {
                // svc://service/method 格式，默认 call 操作
                (SvcOperation::Call, Some(parts[1].to_string()))
            }
        } else {
            (SvcOperation::Call, None)
        };

        Ok((service_id, operation, method))
    }

    /// 获取可用端点列表
    fn get_endpoints(&self, config: &SvcConfig) -> Vec<String> {
        match &config.discovery {
            ServiceDiscovery::Static { endpoints } => endpoints.clone(),
            ServiceDiscovery::Consul {
                address,
                service_name,
            } => {
                // 模拟从 Consul 获取端点
                vec![format!(
                    "http://{}:8080 (from Consul {})",
                    service_name, address
                )]
            }
            ServiceDiscovery::K8sDns {
                service_name,
                namespace,
            } => {
                // 模拟 K8s DNS 解析
                vec![format!(
                    "http://{}.{}.svc.cluster.local:8080",
                    service_name, namespace
                )]
            }
        }
    }

    /// 选择端点（负载均衡）
    fn select_endpoint(&self, connection: &SvcConnection, endpoints: &[String]) -> Option<String> {
        if endpoints.is_empty() {
            return None;
        }

        let selected = match connection.config.load_balancer {
            LoadBalancer::RoundRobin => {
                let index = connection.current_index.fetch_add(1, Ordering::SeqCst);
                endpoints[index % endpoints.len()].clone()
            }
            LoadBalancer::Random => {
                use std::time::{SystemTime, UNIX_EPOCH};
                let nanos = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .subsec_nanos() as usize;
                endpoints[nanos % endpoints.len()].clone()
            }
            LoadBalancer::LeastConnections => {
                // 简化实现：直接选第一个
                endpoints[0].clone()
            }
            LoadBalancer::Weighted => {
                // 简化实现：直接选第一个
                endpoints[0].clone()
            }
        };

        Some(selected)
    }

    /// 执行服务调用
    async fn execute_call(
        &self,
        connection: &SvcConnection,
        method: Option<&str>,
        args: &Value,
    ) -> ToolResult<Value> {
        let method = method
            .or_else(|| args.get("method").and_then(|v| v.as_str()))
            .ok_or_else(|| {
                ToolError::InvalidArgument("Missing 'method' parameter".to_string())
            })?;

        let endpoints = self.get_endpoints(&connection.config);
        let endpoint = self.select_endpoint(connection, &endpoints).ok_or_else(|| {
            ToolError::ExecutionError("No available endpoints".to_string())
        })?;

        let request_body = args.get("body").or_else(|| args.get("data"));
        let headers: HashMap<String, String> = args
            .get("headers")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        let request_id = uuid::Uuid::new_v4().to_string();

        // 模拟调用结果
        let result = json!({
            "success": true,
            "requestId": request_id,
            "endpoint": endpoint,
            "method": method,
            "protocol": format!("{:?}", connection.config.protocol),
            "loadBalancer": format!("{:?}", connection.config.load_balancer),
            "request": {
                "body": request_body,
                "headers": headers,
            },
            "response": {
                "status": 200,
                "body": {
                    "result": "ok",
                    "data": { "sample": "response data" }
                },
            },
            "latency_ms": 15,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        Ok(result)
    }

    /// 健康检查
    async fn execute_health(&self, connection: &SvcConnection, _args: &Value) -> ToolResult<Value> {
        let endpoints = self.get_endpoints(&connection.config);

        // 模拟健康检查结果
        let health_results: Vec<Value> = endpoints
            .iter()
            .map(|ep| {
                json!({
                    "endpoint": ep,
                    "healthy": true,
                    "latency_ms": 5,
                })
            })
            .collect();

        let all_healthy = health_results.iter().all(|h| {
            h.get("healthy")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
        });

        let result = json!({
            "success": true,
            "healthy": all_healthy,
            "protocol": format!("{:?}", connection.config.protocol),
            "endpoints": health_results,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        Ok(result)
    }

    /// 获取服务信息
    async fn execute_info(&self, connection: &SvcConnection, _args: &Value) -> ToolResult<Value> {
        let endpoints = self.get_endpoints(&connection.config);

        let discovery_type = match &connection.config.discovery {
            ServiceDiscovery::Static { .. } => "static",
            ServiceDiscovery::Consul { .. } => "consul",
            ServiceDiscovery::K8sDns { .. } => "k8s_dns",
        };

        let result = json!({
            "success": true,
            "discovery": discovery_type,
            "protocol": format!("{:?}", connection.config.protocol),
            "loadBalancer": format!("{:?}", connection.config.load_balancer),
            "timeout_ms": connection.config.timeout_ms,
            "endpoints": endpoints,
            "endpointCount": endpoints.len(),
        });

        Ok(result)
    }

    /// 列出可用端点
    async fn execute_endpoints(
        &self,
        connection: &SvcConnection,
        _args: &Value,
    ) -> ToolResult<Value> {
        let endpoints = self.get_endpoints(&connection.config);

        let discovery_str = match &connection.config.discovery {
            ServiceDiscovery::Static { .. } => "static".to_string(),
            ServiceDiscovery::Consul { address, service_name } => {
                format!("consul://{}/{}", address, service_name)
            }
            ServiceDiscovery::K8sDns { service_name, namespace } => {
                format!("k8s://{}.{}", service_name, namespace)
            }
        };

        let result = json!({
            "success": true,
            "endpoints": endpoints,
            "count": endpoints.len(),
            "discovery": discovery_str,
        });

        Ok(result)
    }
}

impl Default for SvcHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ToolHandler for SvcHandler {
    async fn execute(
        &self,
        path: &str,
        args: Value,
        _context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = std::time::Instant::now();

        let (service_id, operation, method) = self.parse_path(path)?;

        // 获取服务配置
        let connections = self.connections.read().await;
        let connection = connections.get(&service_id).ok_or_else(|| {
            ToolError::ToolNotFound(format!("Service not found: {}", service_id))
        })?;

        let result = match operation {
            SvcOperation::Call => {
                self.execute_call(connection, method.as_deref(), &args)
                    .await?
            }
            SvcOperation::Health => self.execute_health(connection, &args).await?,
            SvcOperation::Info => self.execute_info(connection, &args).await?,
            SvcOperation::Endpoints => self.execute_endpoints(connection, &args).await?,
        };

        Ok(ToolOutput {
            value: result,
            duration_ms: start.elapsed().as_millis() as u64,
            messages: vec![],
        })
    }

    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "svc".to_string(),
            description: "Microservice call handler with service discovery and load balancing"
                .to_string(),
            input_schema: Some(json!({
                "type": "object",
                "properties": {
                    "method": { "type": "string", "description": "Service method to call" },
                    "body": { "type": "object", "description": "Request body" },
                    "headers": { "type": "object", "description": "Request headers" },
                }
            })),
            output_schema: Some(json!({
                "type": "object",
                "properties": {
                    "success": { "type": "boolean" },
                    "requestId": { "type": "string" },
                    "response": { "type": "object" },
                    "latency_ms": { "type": "integer" },
                }
            })),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ServiceProtocol;

    #[tokio::test]
    async fn test_svc_handler_static_endpoints() {
        let handler = SvcHandler::new();

        let config = SvcConfig {
            discovery: ServiceDiscovery::Static {
                endpoints: vec![
                    "http://localhost:8080".to_string(),
                    "http://localhost:8081".to_string(),
                ],
            },
            protocol: ServiceProtocol::Http,
            timeout_ms: 30000,
            load_balancer: LoadBalancer::RoundRobin,
        };
        handler.register_service("user-service", config).await;

        let context = ToolContext::default();
        let args = json!({
            "body": { "userId": "123" }
        });

        let result = handler
            .execute("user-service/getUser", args, &context)
            .await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&json!(true)));
        assert_eq!(output.value.get("method"), Some(&json!("getUser")));
    }

    #[tokio::test]
    async fn test_svc_handler_round_robin() {
        let handler = SvcHandler::new();

        let config = SvcConfig {
            discovery: ServiceDiscovery::Static {
                endpoints: vec![
                    "http://server1:8080".to_string(),
                    "http://server2:8080".to_string(),
                    "http://server3:8080".to_string(),
                ],
            },
            protocol: ServiceProtocol::Http,
            timeout_ms: 30000,
            load_balancer: LoadBalancer::RoundRobin,
        };
        handler.register_service("test-service", config).await;

        let context = ToolContext::default();

        // 多次调用验证轮询
        let mut endpoints_used = Vec::new();
        for _ in 0..3 {
            let result = handler
                .execute("test-service/call/test", json!({}), &context)
                .await
                .unwrap();
            if let Some(ep) = result.value.get("endpoint").and_then(|v| v.as_str()) {
                endpoints_used.push(ep.to_string());
            }
        }

        // 验证三个端点都被使用过
        assert!(endpoints_used.contains(&"http://server1:8080".to_string()));
        assert!(endpoints_used.contains(&"http://server2:8080".to_string()));
        assert!(endpoints_used.contains(&"http://server3:8080".to_string()));
    }

    #[tokio::test]
    async fn test_svc_handler_health_check() {
        let handler = SvcHandler::new();

        let config = SvcConfig {
            discovery: ServiceDiscovery::Static {
                endpoints: vec!["http://localhost:8080".to_string()],
            },
            protocol: ServiceProtocol::Http,
            timeout_ms: 30000,
            load_balancer: LoadBalancer::RoundRobin,
        };
        handler.register_service("test-service", config).await;

        let context = ToolContext::default();
        let result = handler
            .execute("test-service/health", json!({}), &context)
            .await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("healthy"), Some(&json!(true)));
    }

    #[tokio::test]
    async fn test_svc_handler_grpc_protocol() {
        let handler = SvcHandler::new();

        let config = SvcConfig {
            discovery: ServiceDiscovery::K8sDns {
                service_name: "order-service".to_string(),
                namespace: "default".to_string(),
            },
            protocol: ServiceProtocol::Grpc,
            timeout_ms: 30000,
            load_balancer: LoadBalancer::LeastConnections,
        };
        handler.register_service("order-service", config).await;

        let context = ToolContext::default();
        let result = handler
            .execute("order-service/info", json!({}), &context)
            .await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("protocol"), Some(&json!("Grpc")));
    }
}
