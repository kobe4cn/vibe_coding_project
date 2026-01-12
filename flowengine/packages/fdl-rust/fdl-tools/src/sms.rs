//! SMS (短信服务) Handler
//!
//! 提供短信发送服务的工具处理器，支持多种短信服务商：
//! - 阿里云短信
//! - 腾讯云短信
//! - Twilio

use crate::error::{ToolError, ToolResult};
use crate::models::SmsConfig;
use crate::registry::{ToolHandler, ToolMetadata};
use crate::{ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// SMS 操作类型
#[derive(Debug, Clone, PartialEq)]
pub enum SmsOperation {
    /// 发送短信
    Send,
    /// 发送模板短信
    SendTemplate,
    /// 批量发送
    BatchSend,
    /// 查询发送状态
    Status,
    /// 查询余额
    Balance,
}

impl SmsOperation {
    pub fn from_strs(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "send" | "sms" => Some(SmsOperation::Send),
            "template" | "send_template" | "sendtemplate" => Some(SmsOperation::SendTemplate),
            "batch" | "batch_send" | "batchsend" => Some(SmsOperation::BatchSend),
            "status" | "query" | "check" => Some(SmsOperation::Status),
            "balance" | "quota" => Some(SmsOperation::Balance),
            _ => None,
        }
    }
}

/// SMS 服务连接配置
struct SmsConnection {
    config: SmsConfig,
}

/// SMS 工具处理器
///
/// 处理 sms:// URI 格式的工具调用。
/// URI 格式: sms://service-id/operation
pub struct SmsHandler {
    /// 配置缓存：service_id -> SmsConnection
    connections: Arc<RwLock<HashMap<String, SmsConnection>>>,
}

impl SmsHandler {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 注册短信服务配置
    pub async fn register_service(&self, service_id: &str, config: SmsConfig) {
        let mut connections = self.connections.write().await;
        connections.insert(service_id.to_string(), SmsConnection { config });
    }

    /// 解析路径
    fn parse_path(&self, path: &str) -> ToolResult<(String, SmsOperation)> {
        let parts: Vec<&str> = path.splitn(2, '/').collect();

        if parts.is_empty() {
            return Err(ToolError::InvalidUri("Empty SMS path".to_string()));
        }

        let service_id = parts[0].to_string();
        let operation = if parts.len() > 1 {
            SmsOperation::from_strs(parts[1]).unwrap_or(SmsOperation::Send)
        } else {
            SmsOperation::Send
        };

        Ok((service_id, operation))
    }

    /// 标准化手机号格式
    fn normalize_phone(&self, phone: &str, config: &SmsConfig) -> String {
        let phone = phone.trim();
        // 如果配置了区域且手机号不带国际码，添加国际码
        if let Some(region) = &config.region
            && !phone.starts_with('+')
        {
            let country_code = match region.to_lowercase().as_str() {
                "cn" | "china" => "+86",
                "us" | "usa" => "+1",
                "uk" => "+44",
                "hk" => "+852",
                "tw" => "+886",
                _ => "",
            };
            if !country_code.is_empty() {
                return format!("{}{}", country_code, phone);
            }
        }
        phone.to_string()
    }

