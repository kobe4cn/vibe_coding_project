//! ToolSpec 规范数据模型
//!
//! 实现与 `tool-service.md` 定义的 URI 格式 `tool-type://tool-service-id/tool-id` 对齐的
//! 分层配置结构。
//!
//! # 层次结构
//!
//! - `ToolService` - 工具服务，包含公共配置（如认证、超时）
//!   - `Tool` - 具体工具，包含参数定义
//!     - `ToolArgs` - 工具参数（类型定义、输入参数、输出参数）

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 工具服务类型
///
/// 对应 `tool-service.md` 中定义的 10 种工具服务类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ToolType {
    /// HTTP API 调用 (`api://`)
    Api,
    /// MCP 服务调用 (`mcp://`)
    Mcp,
    /// 数据库操作 (`db://`)
    Db,
    /// 子流程调用 (`flow://`)
    Flow,
    /// AI Agent 调用 (`agent://`)
    Agent,
    /// 微服务调用 (`svc://`)
    Svc,
    /// 对象存储 (`oss://`)
    Oss,
    /// 消息队列 (`mq://`)
    Mq,
    /// 邮件服务 (`mail://`)
    Mail,
    /// 短信服务 (`sms://`)
    Sms,
}

impl ToolType {
    /// 获取 URI 前缀
    pub fn uri_prefix(&self) -> &'static str {
        match self {
            ToolType::Api => "api://",
            ToolType::Mcp => "mcp://",
            ToolType::Db => "db://",
            ToolType::Flow => "flow://",
            ToolType::Agent => "agent://",
            ToolType::Svc => "svc://",
            ToolType::Oss => "oss://",
            ToolType::Mq => "mq://",
            ToolType::Mail => "mail://",
            ToolType::Sms => "sms://",
        }
    }

    /// 从字符串解析工具类型
    pub fn from_strs(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "api" => Some(ToolType::Api),
            "mcp" => Some(ToolType::Mcp),
            "db" => Some(ToolType::Db),
            "flow" => Some(ToolType::Flow),
            "agent" => Some(ToolType::Agent),
            "svc" => Some(ToolType::Svc),
            "oss" => Some(ToolType::Oss),
            "mq" => Some(ToolType::Mq),
            "mail" => Some(ToolType::Mail),
            "sms" => Some(ToolType::Sms),
            _ => None,
        }
    }
}

impl std::fmt::Display for ToolType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ToolType::Api => "api",
            ToolType::Mcp => "mcp",
            ToolType::Db => "db",
            ToolType::Flow => "flow",
            ToolType::Agent => "agent",
            ToolType::Svc => "svc",
            ToolType::Oss => "oss",
            ToolType::Mq => "mq",
            ToolType::Mail => "mail",
            ToolType::Sms => "sms",
        };
        write!(f, "{}", s)
    }
}

/// 工具服务（对应 tool-service-id）
///
/// 定义一组相关工具的公共配置，如认证方式、超时设置等。
///
/// # URI 格式
///
/// `tool-type://tool-service-id/tool-id?[options]`
///
/// 例如：`api://crm/customer_list` 中，`crm` 是 tool-service-id
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolService {
    /// 唯一标识（UUID 格式）
    pub id: String,
    /// 工具服务类型
    pub tool_type: ToolType,
    /// 服务代码（用于 URI，如 "crm"）
    pub code: String,
    /// 服务显示名称
    pub name: String,
    /// 服务描述
    #[serde(default)]
    pub description: Option<String>,
    /// 服务级配置（认证、超时等）
    pub config: ToolServiceConfig,
    /// 服务下的工具列表
    #[serde(default)]
    pub tools: Vec<Tool>,
    /// 租户 ID
    pub tenant_id: String,
    /// 是否启用
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 创建时间
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
    /// 更新时间
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
}

fn default_true() -> bool {
    true
}

/// 工具服务配置
///
/// 根据 ToolType 不同，配置内容有所区别
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ToolServiceConfig {
    /// API 服务配置
    Api(ApiConfig),
    /// MCP 服务配置
    Mcp(McpConfig),
    /// 数据库服务配置
    Db(DbConfig),
    /// 子流程服务配置
    Flow(FlowConfig),
    /// Agent 服务配置
    Agent(AgentConfig),
    /// 微服务配置
    Svc(SvcConfig),
    /// OSS 服务配置
    Oss(OssConfig),
    /// 消息队列服务配置
    Mq(MqConfig),
    /// 邮件服务配置
    Mail(MailConfig),
    /// 短信服务配置
    Sms(SmsConfig),
}

