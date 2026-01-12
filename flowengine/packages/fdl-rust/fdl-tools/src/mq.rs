//! MQ (Message Queue) Handler
//!
//! 提供消息队列服务的工具处理器，支持多种消息中间件：
//! - RabbitMQ
//! - Apache Kafka
//! - RocketMQ
//! - Redis Pub/Sub

use crate::error::{ToolError, ToolResult};
use crate::models::{MessageSerialization, MqConfig};
use crate::registry::{ToolHandler, ToolMetadata};
use crate::{ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// MQ 操作类型
#[derive(Debug, Clone, PartialEq)]
pub enum MqOperation {
    /// 发送消息
    Send,
    /// 接收消息（拉取模式）
    Receive,
    /// 订阅队列（推送模式，返回订阅 ID）
    Subscribe,
    /// 取消订阅
    Unsubscribe,
    /// 确认消息
    Ack,
    /// 拒绝消息
    Nack,
    /// 获取队列信息
    Info,
}

impl MqOperation {
    pub fn from_strs(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "send" | "publish" | "push" | "produce" => Some(MqOperation::Send),
            "receive" | "pull" | "consume" | "get" => Some(MqOperation::Receive),
            "subscribe" | "sub" | "listen" => Some(MqOperation::Subscribe),
            "unsubscribe" | "unsub" => Some(MqOperation::Unsubscribe),
            "ack" | "acknowledge" => Some(MqOperation::Ack),
            "nack" | "reject" => Some(MqOperation::Nack),
            "info" | "stats" | "status" => Some(MqOperation::Info),
            _ => None,
        }
    }
}

/// MQ 服务连接配置
struct MqConnection {
    config: MqConfig,
    // 实际实现时这里会有消息队列客户端
}

/// MQ 工具处理器
///
/// 处理 mq:// URI 格式的工具调用。
///
/// 支持多种 URI 格式：
/// 1. 显式 operation：`mq://service-id/operation/topic`
/// 2. 隐式 operation：`mq://service-id/exchange/routing-key` + args 中指定 `operation`
///
/// 示例：
/// ```yaml
/// # 方式1: operation 在 URI 中
/// exec: mq://rabbitmq/publish/customer.events
///
/// # 方式2: operation 在 args 中
/// exec: mq://rabbitmq/customer.events/view.updated
/// args: |
///     operation = 'publish'
///     message = toJson({...})
/// ```
pub struct MqHandler {
    /// 配置缓存：service_id -> MqConnection
    connections: Arc<RwLock<HashMap<String, MqConnection>>>,
}

impl MqHandler {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 注册 MQ 服务配置
    pub async fn register_service(&self, service_id: &str, config: MqConfig) {
        let mut connections = self.connections.write().await;
        connections.insert(service_id.to_string(), MqConnection { config });
    }

    /// 解析路径，支持从 args 中获取 operation
    ///
    /// 优先级：
    /// 1. 如果 args 中有 operation，则使用它
    /// 2. 否则尝试从路径中解析 operation
    ///
    /// 路径格式支持：
    /// - `service-id/operation/topic/queue` - operation 在路径中
    /// - `service-id/exchange/routing-key` - operation 在 args 中指定
    fn parse_path_with_args(
        &self,
        path: &str,
        args: &Value,
    ) -> ToolResult<(String, MqOperation, Option<String>, Option<String>)> {
        // 检查 args 中是否有 operation
        let operation_from_args = args
            .get("operation")
            .and_then(|v| v.as_str())
            .and_then(MqOperation::from_strs);

        let parts: Vec<&str> = path.splitn(4, '/').collect();

        if parts.is_empty() {
            return Err(ToolError::InvalidUri("Empty MQ path".to_string()));
        }

        let service_id = parts[0].to_string();

        if let Some(op) = operation_from_args {
            // args 中指定了 operation，路径格式为 service-id/exchange/routing-key
            let exchange = if parts.len() > 1 {
                Some(parts[1].to_string())
            } else {
                None
            };
            let routing_key = if parts.len() > 2 {
                Some(parts[2..].join("/"))
            } else {
                None
            };
            return Ok((service_id, op, exchange, routing_key));
        }

        // 尝试从路径解析 operation
        if parts.len() > 1 {
            if let Some(op) = MqOperation::from_strs(parts[1]) {
                // mq://service/operation/topic/queue
                let topic = if parts.len() > 2 {
                    Some(parts[2].to_string())
                } else {
                    None
                };
                let queue = if parts.len() > 3 {
                    Some(parts[3].to_string())
                } else {
                    None
                };
                return Ok((service_id, op, topic, queue));
            } else {
                // 第二部分不是 operation，作为 exchange/routing-key 处理
                let exchange = Some(parts[1].to_string());
                let routing_key = if parts.len() > 2 {
                    Some(parts[2..].join("/"))
                } else {
                    None
                };
                return Ok((service_id, MqOperation::Send, exchange, routing_key));
            }
        }

        Ok((service_id, MqOperation::Send, None, None))
    }

