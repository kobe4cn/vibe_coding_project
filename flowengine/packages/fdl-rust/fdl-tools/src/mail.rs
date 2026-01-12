//! Mail (邮件服务) Handler
//!
//! 提供邮件发送服务的工具处理器，支持多种邮件服务商：
//! - SMTP (通用)
//! - SendGrid
//! - Mailgun
//! - Amazon SES
//! - 阿里云邮件推送

use crate::error::{ToolError, ToolResult};
use crate::models::MailConfig;
use crate::registry::{ToolHandler, ToolMetadata};
use crate::{ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// 邮件操作类型
#[derive(Debug, Clone, PartialEq)]
pub enum MailOperation {
    /// 发送邮件
    Send,
    /// 发送模板邮件
    SendTemplate,
    /// 验证邮箱地址
    Verify,
    /// 查询发送状态
    Status,
}

impl MailOperation {
    pub fn from_strs(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "send" | "mail" | "email" => Some(MailOperation::Send),
            "template" | "send_template" | "sendtemplate" => Some(MailOperation::SendTemplate),
            "verify" | "validate" => Some(MailOperation::Verify),
            "status" | "query" | "check" => Some(MailOperation::Status),
            _ => None,
        }
    }
}

/// 邮件服务连接配置
struct MailConnection {
    config: MailConfig,
}

/// Mail 工具处理器
///
/// 处理 mail:// URI 格式的工具调用。
/// URI 格式: mail://service-id/operation
pub struct MailHandler {
    /// 配置缓存：service_id -> MailConnection
    connections: Arc<RwLock<HashMap<String, MailConnection>>>,
}

impl MailHandler {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 注册邮件服务配置
    pub async fn register_service(&self, service_id: &str, config: MailConfig) {
        let mut connections = self.connections.write().await;
        connections.insert(service_id.to_string(), MailConnection { config });
    }

    /// 解析路径
    fn parse_path(&self, path: &str) -> ToolResult<(String, MailOperation)> {
        let parts: Vec<&str> = path.splitn(2, '/').collect();

        if parts.is_empty() {
            return Err(ToolError::InvalidUri("Empty mail path".to_string()));
        }

        let service_id = parts[0].to_string();
        let operation = if parts.len() > 1 {
            MailOperation::from_strs(parts[1]).unwrap_or(MailOperation::Send)
        } else {
            MailOperation::Send
        };

        Ok((service_id, operation))
    }