/// API 服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// 基础 URL
    pub base_url: String,
    /// 认证方式
    #[serde(default)]
    pub auth: Option<ApiAuth>,
    /// 默认请求头
    #[serde(default)]
    pub default_headers: HashMap<String, String>,
    /// 超时时间（毫秒）
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    /// 重试配置
    #[serde(default)]
    pub retry: Option<RetryConfig>,
}

fn default_timeout() -> u64 {
    30000
}

/// API 认证方式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ApiAuth {
    /// Basic 认证
    Basic { username: String, password: String },
    /// Bearer Token 认证
    Bearer { token: String },
    /// OAuth2 认证
    OAuth2 {
        client_id: String,
        client_secret: String,
        token_url: String,
        #[serde(default)]
        scopes: Vec<String>,
    },
    /// API Key 认证
    ApiKey {
        header_name: String,
        api_key: String,
    },
}

/// 重试配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryConfig {
    /// 最大重试次数
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
    /// 初始等待时间（毫秒）
    #[serde(default = "default_initial_delay")]
    pub initial_delay_ms: u64,
    /// 最大等待时间（毫秒）
    #[serde(default = "default_max_delay")]
    pub max_delay_ms: u64,
    /// 是否使用指数退避
    #[serde(default = "default_true")]
    pub exponential: bool,
}

fn default_max_retries() -> u32 {
    3
}

fn default_initial_delay() -> u64 {
    1000
}

fn default_max_delay() -> u64 {
    30000
}

/// MCP 服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    /// 传输方式
    pub transport: McpTransport,
    /// 服务器信息
    #[serde(default)]
    pub server_info: Option<McpServerInfo>,
    /// 客户端信息
    #[serde(default)]
    pub client_info: Option<McpClientInfo>,
    /// 超时时间（毫秒）
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
}

/// MCP 传输方式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum McpTransport {
    /// 标准输入输出
    Stdio {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        env: HashMap<String, String>,
    },
    /// WebSocket
    WebSocket { url: String },
    /// Server-Sent Events
    Sse { url: String },
    /// HTTP
    Http { url: String },
}

/// MCP 服务器信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpServerInfo {
    pub name: Option<String>,
    pub version: Option<String>,
}

/// MCP 客户端信息
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpClientInfo {
    pub name: String,
    pub version: String,
}

/// 数据库服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConfig {
    /// 数据库类型
    pub db_type: DbType,
    /// 连接字符串
    pub connection_string: String,
    /// 默认 Schema
    #[serde(default)]
    pub schema: Option<String>,
    /// 连接池大小
    #[serde(default = "default_pool_size")]
    pub pool_size: u32,
    /// 超时时间（毫秒）
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    /// 是否只读
    #[serde(default)]
    pub read_only: bool,
}

fn default_pool_size() -> u32 {
    10
}

/// 数据库类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DbType {
    PostgreSQL,
    MySQL,
    SQLite,
    MongoDB,
    Redis,
    Elasticsearch,
    ClickHouse,
}

/// 子流程服务配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FlowConfig {
    /// 流程调用超时（毫秒）
    #[serde(default = "default_flow_timeout")]
    pub timeout_ms: u64,
    /// 是否异步执行
    #[serde(default)]
    pub async_execution: bool,
}

fn default_flow_timeout() -> u64 {
    60000
}

/// Agent 服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// 模型提供商
    pub provider: String,
    /// 模型名称
    pub model: String,
    /// API Key
    #[serde(default)]
    pub api_key: Option<String>,
    /// API 基础 URL
    #[serde(default)]
    pub base_url: Option<String>,
    /// 超时时间（毫秒）
    #[serde(default = "default_agent_timeout")]
    pub timeout_ms: u64,
}

fn default_agent_timeout() -> u64 {
    120000
}

/// 微服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvcConfig {
    /// 服务发现方式
    pub discovery: ServiceDiscovery,
    /// 协议
    #[serde(default)]
    pub protocol: ServiceProtocol,
    /// 超时时间（毫秒）
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    /// 负载均衡策略
    #[serde(default)]
    pub load_balancer: LoadBalancer,
}