    /// 序列化消息
    fn serialize_message(&self, message: &Value, serialization: &MessageSerialization) -> String {
        match serialization {
            MessageSerialization::Json => serde_json::to_string(message).unwrap_or_default(),
            MessageSerialization::Protobuf => {
                // TODO: Protobuf 序列化
                format!(
                    "[protobuf:{}]",
                    serde_json::to_string(message).unwrap_or_default()
                )
            }
            MessageSerialization::Avro => {
                // TODO: Avro 序列化
                format!(
                    "[avro:{}]",
                    serde_json::to_string(message).unwrap_or_default()
                )
            }
        }
    }

    /// 执行发送操作
    async fn execute_send(
        &self,
        config: &MqConfig,
        topic: Option<&str>,
        queue: Option<&str>,
        args: &Value,
    ) -> ToolResult<Value> {
        let message = args
            .get("message")
            .or_else(|| args.get("data"))
            .or_else(|| args.get("body"))
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'message' parameter".to_string()))?;

        let topic = topic
            .or_else(|| args.get("topic").and_then(|v| v.as_str()))
            .or(config.default_queue.as_deref())
            .ok_or_else(|| ToolError::InvalidArgument("Missing topic/queue".to_string()))?;

        let delay = args.get("delay").and_then(|v| v.as_i64()).unwrap_or(0);

        let priority = args.get("priority").and_then(|v| v.as_i64()).unwrap_or(0);

        let message_id = uuid::Uuid::new_v4().to_string();
        let serialized = self.serialize_message(message, &config.serialization);

        // 模拟发送结果
        let result = json!({
            "success": true,
            "messageId": message_id,
            "topic": topic,
            "queue": queue,
            "broker": format!("{:?}", config.broker),
            "serialization": format!("{:?}", config.serialization),
            "size": serialized.len(),
            "delay": delay,
            "priority": priority,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        Ok(result)
    }

    /// 执行接收操作
    async fn execute_receive(
        &self,
        config: &MqConfig,
        topic: Option<&str>,
        queue: Option<&str>,
        args: &Value,
    ) -> ToolResult<Value> {
        let topic = topic
            .or_else(|| args.get("topic").and_then(|v| v.as_str()))
            .or(config.default_queue.as_deref())
            .ok_or_else(|| ToolError::InvalidArgument("Missing topic/queue".to_string()))?;

        let timeout = args.get("timeout").and_then(|v| v.as_i64()).unwrap_or(5000);

        let _max_messages = args
            .get("maxMessages")
            .or_else(|| args.get("count"))
            .and_then(|v| v.as_i64())
            .unwrap_or(1);

        // 模拟接收结果
        let result = json!({
            "success": true,
            "topic": topic,
            "queue": queue,
            "messages": [
                {
                    "messageId": uuid::Uuid::new_v4().to_string(),
                    "body": { "sample": "message data" },
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "deliveryTag": 1,
                }
            ],
            "count": 1,
            "timeout": timeout,
        });

        Ok(result)
    }

    /// 执行订阅操作
    async fn execute_subscribe(
        &self,
        config: &MqConfig,
        topic: Option<&str>,
        queue: Option<&str>,
        args: &Value,
    ) -> ToolResult<Value> {
        let topic = topic
            .or_else(|| args.get("topic").and_then(|v| v.as_str()))
            .or(config.default_queue.as_deref())
            .ok_or_else(|| ToolError::InvalidArgument("Missing topic/queue".to_string()))?;

        let subscription_id = uuid::Uuid::new_v4().to_string();

        let result = json!({
            "success": true,
            "subscriptionId": subscription_id,
            "topic": topic,
            "queue": queue,
            "status": "active",
            "createdAt": chrono::Utc::now().to_rfc3339(),
        });

        Ok(result)
    }

    /// 执行确认操作
    async fn execute_ack(&self, _config: &MqConfig, args: &Value) -> ToolResult<Value> {
        let message_id = args
            .get("messageId")
            .or_else(|| args.get("deliveryTag"))
            .ok_or_else(|| {
                ToolError::InvalidArgument("Missing 'messageId' parameter".to_string())
            })?;

        let result = json!({
            "success": true,
            "messageId": message_id,
            "acknowledged": true,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        Ok(result)
    }

    /// 获取队列信息
    async fn execute_info(
        &self,
        config: &MqConfig,
        topic: Option<&str>,
        queue: Option<&str>,
        _args: &Value,
    ) -> ToolResult<Value> {
        let result = json!({
            "success": true,
            "broker": format!("{:?}", config.broker),
            "topic": topic,
            "queue": queue,
            "stats": {
                "messageCount": 42,
                "consumerCount": 3,
                "publishRate": 10.5,
                "consumeRate": 8.2,
            },
            "status": "healthy",
        });

        Ok(result)
    }
}

impl Default for MqHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ToolHandler for MqHandler {
    async fn execute(
        &self,
        path: &str,
        args: Value,
        _context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = std::time::Instant::now();

        // 使用支持 args 中 operation 的解析方法
        let (service_id, operation, topic, queue) = self.parse_path_with_args(path, &args)?;

        // 获取服务配置
        let connections = self.connections.read().await;
        let connection = connections.get(&service_id).ok_or_else(|| {
            ToolError::ToolNotFound(format!("MQ service not found: {}", service_id))
        })?;

        let result = match operation {
            MqOperation::Send => {
                self.execute_send(
                    &connection.config,
                    topic.as_deref(),
                    queue.as_deref(),
                    &args,
                )
                .await?
            }
            MqOperation::Receive => {
                self.execute_receive(
                    &connection.config,
                    topic.as_deref(),
                    queue.as_deref(),
                    &args,
                )
                .await?
            }
            MqOperation::Subscribe => {
                self.execute_subscribe(
                    &connection.config,
                    topic.as_deref(),
                    queue.as_deref(),
                    &args,
                )
                .await?
            }
            MqOperation::Ack => self.execute_ack(&connection.config, &args).await?,
            MqOperation::Nack => {
                // 类似 Ack，但设置 requeue 标志
                json!({ "success": true, "rejected": true, "requeued": true })
            }
            MqOperation::Unsubscribe => {
                let sub_id = args
                    .get("subscriptionId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                json!({ "success": true, "subscriptionId": sub_id, "status": "cancelled" })
            }
            MqOperation::Info => {
                self.execute_info(
                    &connection.config,
                    topic.as_deref(),
                    queue.as_deref(),
                    &args,
                )
                .await?
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
            name: "mq".to_string(),
            description: "Message Queue handler for RabbitMQ, Kafka, RocketMQ".to_string(),
            input_schema: Some(json!({
                "type": "object",
                "properties": {
                    "operation": {
                        "type": "string",
                        "description": "Operation type: send/publish/receive/subscribe/ack/nack/info",
                        "enum": ["send", "publish", "receive", "subscribe", "ack", "nack", "info"]
                    },
                    "topic": { "type": "string", "description": "Topic/Exchange name" },
                    "queue": { "type": "string", "description": "Queue name" },
                    "routingKey": { "type": "string", "description": "Routing key (RabbitMQ)" },
                    "exchange": { "type": "string", "description": "Exchange name (RabbitMQ)" },
                    "message": { "type": "object", "description": "Message body" },
                    "delay": { "type": "integer", "description": "Delay in milliseconds" },
                    "priority": { "type": "integer", "description": "Message priority" },
                }
            })),
            output_schema: Some(json!({
                "type": "object",
                "properties": {
                    "success": { "type": "boolean" },
                    "messageId": { "type": "string" },
                }
            })),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::MqBroker;

    fn create_test_config() -> MqConfig {
        MqConfig {
            broker: MqBroker::RabbitMq,
            connection_string: "amqp://localhost:5672".to_string(),
            default_queue: Some("test-queue".to_string()),
            serialization: MessageSerialization::Json,
            default_exchange: None,
            default_routing_key: None,
        }
    }

    #[tokio::test]
    async fn test_mq_handler_send() {
        let handler = MqHandler::new();
        handler
            .register_service("test-mq", create_test_config())
            .await;

        let context = ToolContext::default();
        let args = json!({
            "message": { "orderId": "123", "status": "created" }
        });

        let result = handler.execute("test-mq/send", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&json!(true)));
        assert!(output.value.get("messageId").is_some());
    }

    #[tokio::test]
    async fn test_mq_handler_receive() {
        let handler = MqHandler::new();

        let config = MqConfig {
            default_exchange: None,
            default_routing_key: None,
            broker: MqBroker::Kafka,
            connection_string: "localhost:9092".to_string(),
            default_queue: Some("orders".to_string()),
            serialization: MessageSerialization::Json,
        };
        handler.register_service("kafka", config).await;

        let context = ToolContext::default();
        let args = json!({ "timeout": 1000 });

        let result = handler.execute("kafka/receive", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert!(output.value.get("messages").is_some());
    }

    // ===== Operation in Args Tests =====

    #[tokio::test]
    async fn test_parse_path_with_operation_in_args_publish() {
        let handler = MqHandler::new();
        let args = json!({ "operation": "publish" });

        // mq://rabbitmq/customer.events/view.updated with operation in args
        let result = handler.parse_path_with_args("rabbitmq/customer.events/view.updated", &args);
        assert!(result.is_ok());

        let (service_id, operation, exchange, routing_key) = result.unwrap();
        assert_eq!(service_id, "rabbitmq");
        assert_eq!(operation, MqOperation::Send); // publish maps to Send
        assert_eq!(exchange, Some("customer.events".to_string()));
        assert_eq!(routing_key, Some("view.updated".to_string()));
    }

    #[tokio::test]
    async fn test_parse_path_with_operation_in_args_receive() {
        let handler = MqHandler::new();
        let args = json!({ "operation": "receive" });

        let result = handler.parse_path_with_args("kafka/orders", &args);
        assert!(result.is_ok());

        let (service_id, operation, topic, queue) = result.unwrap();
        assert_eq!(service_id, "kafka");
        assert_eq!(operation, MqOperation::Receive);
        assert_eq!(topic, Some("orders".to_string()));
        assert_eq!(queue, None);
    }

    #[tokio::test]
    async fn test_parse_path_with_operation_in_args_subscribe() {
        let handler = MqHandler::new();
        let args = json!({ "operation": "subscribe" });

        let result = handler.parse_path_with_args("rocketmq/notifications/user.events", &args);
        assert!(result.is_ok());

        let (service_id, operation, topic, routing_key) = result.unwrap();
        assert_eq!(service_id, "rocketmq");
        assert_eq!(operation, MqOperation::Subscribe);
        assert_eq!(topic, Some("notifications".to_string()));
        assert_eq!(routing_key, Some("user.events".to_string()));
    }

    #[tokio::test]
    async fn test_operation_in_path_still_works() {
        // 向后兼容：operation 在路径中仍然有效
        let handler = MqHandler::new();
        let args = json!({});

        let result = handler.parse_path_with_args("rabbitmq/publish/events/order.created", &args);
        assert!(result.is_ok());

        let (service_id, operation, topic, queue) = result.unwrap();
        assert_eq!(service_id, "rabbitmq");
        assert_eq!(operation, MqOperation::Send);
        assert_eq!(topic, Some("events".to_string()));
        assert_eq!(queue, Some("order.created".to_string()));
    }

    #[tokio::test]
    async fn test_operation_in_args_takes_precedence() {
        // args 中的 operation 优先于路径
        let handler = MqHandler::new();
        let args = json!({ "operation": "receive" });

        // 路径看起来像 send，但 args 指定 receive
        let result = handler.parse_path_with_args("rabbitmq/send/events", &args);
        assert!(result.is_ok());

        let (service_id, operation, exchange, routing_key) = result.unwrap();
        assert_eq!(service_id, "rabbitmq");
        assert_eq!(operation, MqOperation::Receive); // args 中的 receive 优先
        assert_eq!(exchange, Some("send".to_string())); // "send" 被当作 exchange
        assert_eq!(routing_key, Some("events".to_string()));
    }

    #[tokio::test]
    async fn test_default_operation_is_send() {
        // 没有指定 operation 时默认为 Send
        let handler = MqHandler::new();
        let args = json!({});

        let result = handler.parse_path_with_args("rabbitmq/orders/new", &args);
        assert!(result.is_ok());

        let (service_id, operation, exchange, routing_key) = result.unwrap();
        assert_eq!(service_id, "rabbitmq");
        assert_eq!(operation, MqOperation::Send);
        assert_eq!(exchange, Some("orders".to_string()));
        assert_eq!(routing_key, Some("new".to_string()));
    }

    #[tokio::test]
    async fn test_execute_with_operation_in_args() {
        let handler = MqHandler::new();
        handler
            .register_service("rabbitmq", create_test_config())
            .await;

        let context = ToolContext::default();
        let args = json!({
            "operation": "publish",
            "message": { "event": "user.created", "userId": "u123" }
        });

        // 使用 exchange/routing-key 格式
        let result = handler
            .execute("rabbitmq/customer.events/user.created", args, &context)
            .await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&json!(true)));
        // exchange 应该被设置为 topic
        assert_eq!(output.value.get("topic"), Some(&json!("customer.events")));
        // routing-key 应该被设置为 queue
        assert_eq!(output.value.get("queue"), Some(&json!("user.created")));
    }

    #[tokio::test]
    async fn test_operation_aliases() {
        let handler = MqHandler::new();

        // 测试各种别名都能正确解析
        let test_cases = vec![
            ("publish", MqOperation::Send),
            ("push", MqOperation::Send),
            ("produce", MqOperation::Send),
            ("pull", MqOperation::Receive),
            ("consume", MqOperation::Receive),
            ("get", MqOperation::Receive),
            ("sub", MqOperation::Subscribe),
            ("listen", MqOperation::Subscribe),
            ("unsub", MqOperation::Unsubscribe),
            ("acknowledge", MqOperation::Ack),
            ("reject", MqOperation::Nack),
            ("stats", MqOperation::Info),
            ("status", MqOperation::Info),
        ];

        for (alias, expected_op) in test_cases {
            let args = json!({ "operation": alias });
            let result = handler.parse_path_with_args("test/topic", &args);
            assert!(result.is_ok(), "Failed for alias: {}", alias);
            let (_, operation, _, _) = result.unwrap();
            assert_eq!(
                operation, expected_op,
                "Alias '{}' should map to {:?}",
                alias, expected_op
            );
        }
    }
}