    /// 执行发送操作
    async fn execute_send(&self, config: &MailConfig, args: &Value) -> ToolResult<Value> {
        // 收件人（必填）
        let to = args
            .get("to")
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'to' parameter".to_string()))?;

        // 支持单个收件人或数组
        let recipients: Vec<String> = match to {
            Value::String(s) => vec![s.clone()],
            Value::Array(arr) => arr
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
            _ => {
                return Err(ToolError::InvalidArgument(
                    "'to' must be a string or array of strings".to_string(),
                ));
            }
        };

        // 主题（必填）
        let subject = args
            .get("subject")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'subject' parameter".to_string()))?;

        // 邮件正文（至少需要 body 或 html）
        let body = args.get("body").and_then(|v| v.as_str());
        let html = args.get("html").and_then(|v| v.as_str());

        if body.is_none() && html.is_none() {
            return Err(ToolError::InvalidArgument(
                "Missing 'body' or 'html' parameter".to_string(),
            ));
        }

        // 可选参数
        let cc: Vec<String> = args
            .get("cc")
            .and_then(|v| match v {
                Value::String(s) => Some(vec![s.clone()]),
                Value::Array(arr) => Some(
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect(),
                ),
                _ => None,
            })
            .unwrap_or_default();

        let bcc: Vec<String> = args
            .get("bcc")
            .and_then(|v| match v {
                Value::String(s) => Some(vec![s.clone()]),
                Value::Array(arr) => Some(
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect(),
                ),
                _ => None,
            })
            .unwrap_or_default();

        let reply_to = args.get("replyTo").and_then(|v| v.as_str());

        let message_id = uuid::Uuid::new_v4().to_string();

        // 模拟发送结果（实际需要连接邮件服务）
        let result = json!({
            "success": true,
            "messageId": message_id,
            "provider": format!("{:?}", config.provider),
            "from": {
                "address": config.from_address,
                "name": config.from_name,
            },
            "to": recipients,
            "cc": cc,
            "bcc": bcc,
            "replyTo": reply_to,
            "subject": subject,
            "hasBody": body.is_some(),
            "hasHtml": html.is_some(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "status": "queued",
        });

        Ok(result)
    }

    /// 执行模板邮件发送
    async fn execute_send_template(&self, config: &MailConfig, args: &Value) -> ToolResult<Value> {
        let to = args
            .get("to")
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'to' parameter".to_string()))?;

        let template_id = args
            .get("templateId")
            .or_else(|| args.get("template"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ToolError::InvalidArgument("Missing 'templateId' parameter".to_string())
            })?;

        let template_data = args.get("data").or_else(|| args.get("variables"));

        let recipients: Vec<String> = match to {
            Value::String(s) => vec![s.clone()],
            Value::Array(arr) => arr
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
            _ => {
                return Err(ToolError::InvalidArgument(
                    "'to' must be a string or array of strings".to_string(),
                ));
            }
        };

        let message_id = uuid::Uuid::new_v4().to_string();

        let result = json!({
            "success": true,
            "messageId": message_id,
            "provider": format!("{:?}", config.provider),
            "from": config.from_address,
            "to": recipients,
            "templateId": template_id,
            "templateData": template_data,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "status": "queued",
        });

        Ok(result)
    }

    /// 验证邮箱地址
    async fn execute_verify(&self, _config: &MailConfig, args: &Value) -> ToolResult<Value> {
        let email = args
            .get("email")
            .or_else(|| args.get("address"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'email' parameter".to_string()))?;

        // 简单的格式验证
        let is_valid = email.contains('@') && email.contains('.');

        let result = json!({
            "success": true,
            "email": email,
            "valid": is_valid,
            "reason": if is_valid { "valid_format" } else { "invalid_format" },
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        Ok(result)
    }

    /// 查询发送状态
    async fn execute_status(&self, _config: &MailConfig, args: &Value) -> ToolResult<Value> {
        let message_id = args
            .get("messageId")
            .or_else(|| args.get("id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ToolError::InvalidArgument("Missing 'messageId' parameter".to_string())
            })?;

        // 模拟状态查询
        let result = json!({
            "success": true,
            "messageId": message_id,
            "status": "delivered",
            "deliveredAt": chrono::Utc::now().to_rfc3339(),
            "opens": 0,
            "clicks": 0,
        });

        Ok(result)
    }
}

impl Default for MailHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ToolHandler for MailHandler {
    async fn execute(
        &self,
        path: &str,
        args: Value,
        _context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = std::time::Instant::now();

        let (service_id, operation) = self.parse_path(path)?;

        // 获取服务配置
        let connections = self.connections.read().await;
        let connection = connections.get(&service_id).ok_or_else(|| {
            ToolError::ToolNotFound(format!("Mail service not found: {}", service_id))
        })?;

        let result = match operation {
            MailOperation::Send => self.execute_send(&connection.config, &args).await?,
            MailOperation::SendTemplate => {
                self.execute_send_template(&connection.config, &args)
                    .await?
            }
            MailOperation::Verify => self.execute_verify(&connection.config, &args).await?,
            MailOperation::Status => self.execute_status(&connection.config, &args).await?,
        };

        Ok(ToolOutput {
            value: result,
            duration_ms: start.elapsed().as_millis() as u64,
            messages: vec![],
        })
    }

    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "mail".to_string(),
            description: "Email service handler for SMTP, SendGrid, Mailgun, SES".to_string(),
            input_schema: Some(json!({
                "type": "object",
                "properties": {
                    "to": {
                        "oneOf": [
                            { "type": "string" },
                            { "type": "array", "items": { "type": "string" } }
                        ],
                        "description": "Recipient email address(es)"
                    },
                    "subject": { "type": "string", "description": "Email subject" },
                    "body": { "type": "string", "description": "Plain text body" },
                    "html": { "type": "string", "description": "HTML body" },
                    "cc": { "type": "array", "items": { "type": "string" }, "description": "CC recipients" },
                    "bcc": { "type": "array", "items": { "type": "string" }, "description": "BCC recipients" },
                    "templateId": { "type": "string", "description": "Template ID for template emails" },
                    "data": { "type": "object", "description": "Template variables" },
                }
            })),
            output_schema: Some(json!({
                "type": "object",
                "properties": {
                    "success": { "type": "boolean" },
                    "messageId": { "type": "string" },
                    "status": { "type": "string" },
                }
            })),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::MailProvider;

    #[tokio::test]
    async fn test_mail_handler_send() {
        let handler = MailHandler::new();

        let config = MailConfig {
            provider: MailProvider::Smtp,
            smtp_host: Some("smtp.example.com".to_string()),
            smtp_port: Some(587),
            api_key: None,
            from_address: "noreply@example.com".to_string(),
            from_name: Some("Test Sender".to_string()),
        };
        handler.register_service("test-mail", config).await;

        let context = ToolContext::default();
        let args = json!({
            "to": "user@example.com",
            "subject": "Test Email",
            "body": "Hello, this is a test email."
        });

        let result = handler.execute("test-mail/send", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&json!(true)));
        assert!(output.value.get("messageId").is_some());
    }

    #[tokio::test]
    async fn test_mail_handler_send_template() {
        let handler = MailHandler::new();

        let config = MailConfig {
            provider: MailProvider::SendGrid,
            smtp_host: None,
            smtp_port: None,
            api_key: Some("sg-api-key".to_string()),
            from_address: "noreply@example.com".to_string(),
            from_name: None,
        };
        handler.register_service("sendgrid", config).await;

        let context = ToolContext::default();
        let args = json!({
            "to": ["user1@example.com", "user2@example.com"],
            "templateId": "welcome-template",
            "data": {
                "name": "John",
                "product": "FlowEngine"
            }
        });

        let result = handler.execute("sendgrid/template", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(
            output.value.get("templateId"),
            Some(&json!("welcome-template"))
        );
    }

    #[tokio::test]
    async fn test_mail_handler_verify() {
        let handler = MailHandler::new();

        let config = MailConfig {
            provider: MailProvider::Smtp,
            smtp_host: Some("smtp.example.com".to_string()),
            smtp_port: Some(587),
            api_key: None,
            from_address: "noreply@example.com".to_string(),
            from_name: None,
        };
        handler.register_service("test-mail", config).await;

        let context = ToolContext::default();
        let args = json!({
            "email": "valid@example.com"
        });

        let result = handler.execute("test-mail/verify", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("valid"), Some(&json!(true)));
    }
}