/// 服务发现方式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ServiceDiscovery {
    /// 静态配置
    Static { endpoints: Vec<String> },
    /// Consul
    Consul {
        address: String,
        service_name: String,
    },
    /// Kubernetes DNS
    K8sDns {
        service_name: String,
        namespace: String,
    },
}

/// 服务协议
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceProtocol {
    #[default]
    Http,
    Grpc,
}

/// 负载均衡策略
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LoadBalancer {
    #[default]
    RoundRobin,
    Random,
    LeastConnections,
    Weighted,
}

/// OSS 服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OssConfig {
    /// 存储提供商
    pub provider: OssProvider,
    /// Bucket 名称
    pub bucket: String,
    /// 区域
    #[serde(default)]
    pub region: Option<String>,
    /// 自定义 Endpoint
    #[serde(default)]
    pub endpoint: Option<String>,
    /// 访问凭证
    pub credentials: OssCredentials,
    /// 是否使用 Path-style 访问
    #[serde(default)]
    pub path_style: bool,
}

/// OSS 提供商
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OssProvider {
    S3,
    AliOss,
    MinIO,
    Azure,
    Gcs,
}

/// OSS 凭证
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OssCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    #[serde(default)]
    pub session_token: Option<String>,
}

/// 消息队列服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MqConfig {
    /// 消息中间件类型
    pub broker: MqBroker,
    /// 连接字符串
    pub connection_string: String,
    /// 默认队列/Topic
    #[serde(default)]
    pub default_queue: Option<String>,
    /// 默认 Exchange（RabbitMQ）
    #[serde(default)]
    pub default_exchange: Option<String>,
    /// 默认 Routing Key（RabbitMQ）
    #[serde(default)]
    pub default_routing_key: Option<String>,
    /// 消息序列化格式
    #[serde(default)]
    pub serialization: MessageSerialization,
}

/// 消息中间件类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MqBroker {
    RabbitMq,
    Kafka,
    RocketMq,
    Redis,
}

/// 消息序列化格式
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageSerialization {
    #[default]
    Json,
    Protobuf,
    Avro,
}

/// 邮件服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailConfig {
    /// 邮件提供商
    pub provider: MailProvider,
    /// SMTP 主机（SMTP 方式）
    #[serde(default)]
    pub smtp_host: Option<String>,
    /// SMTP 端口
    #[serde(default)]
    pub smtp_port: Option<u16>,
    /// API Key（API 方式）
    #[serde(default)]
    pub api_key: Option<String>,
    /// 发件人地址
    pub from_address: String,
    /// 发件人名称
    #[serde(default)]
    pub from_name: Option<String>,
}

/// 邮件提供商
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MailProvider {
    Smtp,
    SendGrid,
    Mailgun,
    Ses,
    Aliyun,
}

/// 短信服务配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmsConfig {
    /// 短信提供商
    pub provider: SmsProvider,
    /// API Key
    pub api_key: String,
    /// API Secret
    #[serde(default)]
    pub api_secret: Option<String>,
    /// 签名名称
    #[serde(default)]
    pub sign_name: Option<String>,
    /// 区域
    #[serde(default)]
    pub region: Option<String>,
}

/// 短信提供商
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SmsProvider {
    Aliyun,
    Tencent,
    Twilio,
}

// ============================================================================
// 工具定义
// ============================================================================

/// 工具（对应 tool-id）
///
/// 定义一个具体的工具及其参数。
///
/// # URI 格式
///
/// `tool-type://tool-service-id/tool-id?[options]`
///
/// 例如：`api://crm/customer_list` 中，`customer_list` 是 tool-id
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    /// 唯一标识（UUID 格式）
    pub id: String,
    /// 所属服务 ID
    pub service_id: String,
    /// 工具代码（用于 URI，如 "customer_list"）
    pub code: String,
    /// 工具显示名称
    pub name: String,
    /// 工具描述
    #[serde(default)]
    pub description: Option<String>,
    /// 工具参数定义
    #[serde(default)]
    pub args: ToolArgs,
    /// 扩展配置选项
    #[serde(default)]
    pub opts: Option<ConfigOptions>,
    /// 是否启用
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// 创建时间
    #[serde(default)]
    pub created_at: Option<DateTime<Utc>>,
    /// 更新时间
    #[serde(default)]
    pub updated_at: Option<DateTime<Utc>>,
}