    /// 执行发送操作（直接发送文本短信）
    async fn execute_send(&self, config: &SmsConfig, args: &Value) -> ToolResult<Value> {
        let phone = args
            .get("phone")
            .or_else(|| args.get("to"))
            .or_else(|| args.get("mobile"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'phone' parameter".to_string()))?;

        let content = args
            .get("content")
            .or_else(|| args.get("message"))
            .or_else(|| args.get("text"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'content' parameter".to_string()))?;

        let normalized_phone = self.normalize_phone(phone, config);
        let message_id = uuid::Uuid::new_v4().to_string();

        // 模拟发送结果
        let result = json!({
            "success": true,
            "messageId": message_id,
            "provider": format!("{:?}", config.provider),
            "phone": normalized_phone,
            "signName": config.sign_name,
            "content": content,
            "segments": (content.len() / 70) + 1,  // 短信分段计算
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "status": "submitted",
        });

        Ok(result)
    }

    /// 执行模板短信发送
    async fn execute_send_template(&self, config: &SmsConfig, args: &Value) -> ToolResult<Value> {
        let phone = args
            .get("phone")
            .or_else(|| args.get("to"))
            .or_else(|| args.get("mobile"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'phone' parameter".to_string()))?;

        let template_code = args
            .get("templateCode")
            .or_else(|| args.get("template"))
            .or_else(|| args.get("templateId"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ToolError::InvalidArgument("Missing 'templateCode' parameter".to_string())
            })?;

        let template_param = args
            .get("templateParam")
            .or_else(|| args.get("params"))
            .or_else(|| args.get("data"));

        let normalized_phone = self.normalize_phone(phone, config);
        let message_id = uuid::Uuid::new_v4().to_string();

        let result = json!({
            "success": true,
            "messageId": message_id,
            "provider": format!("{:?}", config.provider),
            "phone": normalized_phone,
            "signName": config.sign_name,
            "templateCode": template_code,
            "templateParam": template_param,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "status": "submitted",
        });

        Ok(result)
    }

    /// 批量发送
    async fn execute_batch_send(&self, config: &SmsConfig, args: &Value) -> ToolResult<Value> {
        let phones = args
            .get("phones")
            .or_else(|| args.get("to"))
            .or_else(|| args.get("mobiles"))
            .ok_or_else(|| ToolError::InvalidArgument("Missing 'phones' parameter".to_string()))?;

        let phone_list: Vec<String> = match phones {
            Value::Array(arr) => arr
                .iter()
                .filter_map(|v| v.as_str().map(|s| self.normalize_phone(s, config)))
                .collect(),
            Value::String(s) => s
                .split(',')
                .map(|p| self.normalize_phone(p.trim(), config))
                .collect(),
            _ => {
                return Err(ToolError::InvalidArgument(
                    "'phones' must be an array or comma-separated string".to_string(),
                ));
            }
        };

        if phone_list.is_empty() {
            return Err(ToolError::InvalidArgument(
                "No valid phone numbers provided".to_string(),
            ));
        }

        let template_code = args
            .get("templateCode")
            .or_else(|| args.get("template"))
            .and_then(|v| v.as_str());

        let content = args
            .get("content")
            .or_else(|| args.get("message"))
            .and_then(|v| v.as_str());

        if template_code.is_none() && content.is_none() {
            return Err(ToolError::InvalidArgument(
                "Missing 'templateCode' or 'content' parameter".to_string(),
            ));
        }

        let batch_id = uuid::Uuid::new_v4().to_string();
        let total = phone_list.len();

        let result = json!({
            "success": true,
            "batchId": batch_id,
            "provider": format!("{:?}", config.provider),
            "phones": phone_list,
            "total": total,
            "signName": config.sign_name,
            "templateCode": template_code,
            "content": content,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "status": "submitted",
        });

        Ok(result)
    }

    /// 查询发送状态
    async fn execute_status(&self, _config: &SmsConfig, args: &Value) -> ToolResult<Value> {
        let message_id = args
            .get("messageId")
            .or_else(|| args.get("id"))
            .or_else(|| args.get("bizId"))
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
            "errorCode": null,
            "errorMessage": null,
        });

        Ok(result)
    }

    /// 查询余额/配额
    async fn execute_balance(&self, config: &SmsConfig, _args: &Value) -> ToolResult<Value> {
        // 模拟余额查询
        let result = json!({
            "success": true,
            "provider": format!("{:?}", config.provider),
            "balance": 1000,
            "unit": "条",
            "expiresAt": (chrono::Utc::now() + chrono::Duration::days(365)).to_rfc3339(),
        });

        Ok(result)
    }
}

impl Default for SmsHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ToolHandler for SmsHandler {
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
            ToolError::ToolNotFound(format!("SMS service not found: {}", service_id))
        })?;

        let result = match operation {
            SmsOperation::Send => self.execute_send(&connection.config, &args).await?,
            SmsOperation::SendTemplate => {
                self.execute_send_template(&connection.config, &args)
                    .await?
            }
            SmsOperation::BatchSend => self.execute_batch_send(&connection.config, &args).await?,
            SmsOperation::Status => self.execute_status(&connection.config, &args).await?,
            SmsOperation::Balance => self.execute_balance(&connection.config, &args).await?,
        };

        Ok(ToolOutput {
            value: result,
            duration_ms: start.elapsed().as_millis() as u64,
            messages: vec![],
        })
    }

    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "sms".to_string(),
            description: "SMS service handler for Aliyun, Tencent, Twilio".to_string(),
            input_schema: Some(json!({
                "type": "object",
                "properties": {
                    "phone": { "type": "string", "description": "Recipient phone number" },
                    "content": { "type": "string", "description": "Message content (for direct send)" },
                    "templateCode": { "type": "string", "description": "Template code (for template send)" },
                    "templateParam": { "type": "object", "description": "Template parameters" },
                    "phones": {
                        "oneOf": [
                            { "type": "array", "items": { "type": "string" } },
                            { "type": "string" }
                        ],
                        "description": "Phone numbers for batch send"
                    },
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
    use crate::models::SmsProvider;

    #[tokio::test]
    async fn test_sms_handler_send() {
        let handler = SmsHandler::new();

        let config = SmsConfig {
            provider: SmsProvider::Aliyun,
            api_key: "test-key".to_string(),
            api_secret: Some("test-secret".to_string()),
            sign_name: Some("FlowEngine".to_string()),
            region: Some("cn".to_string()),
        };
        handler.register_service("aliyun-sms", config).await;

        let context = ToolContext::default();
        let args = json!({
            "phone": "13800138000",
            "content": "Your verification code is 123456"
        });

        let result = handler.execute("aliyun-sms/send", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&json!(true)));
        assert!(output.value.get("messageId").is_some());
        // 验证国际码添加
        assert_eq!(output.value.get("phone"), Some(&json!("+8613800138000")));
    }

    #[tokio::test]
    async fn test_sms_handler_template() {
        let handler = SmsHandler::new();

        let config = SmsConfig {
            provider: SmsProvider::Aliyun,
            api_key: "test-key".to_string(),
            api_secret: Some("test-secret".to_string()),
            sign_name: Some("FlowEngine".to_string()),
            region: None,
        };
        handler.register_service("aliyun-sms", config).await;

        let context = ToolContext::default();
        let args = json!({
            "phone": "+8613800138000",
            "templateCode": "SMS_12345",
            "templateParam": {
                "code": "123456"
            }
        });

        let result = handler.execute("aliyun-sms/template", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("templateCode"), Some(&json!("SMS_12345")));
    }

    #[tokio::test]
    async fn test_sms_handler_batch() {
        let handler = SmsHandler::new();

        let config = SmsConfig {
            provider: SmsProvider::Tencent,
            api_key: "test-key".to_string(),
            api_secret: Some("test-secret".to_string()),
            sign_name: Some("FlowEngine".to_string()),
            region: Some("cn".to_string()),
        };
        handler.register_service("tencent-sms", config).await;

        let context = ToolContext::default();
        let args = json!({
            "phones": ["13800138001", "13800138002", "13800138003"],
            "templateCode": "SMS_BATCH",
            "params": { "product": "FlowEngine" }
        });

        let result = handler.execute("tencent-sms/batch", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("total"), Some(&json!(3)));
    }
}