/// 工具参数（对齐 ToolSpec.java）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ToolArgs {
    /// 类型定义
    #[serde(default)]
    pub defs: HashMap<String, TypeDef>,
    /// 输入参数
    #[serde(default, rename = "in")]
    pub input: Vec<ParamDef>,
    /// 输出定义
    #[serde(default, rename = "out")]
    pub output: Option<OutputDef>,
}

/// 类型定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeDef {
    /// 类型描述
    #[serde(default)]
    pub description: Option<String>,
    /// 字段列表
    #[serde(default)]
    pub fields: Vec<FieldDef>,
}

/// 字段定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDef {
    /// 字段名称
    pub name: String,
    /// 字段类型（如 "string", "int", "Order[]" 等）
    #[serde(rename = "type")]
    pub field_type: String,
    /// 是否可空
    #[serde(default)]
    pub nullable: bool,
    /// 字段描述
    #[serde(default)]
    pub description: Option<String>,
}

/// 参数定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamDef {
    /// 参数名称
    pub name: String,
    /// 参数类型
    #[serde(rename = "type")]
    pub param_type: String,
    /// 是否可空
    #[serde(default)]
    pub nullable: bool,
    /// 默认值
    #[serde(default)]
    pub default_value: Option<serde_json::Value>,
    /// 参数描述
    #[serde(default)]
    pub description: Option<String>,
    /// 是否为内置参数（如 tenantId, buCode）
    #[serde(default)]
    pub builtin: bool,
}

/// 输出定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputDef {
    /// 输出类型
    #[serde(rename = "type")]
    pub output_type: String,
    /// 输出描述
    #[serde(default)]
    pub description: Option<String>,
}

/// 扩展配置选项
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ConfigOptions {
    /// HTTP 方法（API 类型）
    #[serde(default)]
    pub method: Option<String>,
    /// 路径（API 类型）
    #[serde(default)]
    pub path: Option<String>,
    /// 请求头
    #[serde(default)]
    pub headers: HashMap<String, String>,
    /// 表名（DB 类型）
    #[serde(default)]
    pub table: Option<String>,
    /// 操作类型（DB 类型）
    #[serde(default)]
    pub operation: Option<String>,
    /// 其他选项
    #[serde(default, flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

// ============================================================================
// 辅助方法
// ============================================================================

impl ToolService {
    /// 创建新的工具服务
    pub fn new(
        tool_type: ToolType,
        code: impl Into<String>,
        name: impl Into<String>,
        config: ToolServiceConfig,
        tenant_id: impl Into<String>,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            tool_type,
            code: code.into(),
            name: name.into(),
            description: None,
            config,
            tools: Vec::new(),
            tenant_id: tenant_id.into(),
            enabled: true,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        }
    }

    /// 添加工具
    pub fn add_tool(&mut self, mut tool: Tool) {
        tool.service_id = self.id.clone();
        self.tools.push(tool);
    }

    /// 构建工具 URI
    pub fn build_uri(&self, tool_code: &str) -> String {
        format!("{}://{}/{}", self.tool_type, self.code, tool_code)
    }
}

impl Tool {
    /// 创建新的工具
    pub fn new(code: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            service_id: String::new(),
            code: code.into(),
            name: name.into(),
            description: None,
            args: ToolArgs::default(),
            opts: None,
            enabled: true,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        }
    }

    /// 设置参数定义
    pub fn with_args(mut self, args: ToolArgs) -> Self {
        self.args = args;
        self
    }

    /// 设置描述
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    /// 添加输入参数
    pub fn add_input(&mut self, param: ParamDef) {
        self.args.input.push(param);
    }
}

impl ToolArgs {
    /// 创建新的参数定义
    pub fn new() -> Self {
        Self::default()
    }

    /// 添加类型定义
    pub fn with_def(mut self, name: impl Into<String>, def: TypeDef) -> Self {
        self.defs.insert(name.into(), def);
        self
    }

    /// 添加输入参数
    pub fn with_input(mut self, param: ParamDef) -> Self {
        self.input.push(param);
        self
    }

    /// 设置输出定义
    pub fn with_output(mut self, output: OutputDef) -> Self {
        self.output = Some(output);
        self
    }
}

impl ParamDef {
    /// 创建必填参数
    pub fn required(name: impl Into<String>, param_type: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            param_type: param_type.into(),
            nullable: false,
            default_value: None,
            description: None,
            builtin: false,
        }
    }

    /// 创建可选参数
    pub fn optional(name: impl Into<String>, param_type: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            param_type: param_type.into(),
            nullable: true,
            default_value: None,
            description: None,
            builtin: false,
        }
    }

    /// 创建内置参数
    pub fn builtin(name: impl Into<String>, param_type: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            param_type: param_type.into(),
            nullable: false,
            default_value: None,
            description: None,
            builtin: true,
        }
    }

    /// 设置默认值
    pub fn with_default(mut self, value: serde_json::Value) -> Self {
        self.default_value = Some(value);
        self
    }

    /// 设置描述
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }
}

// ============================================================================
// 测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_type_uri_prefix() {
        assert_eq!(ToolType::Api.uri_prefix(), "api://");
        assert_eq!(ToolType::Db.uri_prefix(), "db://");
        assert_eq!(ToolType::Mcp.uri_prefix(), "mcp://");
    }

    #[test]
    fn test_tool_type_from_str() {
        assert_eq!(ToolType::from_strs("api"), Some(ToolType::Api));
        assert_eq!(ToolType::from_strs("API"), Some(ToolType::Api));
        assert_eq!(ToolType::from_strs("unknown"), None);
    }

    #[test]
    fn test_create_tool_service() {
        let config = ToolServiceConfig::Api(ApiConfig {
            base_url: "https://api.example.com".to_string(),
            auth: None,
            default_headers: HashMap::new(),
            timeout_ms: 30000,
            retry: None,
        });

        let service = ToolService::new(ToolType::Api, "crm", "CRM 服务", config, "tenant-1");

        assert_eq!(service.tool_type, ToolType::Api);
        assert_eq!(service.code, "crm");
        assert!(service.enabled);
    }

    #[test]
    fn test_create_tool_with_args() {
        let tool = Tool::new("customer_list", "客户列表")
            .with_description("获取客户列表")
            .with_args(
                ToolArgs::new()
                    .with_input(
                        ParamDef::optional("page", "int").with_default(serde_json::json!(1)),
                    )
                    .with_input(
                        ParamDef::optional("pageSize", "int").with_default(serde_json::json!(20)),
                    )
                    .with_output(OutputDef {
                        output_type: "Customer[]".to_string(),
                        description: Some("客户列表".to_string()),
                    }),
            );

        assert_eq!(tool.code, "customer_list");
        assert_eq!(tool.args.input.len(), 2);
        assert!(tool.args.output.is_some());
    }

    #[test]
    fn test_build_uri() {
        let config = ToolServiceConfig::Api(ApiConfig {
            base_url: "https://api.example.com".to_string(),
            auth: None,
            default_headers: HashMap::new(),
            timeout_ms: 30000,
            retry: None,
        });

        let service = ToolService::new(ToolType::Api, "crm", "CRM 服务", config, "tenant-1");

        assert_eq!(
            service.build_uri("customer_list"),
            "api://crm/customer_list"
        );
    }

    #[test]
    fn test_serialize_deserialize() {
        let tool = Tool::new("test", "Test Tool")
            .with_args(ToolArgs::new().with_input(ParamDef::required("id", "string")));

        let json = serde_json::to_string(&tool).unwrap();
        let deserialized: Tool = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.code, "test");
        assert_eq!(deserialized.args.input.len(), 1);
    }

    #[test]
    fn test_db_config() {
        let config = ToolServiceConfig::Db(DbConfig {
            db_type: DbType::PostgreSQL,
            connection_string: "postgres://localhost/test".to_string(),
            schema: Some("public".to_string()),
            pool_size: 10,
            timeout_ms: 30000,
            read_only: false,
        });

        let service = ToolService::new(ToolType::Db, "main_db", "主数据库", config, "tenant-1");

        assert_eq!(service.tool_type, ToolType::Db);
        assert_eq!(service.build_uri("list"), "db://main_db/list");
    }
}
