# 技术设计文档：ToolSpec 规范集成与系统增强

## Context

### 背景

FlowEngine 是一个完整的可视化流程编排系统，包含 React 前端和 Rust 后端。当前系统已具备基础的流程编辑和执行能力，但与 `ToolSpec.java` 定义的工具规范、`fdl-spec.md` 定义的 FDL 规范、`gml-spec.md` 定义的 GML 规范之间存在实现差距。

### 约束条件

1. **向后兼容**: 现有流程定义和工具配置需要平滑迁移
2. **渐进式实施**: 分阶段交付，每阶段可独立使用
3. **多租户支持**: 所有资源按租户隔离
4. **性能要求**: 并行执行需控制资源消耗

### 利益相关方

- **业务用户**: 期望低代码方式编排流程
- **开发者**: 期望完整的工具集成和调试能力
- **运维人员**: 期望可监控和可追溯的执行记录

## Goals / Non-Goals

### Goals

1. **ToolSpec 完整对齐**: 工具配置支持完整的参数定义（`args.defs/in/out`）
2. **FDL 规范完整实现**: 所有节点类型和执行语义完整支持
3. **GML 求值器完善**: 所有原型方法和表达式语法完整实现
4. **工具管理增强**: 前后端统一的工具配置和发现能力
5. **执行器优化**: 并行执行、状态持久化、断点恢复

6. **自定义节点开发框架**: 实现用户自定义节点能力，支持插件化扩展
7. **图形化 GML 编辑器**: 文本编辑 + 可视化拖拽双模式
8. **多语言 UDF 运行时**: 支持 SQL、JavaScript、Python 和 WASM

### Non-Goals

1. **实时协作编辑**: 本阶段不实现多人同时编辑同一流程
2. **版本控制集成**: 不实现 Git 等版本控制系统的直接集成
3. **流程市场**: 不实现流程模板的发布和共享市场



## Decisions

### D1: ToolSpec 数据模型设计

**决策**: 采用分层配置结构，ToolService 包含多个 Tool，Tool 包含 ToolArgs

**理由**:
- 与 `tool-service.md` 定义的 URI 格式 `tool-type://tool-service-id/tool-id` 对齐
- 支持工具服务级别的公共配置（如认证、超时）
- 支持工具级别的参数定义

**数据模型**:

```rust
// 工具服务（对应 tool-service-id）
pub struct ToolService {
    pub id: String,                    // 唯一标识
    pub tool_type: ToolType,           // mcp/api/db/flow/agent/oss/mq/mail/sms/svc
    pub name: String,                  // 显示名称
    pub description: Option<String>,
    pub config: ToolServiceConfig,     // 服务级配置（认证、超时等）
    pub tools: Vec<Tool>,              // 服务下的工具列表
    pub tenant_id: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// 工具（对应 tool-id）
pub struct Tool {
    pub id: String,                    // 唯一标识
    pub code: String,                  // 工具代码（如 customer_list）
    pub name: String,                  // 工具名称
    pub description: Option<String>,
    pub args: ToolArgs,                // 参数定义
    pub opts: Option<ConfigOptions>,   // 扩展配置
}

// 工具参数（对齐 ToolSpec.java）
pub struct ToolArgs {
    pub defs: HashMap<String, TypeDef>,  // 类型定义
    pub input: Vec<ParamDef>,            // 输入参数
    pub output: Option<OutputDef>,       // 输出定义
}

// 类型定义
pub struct TypeDef {
    pub fields: Vec<FieldDef>,
}

pub struct FieldDef {
    pub name: String,
    pub field_type: String,              // string, int, Order[], etc.
    pub nullable: bool,
    pub description: Option<String>,
}

// 参数定义
pub struct ParamDef {
    pub name: String,
    pub param_type: String,
    pub nullable: bool,
    pub default_value: Option<serde_json::Value>,
    pub description: Option<String>,
}
```

### D2: GML 求值器架构

**决策**: 使用 Pest 库实现 PEG 解析器，生成 AST 后进行求值

**理由**:
- Pest 是 Rust 生态成熟的 PEG 解析器，语法定义清晰
- AST 方式便于实现类型检查和优化
- 支持缓存解析结果提升性能

**架构**:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  GML 文本   │ -> │  Pest 解析  │ -> │    AST      │
└─────────────┘    └─────────────┘    └─────────────┘
                                            │
                                            ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   结果值    │ <- │  求值引擎   │ <- │ 执行上下文  │
└─────────────┘    └─────────────┘    └─────────────┘
```

**GML 语法规则 (Pest)**:

```pest
// 顶层
script = { SOI ~ (statement ~ ("," ~ statement)*)? ~ EOI }
statement = { assignment | return_stmt | expression }
assignment = { identifier ~ "=" ~ expression }
return_stmt = { "return" ~ expression }

// 表达式
expression = { conditional | logical_or }
conditional = { logical_or ~ "?" ~ expression ~ ":" ~ expression }
logical_or = { logical_and ~ ("||" ~ logical_and)* }
logical_and = { equality ~ ("&&" ~ equality)* }
equality = { comparison ~ (("==" | "!=") ~ comparison)* }
comparison = { additive ~ (("<" | ">" | "<=" | ">=") ~ additive)* }
additive = { multiplicative ~ (("+" | "-") ~ multiplicative)* }
multiplicative = { unary ~ (("*" | "/" | "%") ~ unary)* }
unary = { ("!" | "-")? ~ postfix }
postfix = { primary ~ (call | index | field_access)* }

// 基础元素
primary = { literal | identifier | "(" ~ expression ~ ")" | object | array | case_expr }
literal = { string | template | number | boolean | null }
identifier = @{ (ASCII_ALPHA | "_" | "$") ~ (ASCII_ALPHANUMERIC | "_")* }
field_access = { "." ~ identifier }
index = { "[" ~ (expression | "#") ~ "]" }
call = { "(" ~ (expression ~ ("," ~ expression)*)? ~ ")" }

// 复合结构
object = { "{" ~ (spread | assignment)* ~ "}" }
spread = { "..." ~ expression ~ ("." ~ "proj" ~ "(" ~ string ~ ")")? }
array = { "[" ~ (expression ~ ("," ~ expression)*)? ~ "]" }

// CASE 表达式
case_expr = { "CASE" ~ when_clause+ ~ else_clause? ~ "END" }
when_clause = { "WHEN" ~ expression ~ "THEN" ~ expression }
else_clause = { "ELSE" ~ expression }
```

### D3: 并行执行调度设计

**决策**: 使用拓扑排序 + 信号量控制的并行调度模型

**理由**:
- 拓扑排序可正确识别节点依赖关系
- 信号量控制并发度，避免资源耗尽
- 支持动态调整并行度

**算法流程**:

```
1. 构建依赖图: DAG<NodeId, Vec<NodeId>>
2. 计算入度: Map<NodeId, usize>
3. 初始化就绪队列: 入度为 0 的节点
4. 循环直到所有节点完成:
   a. 从就绪队列取节点（受信号量限制）
   b. 并行执行已取出的节点
   c. 节点完成后，更新后继节点入度
   d. 入度变为 0 的节点加入就绪队列
```

**并发控制**:

```rust
pub struct ParallelScheduler {
    semaphore: Arc<Semaphore>,       // 控制最大并行数
    max_parallelism: usize,          // 默认为 CPU 核心数
    timeout_per_node: Duration,      // 单节点超时
}
```

### D4: 工具发现与注册机制

**决策**: 支持多种工具来源，统一注册到 ManagedToolRegistry

**工具来源**:

1. **手动配置**: 通过 ToolsPage UI 或 API 创建
2. **OpenAPI 导入**: 解析 Swagger/OpenAPI 规范自动生成工具定义
3. **数据库元数据**: 从数据源自动发现表结构生成 CRUD 工具
4. **MCP 服务**: 连接 MCP 服务器获取可用工具列表

**注册流程**:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ 手动配置 UI  │    │ OpenAPI 导入 │    │ DB 元数据   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                           │
                           ▼
               ┌──────────────────────┐
               │   ToolDiscovery      │
               │   - 标准化转换       │
               │   - 去重和合并       │
               │   - 验证和清洗       │
               └──────────┬───────────┘
                          │
                          ▼
               ┌──────────────────────┐
               │ ManagedToolRegistry  │
               │   - 工具注册         │
               │   - URI 解析         │
               │   - 调用分发         │
               └──────────────────────┘
```

### D5: 前端工具管理 UI 设计

**决策**: 重构 ToolsPage 为四个主要模块

**模块划分**:

1. **服务管理** (ServiceManager)
   - 服务列表和搜索
   - 服务创建/编辑/删除
   - 服务启用/禁用

2. **工具管理** (ToolManager)
   - 工具列表（按服务分组）
   - 工具参数定义编辑
   - 工具测试调用

3. **数据源管理** (DatasourceManager)
   - 数据源连接配置
   - 表结构浏览
   - 连接测试

4. **UDF 管理** (UDFManager)
   - UDF 列表
   - 代码编辑器
   - 测试执行

**组件层次**:

```
ToolsPage
├── ServiceManager
│   ├── ServiceList
│   ├── ServiceForm
│   └── ServiceToolList
├── ToolManager
│   ├── ToolList
│   ├── ToolArgsEditor
│   │   ├── TypeDefEditor
│   │   ├── ParamDefEditor
│   │   └── OutputDefEditor
│   └── ToolTester
├── DatasourceManager
│   ├── DatasourceList
│   ├── DatasourceForm
│   ├── SchemaExplorer
│   └── ConnectionTester
└── UDFManager
    ├── UDFList
    ├── UDFCodeEditor
    └── UDFTester
```

### D6: 节点增强设计

**决策**: 使用工具选择器组件统一 ExecNode 的工具选择体验

**ToolSelector 组件**:

```typescript
interface ToolSelectorProps {
  value: string;                    // 当前 URI，如 "api://crm/customer_list"
  onChange: (uri: string) => void;
  toolTypes?: ToolType[];           // 限制可选类型
  placeholder?: string;
}

// 内部结构
<ToolSelector>
  <Select placeholder="选择服务类型">
    <Option value="api">API 服务</Option>
    <Option value="db">数据库</Option>
    <Option value="mcp">MCP 服务</Option>
    ...
  </Select>
  <Select placeholder="选择服务">
    {services.map(s => <Option value={s.id}>{s.name}</Option>)}
  </Select>
  <Select placeholder="选择工具">
    {tools.map(t => <Option value={t.code}>{t.name}</Option>)}
  </Select>
  <Input placeholder="选项 (可选)" />
</ToolSelector>
```

**参数自动映射**:

当选择工具后，根据 `ToolArgs.input` 自动生成 `args` 表达式的初始值：

```typescript
function generateArgsTemplate(toolArgs: ToolArgs): string {
  return toolArgs.input
    .map(p => `${p.name} = ${p.name}`)  // 默认映射同名变量
    .join(', ');
}
```

### D7: 各工具服务类型架构设计

**决策**: 为每种工具服务类型实现独立的 Handler，统一注册到 ToolExecutor

#### D7.1 API 服务架构 (api://)

```
┌─────────────────────────────────────────────────────────────┐
│                     ApiToolHandler                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ HttpClient  │    │ AuthManager │    │ RetryPolicy │     │
│  │ (reqwest)   │    │ - Basic     │    │ - Exponential│    │
│  │ - 连接池    │    │ - Bearer    │    │ - MaxRetries│     │
│  │ - 超时管理  │    │ - OAuth2    │    │ - Jitter    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│           │                │                  │              │
│           └────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼───────┐                        │
│                    │ RequestBuilder│                        │
│                    │ - URL 构建    │                        │
│                    │ - Header 注入 │                        │
│                    │ - Body 序列化 │                        │
│                    └───────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

**配置数据结构**:
```rust
pub struct ApiServiceConfig {
    pub base_url: String,
    pub auth: Option<ApiAuth>,
    pub default_headers: HashMap<String, String>,
    pub timeout_ms: u64,
    pub retry: Option<RetryConfig>,
}

pub enum ApiAuth {
    Basic { username: String, password: String },
    Bearer { token: String },
    OAuth2 {
        client_id: String,
        client_secret: String,
        token_url: String,
        scopes: Vec<String>,
    },
    ApiKey { header_name: String, api_key: String },
}
```

#### D7.2 数据库服务架构 (db://)

```
┌─────────────────────────────────────────────────────────────┐
│                     DbToolHandler                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 ConnectionPoolManager                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ PgPool   │  │ MySqlPool│  │ SqlitePool│          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                   CqlParser                          │   │
│  │  - 解析 CQL 表达式                                   │   │
│  │  - 转换为数据库特定 SQL                              │   │
│  │  - 参数绑定和防注入                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                 OperationRouter                      │   │
│  │  init/drop/take/list/page/stream/count/             │   │
│  │  create/modify/delete/save/bulk/native              │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │              MultiTenantInjector                     │   │
│  │  - 自动注入 tenant_id                                │   │
│  │  - 自动注入 bu_code                                  │   │
│  │  - 数据隔离验证                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**数据库操作实现**:
```rust
impl DbToolHandler {
    // 13 种数据库操作的实现
    async fn execute_init(&self, table: &str, schema: &TableSchema) -> Result<()>;
    async fn execute_drop(&self, table: &str) -> Result<()>;
    async fn execute_take(&self, table: &str, cql: &Cql, pk: &Value) -> Result<Option<Value>>;
    async fn execute_list(&self, table: &str, cql: &Cql) -> Result<Vec<Value>>;
    async fn execute_page(&self, table: &str, cql: &Cql, page: usize, size: usize) -> Result<PageResult>;
    async fn execute_stream(&self, table: &str, cql: &Cql) -> Result<impl Stream<Item = Value>>;
    async fn execute_count(&self, table: &str, cql: &Cql) -> Result<i64>;
    async fn execute_create(&self, table: &str, data: &Value) -> Result<Value>;
    async fn execute_modify(&self, table: &str, pk: &Value, data: &Value) -> Result<Value>;
    async fn execute_delete(&self, table: &str, pk: &Value) -> Result<bool>;
    async fn execute_save(&self, table: &str, data: &Value) -> Result<Value>;
    async fn execute_bulk(&self, table: &str, data: &[Value]) -> Result<BulkResult>;
    async fn execute_native(&self, sql: &str, params: &[Value]) -> Result<Value>;
}
```

#### D7.3 MCP 服务架构 (mcp://)

```
┌─────────────────────────────────────────────────────────────┐
│                     McpToolHandler                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              TransportManager                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ StdioTr  │  │ WebSocket│  │ SSE      │          │   │
│  │  │ ansport  │  │ Transport│  │ Transport│          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                McpProtocolHandler                    │   │
│  │  - initialize 握手                                   │   │
│  │  - tools/list 发现                                   │   │
│  │  - tools/call 调用                                   │   │
│  │  - notifications 处理                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │              CapabilityManager                       │   │
│  │  - 工具能力缓存                                      │   │
│  │  - 资源能力管理                                      │   │
│  │  - Prompt 能力管理                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**MCP 消息结构**:
```rust
#[derive(Serialize, Deserialize)]
pub struct McpRequest {
    pub jsonrpc: String,      // "2.0"
    pub id: RequestId,
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Serialize, Deserialize)]
pub struct McpResponse {
    pub jsonrpc: String,
    pub id: RequestId,
    pub result: Option<Value>,
    pub error: Option<McpError>,
}

pub struct McpServiceConfig {
    pub transport: McpTransport,
    pub server_info: Option<ServerInfo>,
    pub client_info: ClientInfo,
    pub timeout_ms: u64,
    pub capabilities: McpCapabilities,
}

pub enum McpTransport {
    Stdio { command: String, args: Vec<String>, env: HashMap<String, String> },
    WebSocket { url: String },
    Sse { url: String },
    Http { url: String },
}
```

#### D7.4 OSS 服务架构 (oss://)

```
┌─────────────────────────────────────────────────────────────┐
│                     OssToolHandler                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              StorageBackendAdapter                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ S3Client │  │ AliOSS   │  │ MinIO    │          │   │
│  │  │          │  │ Client   │  │ Client   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                OperationExecutor                     │   │
│  │  - load: 下载对象                                    │   │
│  │  - save: 上传对象                                    │   │
│  │  - list: 列出对象                                    │   │
│  │  - delete: 删除对象                                  │   │
│  │  - presign: 预签名 URL                               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**OSS 配置**:
```rust
pub struct OssServiceConfig {
    pub provider: OssProvider,
    pub bucket: String,
    pub region: Option<String>,
    pub endpoint: Option<String>,
    pub credentials: OssCredentials,
    pub path_style: bool,
}

pub enum OssProvider {
    S3,
    AliOss,
    MinIO,
    Azure,
    Gcs,
}

pub struct OssCredentials {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub session_token: Option<String>,
}
```

#### D7.5 MQ 服务架构 (mq://)

```
┌─────────────────────────────────────────────────────────────┐
│                     MqToolHandler                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MessageBrokerAdapter                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ RabbitMQ │  │ Kafka    │  │ RocketMQ │          │   │
│  │  │ Client   │  │ Producer │  │ Client   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                MessageProcessor                      │   │
│  │  - publish: 发布消息到队列                           │   │
│  │  - subscribe: 订阅队列（触发器模式）                 │   │
│  │  - ack/nack: 消息确认                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**MQ 配置**:
```rust
pub struct MqServiceConfig {
    pub broker: MqBroker,
    pub connection_string: String,
    pub default_queue: Option<String>,
    pub serialization: MessageSerialization,
}

pub enum MqBroker {
    RabbitMq,
    Kafka,
    RocketMq,
    Redis,
}

pub enum MessageSerialization {
    Json,
    Protobuf,
    Avro,
}
```

#### D7.6 Mail/SMS 服务架构

```
┌─────────────────────────────────────────────────────────────┐
│                  MailToolHandler / SmsToolHandler           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              NotificationProviderAdapter             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ SMTP     │  │ SendGrid │  │ Aliyun   │          │   │
│  │  │ Client   │  │ Client   │  │ DM/SMS   │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                TemplateRenderer                      │   │
│  │  - 模板变量替换                                      │   │
│  │  - HTML 邮件渲染                                     │   │
│  │  - 短信内容限制检查                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### D7.7 微服务调用架构 (svc://)

```
┌─────────────────────────────────────────────────────────────┐
│                     SvcToolHandler                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ServiceDiscovery                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ Static   │  │ Consul   │  │ K8s DNS  │          │   │
│  │  │ Config   │  │ Registry │  │ Discovery│          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │              ProtocolHandler                         │   │
│  │  ┌──────────┐  ┌──────────┐                         │   │
│  │  │ gRPC     │  │ HTTP/REST│                         │   │
│  │  │ Client   │  │ Client   │                         │   │
│  │  └──────────┘  └──────────┘                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │              LoadBalancer                            │   │
│  │  - Round Robin                                       │   │
│  │  - Weighted                                          │   │
│  │  - Least Connections                                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### D8: 统一工具执行器架构

**决策**: 实现统一的 ToolExecutor 作为所有工具服务的入口

```
┌─────────────────────────────────────────────────────────────┐
│                     ToolExecutor                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   UriParser                          │   │
│  │  tool-type://tool-service-id/tool-id?options        │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                HandlerRegistry                       │   │
│  │  api:// -> ApiToolHandler                           │   │
│  │  db://  -> DbToolHandler                            │   │
│  │  mcp:// -> McpToolHandler                           │   │
│  │  oss:// -> OssToolHandler                           │   │
│  │  mq://  -> MqToolHandler                            │   │
│  │  mail://-> MailToolHandler                          │   │
│  │  sms:// -> SmsToolHandler                           │   │
│  │  svc:// -> SvcToolHandler                           │   │
│  │  flow://-> FlowToolHandler                          │   │
│  │  agent://-> AgentToolHandler                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                 ExecutionContext                     │   │
│  │  - tenant_id                                         │   │
│  │  - bu_code                                           │   │
│  │  - trace_id                                          │   │
│  │  - timeout                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                MetricsCollector                      │   │
│  │  - 调用计数                                          │   │
│  │  - 响应时间                                          │   │
│  │  - 错误率                                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**ToolExecutor 接口**:
```rust
#[async_trait]
pub trait ToolHandler: Send + Sync {
    fn tool_type(&self) -> &str;
    async fn execute(&self, ctx: &ExecutionContext, uri: &ToolUri, args: Value) -> Result<Value>;
    async fn validate(&self, uri: &ToolUri, args: &Value) -> Result<()>;
    async fn health_check(&self, service_id: &str) -> Result<HealthStatus>;
}

pub struct ToolExecutor {
    handlers: HashMap<String, Arc<dyn ToolHandler>>,
    registry: Arc<ManagedToolRegistry>,
    metrics: Arc<MetricsCollector>,
}

impl ToolExecutor {
    pub async fn execute(&self, ctx: &ExecutionContext, uri: &str, args: Value) -> Result<Value> {
        let parsed_uri = ToolUri::parse(uri)?;
        let handler = self.handlers.get(parsed_uri.tool_type)
            .ok_or_else(|| Error::UnsupportedToolType(parsed_uri.tool_type.clone()))?;

        // 前置校验
        handler.validate(&parsed_uri, &args).await?;

        // 执行并收集指标
        let start = Instant::now();
        let result = handler.execute(ctx, &parsed_uri, args).await;
        self.metrics.record_execution(&parsed_uri, start.elapsed(), result.is_ok());

        result
    }
}
```

### D9: 自定义节点开发框架

**决策**: 实现插件化的自定义节点开发框架，支持前后端扩展

**理由**:
- 业务场景多样，预置节点无法覆盖所有需求
- 插件化架构便于第三方扩展和社区贡献
- 支持热加载，无需重启服务

#### D9.1 插件架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Plugin System                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 PluginRegistry                           │   │
│  │  - 插件发现和加载                                        │   │
│  │  - 版本管理和依赖解析                                    │   │
│  │  - 生命周期管理（install/enable/disable/uninstall）     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                 PluginSandbox                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ WASM     │  │ Deno     │  │ Native   │              │   │
│  │  │ Runtime  │  │ Runtime  │  │ (Rust)   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │              PluginCapabilities                          │   │
│  │  - 节点类型注册                                          │   │
│  │  - 工具服务注册                                          │   │
│  │  - UI 组件注册                                           │   │
│  │  - 事件钩子注册                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### D9.2 自定义节点定义

**节点清单格式 (node-manifest.yaml)**:
```yaml
id: custom-http-retry
version: 1.0.0
name: HTTP 重试节点
description: 支持自定义重试策略的 HTTP 调用节点
author: acme-corp
category: network

# 节点配置 schema
config:
  properties:
    url:
      type: string
      description: 请求 URL
    method:
      type: string
      enum: [GET, POST, PUT, DELETE]
      default: GET
    retry_policy:
      type: object
      properties:
        max_retries:
          type: integer
          default: 3
        backoff:
          type: string
          enum: [linear, exponential]
          default: exponential

# 输入输出定义
ports:
  inputs:
    - name: request
      type: object
  outputs:
    - name: response
      type: object
    - name: error
      type: object

# 运行时配置
runtime:
  type: wasm | deno | native
  entry: ./dist/node.wasm
  permissions:
    - net:fetch
    - env:read
```

**节点实现接口**:
```rust
#[async_trait]
pub trait CustomNode: Send + Sync {
    /// 节点元数据
    fn manifest(&self) -> &NodeManifest;

    /// 节点执行
    async fn execute(
        &self,
        ctx: &ExecutionContext,
        config: &Value,
        inputs: HashMap<String, Value>,
    ) -> Result<HashMap<String, Value>>;

    /// 配置验证
    fn validate_config(&self, config: &Value) -> Result<()>;

    /// 获取节点 UI 配置（用于前端渲染）
    fn ui_schema(&self) -> Option<UiSchema>;
}
```

#### D9.3 前端节点扩展

```typescript
// 自定义节点 UI 注册
interface CustomNodeUI {
  // 节点在画布上的渲染
  NodeComponent: React.FC<NodeComponentProps>;

  // 属性面板渲染
  PropertiesPanel: React.FC<PropertiesPanelProps>;

  // 节点图标
  icon: string | React.FC;

  // 节点颜色主题
  theme: {
    primary: string;
    background: string;
    border: string;
  };
}

// 插件注册 API
pluginRegistry.registerNode({
  id: 'custom-http-retry',
  ui: CustomNodeUI,
  category: 'network',
  searchKeywords: ['http', 'retry', '重试'],
});
```

#### D9.4 插件分发

```
┌─────────────────────────────────────────────────────────────────┐
│                   Plugin Distribution                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │ Local File    │    │ NPM/Crates.io │    │ Private       │   │
│  │ System        │    │ Registry      │    │ Registry      │   │
│  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘   │
│          │                    │                    │            │
│          └────────────────────┴────────────────────┘            │
│                               │                                 │
│                    ┌──────────▼──────────┐                     │
│                    │  Plugin Resolver    │                     │
│                    │  - 版本解析         │                     │
│                    │  - 依赖检查         │                     │
│                    │  - 安全扫描         │                     │
│                    └──────────┬──────────┘                     │
│                               │                                 │
│                    ┌──────────▼──────────┐                     │
│                    │  Plugin Installer   │                     │
│                    │  - 下载和解压       │                     │
│                    │  - 签名验证         │                     │
│                    │  - 沙箱初始化       │                     │
│                    └─────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### D10: 图形化 GML 编辑器

**决策**: 实现文本编辑 + 可视化拖拽的双模式 GML 编辑器

**理由**:
- 文本模式适合高级用户和复杂表达式
- 可视化模式降低学习曲线，适合业务用户
- 双模式实时同步，用户可随时切换

#### D10.1 编辑器架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    GML Editor System                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   EditorCore                             │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │              GML AST Model                        │   │   │
│  │  │  - 统一的抽象语法树表示                           │   │   │
│  │  │  - 支持增量更新                                   │   │   │
│  │  │  - 位置信息追踪                                   │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│              │                              │                   │
│  ┌───────────▼───────────┐    ┌────────────▼────────────┐     │
│  │    Text Editor Mode   │    │   Visual Editor Mode    │     │
│  │  ┌─────────────────┐  │    │  ┌─────────────────┐    │     │
│  │  │ Monaco Editor   │  │    │  │ Block Canvas    │    │     │
│  │  │ - 语法高亮      │  │    │  │ - 拖拽操作      │    │     │
│  │  │ - 自动补全      │  │    │  │ - 连线连接      │    │     │
│  │  │ - 错误提示      │  │    │  │ - 嵌套结构      │    │     │
│  │  │ - 格式化        │  │    │  │ - 实时预览      │    │     │
│  │  └─────────────────┘  │    │  └─────────────────┘    │     │
│  └───────────────────────┘    └─────────────────────────┘     │
│              │                              │                   │
│              └──────────────┬───────────────┘                   │
│                             │                                   │
│              ┌──────────────▼──────────────┐                   │
│              │     Bidirectional Sync      │                   │
│              │  - AST → Text               │                   │
│              │  - Text → AST               │                   │
│              │  - 变更检测和合并           │                   │
│              └─────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

#### D10.2 可视化块类型

```typescript
// 可视化编辑器的块类型定义
enum BlockType {
  // 值类型
  LITERAL_STRING = 'literal_string',
  LITERAL_NUMBER = 'literal_number',
  LITERAL_BOOLEAN = 'literal_boolean',
  LITERAL_NULL = 'literal_null',

  // 变量引用
  VARIABLE = 'variable',
  FIELD_ACCESS = 'field_access',
  INDEX_ACCESS = 'index_access',

  // 运算符
  BINARY_OP = 'binary_op',      // +, -, *, /, ==, !=, <, >, &&, ||
  UNARY_OP = 'unary_op',        // !, -
  TERNARY = 'ternary',          // ? :

  // 复合结构
  OBJECT = 'object',
  ARRAY = 'array',
  SPREAD = 'spread',

  // 方法调用
  METHOD_CALL = 'method_call',  // .map(), .filter(), .proj()

  // 控制结构
  CASE_WHEN = 'case_when',
  ASSIGNMENT = 'assignment',
}

// 块定义
interface BlockDefinition {
  type: BlockType;
  label: string;
  icon: string;
  color: string;
  inputs: InputSlot[];
  output: OutputType;
  generateGml: (inputs: Value[]) => string;
}

// 输入插槽
interface InputSlot {
  name: string;
  type: 'value' | 'expression' | 'variable';
  required: boolean;
  default?: Value;
}
```

#### D10.3 块库面板设计

```
┌─────────────────────────────────────────┐
│           GML Block Library             │
├─────────────────────────────────────────┤
│ 🔍 搜索块...                            │
├─────────────────────────────────────────┤
│ ▼ 变量和值                              │
│   [x] 变量引用    [123] 数字            │
│   [""] 字符串     [✓] 布尔              │
│   [{}] 对象       [[]] 数组             │
├─────────────────────────────────────────┤
│ ▼ 运算符                                │
│   [+] 加法        [-] 减法              │
│   [×] 乘法        [÷] 除法              │
│   [==] 等于       [!=] 不等于           │
│   [&&] 与         [||] 或               │
├─────────────────────────────────────────┤
│ ▼ 数组方法                              │
│   [→] map         [⊃] filter            │
│   [Σ] sum         [#] length            │
│   [⊕] proj        [◇] group             │
│   [↕] sort        [∪] distinct          │
├─────────────────────────────────────────┤
│ ▼ 字符串方法                            │
│   [Aa] toLowerCase  [AA] toUpperCase    │
│   [✂] substring     [🔗] concat         │
├─────────────────────────────────────────┤
│ ▼ 控制结构                              │
│   [?:] 条件表达式                       │
│   [CASE] CASE-WHEN                      │
│   [=] 赋值                              │
└─────────────────────────────────────────┘
```

#### D10.4 实时同步机制

```typescript
class GmlEditorSync {
  private ast: GmlAst;
  private textEditor: MonacoEditor;
  private visualEditor: BlockCanvas;

  // 文本 → AST → 可视化
  onTextChange(newText: string) {
    const parseResult = this.parser.parse(newText);
    if (parseResult.success) {
      this.ast = parseResult.ast;
      this.visualEditor.renderFromAst(this.ast);
    } else {
      // 显示解析错误，但不影响可视化编辑器当前状态
      this.textEditor.showErrors(parseResult.errors);
    }
  }

  // 可视化 → AST → 文本
  onBlockChange(change: BlockChange) {
    this.ast = this.ast.applyChange(change);
    const newText = this.generator.generateGml(this.ast);
    this.textEditor.setValue(newText, { preserveCursor: true });
  }

  // 模式切换
  switchMode(mode: 'text' | 'visual') {
    if (mode === 'visual') {
      // 确保 AST 是最新的
      this.ast = this.parser.parse(this.textEditor.getValue());
      this.visualEditor.renderFromAst(this.ast);
    }
    // 文本模式始终是最新的，无需额外同步
  }
}
```

### D11: 多语言 UDF 运行时

**决策**: 实现支持 SQL、JavaScript、Python 和 WASM 的统一 UDF 运行时

**理由**:
- SQL 适合数据转换和聚合场景
- JavaScript 生态丰富，适合通用逻辑
- Python 在数据科学和 AI 领域有广泛应用
- WASM 提供高性能和语言无关性

#### D11.1 运行时架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    UDF Runtime System                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  UdfExecutor (统一入口)                  │   │
│  │  - 语言检测和路由                                        │   │
│  │  - 超时和资源限制                                        │   │
│  │  - 结果类型转换                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│     ┌──────────────────────┼──────────────────────┐            │
│     │                      │                      │            │
│     ▼                      ▼                      ▼            │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │ SQL UDF  │    │ JavaScript   │    │ Python UDF   │         │
│  │ Runtime  │    │ UDF Runtime  │    │ Runtime      │         │
│  │          │    │              │    │              │         │
│  │ - DuckDB │    │ - QuickJS    │    │ - RustPython │         │
│  │ - SQLite │    │ - Deno       │    │ - PyO3       │         │
│  │   (内置) │    │ - V8 Isolate │    │ - Subprocess │         │
│  └──────────┘    └──────────────┘    └──────────────┘         │
│                            │                                    │
│                            ▼                                    │
│              ┌──────────────────────────┐                      │
│              │      WASM Runtime        │                      │
│              │  - wasmtime / wasmer     │                      │
│              │  - 语言无关              │                      │
│              │  - 沙箱隔离              │                      │
│              │  - 高性能                │                      │
│              └──────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

#### D11.2 UDF 定义格式

```yaml
# UDF 清单文件
id: calculate_discount
version: 1.0.0
name: 计算折扣
description: 根据会员等级和订单金额计算折扣

# 运行时配置
runtime:
  language: python | javascript | sql | wasm
  version: "3.11"  # Python 版本（可选）
  entry: calculate_discount.py  # 入口文件
  timeout_ms: 5000
  memory_limit_mb: 128

# 输入输出定义
signature:
  inputs:
    - name: member_level
      type: string
      description: 会员等级 (bronze/silver/gold/platinum)
    - name: order_amount
      type: number
      description: 订单金额
  output:
    type: object
    properties:
      discount_rate:
        type: number
      final_amount:
        type: number

# 依赖声明（可选）
dependencies:
  python:
    - numpy>=1.20
    - pandas>=1.3
  javascript:
    - lodash: ^4.17.0
```

#### D11.3 各语言运行时实现

**SQL UDF (内嵌 DuckDB)**:
```rust
pub struct SqlUdfRuntime {
    db: DuckDb,
}

impl SqlUdfRuntime {
    pub async fn execute(&self, udf: &UdfDefinition, args: &Value) -> Result<Value> {
        // 创建临时表存放输入数据
        self.db.execute(&format!(
            "CREATE TEMP TABLE input AS SELECT {} AS data",
            serde_json::to_string(args)?
        ))?;

        // 执行 UDF SQL
        let result = self.db.query(&udf.source)?;

        // 转换结果
        Ok(result.into())
    }
}
```

**JavaScript UDF (QuickJS / Deno)**:
```rust
pub struct JsUdfRuntime {
    isolate_pool: Pool<JsIsolate>,
}

impl JsUdfRuntime {
    pub async fn execute(&self, udf: &UdfDefinition, args: &Value) -> Result<Value> {
        let isolate = self.isolate_pool.get().await?;

        // 注入输入参数
        isolate.set_global("__args__", args)?;

        // 执行 UDF 代码
        let result = isolate.eval(&format!(
            "const result = (function() {{ {} }})(...__args__); result;",
            udf.source
        ))?;

        Ok(result)
    }
}
```

**Python UDF (RustPython / PyO3)**:
```rust
pub struct PythonUdfRuntime {
    interpreter_pool: Pool<PythonInterpreter>,
}

impl PythonUdfRuntime {
    pub async fn execute(&self, udf: &UdfDefinition, args: &Value) -> Result<Value> {
        let interp = self.interpreter_pool.get().await?;

        // 安装依赖（首次执行时）
        if !udf.dependencies.is_empty() {
            self.ensure_dependencies(interp, &udf.dependencies).await?;
        }

        // 设置输入
        interp.set_variable("args", args)?;

        // 执行代码
        let result = interp.exec(&format!(
            "{}\nresult = main(*args)",
            udf.source
        ))?;

        Ok(interp.get_variable("result")?)
    }
}
```

**WASM UDF**:
```rust
pub struct WasmUdfRuntime {
    engine: wasmtime::Engine,
    module_cache: Cache<String, wasmtime::Module>,
}

impl WasmUdfRuntime {
    pub async fn execute(&self, udf: &UdfDefinition, args: &Value) -> Result<Value> {
        // 加载或缓存 WASM 模块
        let module = self.module_cache.get_or_load(&udf.id, || {
            wasmtime::Module::new(&self.engine, &udf.wasm_bytes)
        })?;

        // 创建实例
        let mut store = wasmtime::Store::new(&self.engine, ());
        let instance = wasmtime::Instance::new(&mut store, &module, &[])?;

        // 调用导出函数
        let func = instance.get_typed_func::<(i32,), i32>(&mut store, "main")?;
        let result = func.call(&mut store, (self.serialize_args(args)?,))?;

        Ok(self.deserialize_result(result)?)
    }
}
```

#### D11.4 安全沙箱设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Sandbox                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 ResourceLimiter                          │   │
│  │  - CPU 时间限制                                          │   │
│  │  - 内存使用限制                                          │   │
│  │  - 执行超时控制                                          │   │
│  │  - 网络访问限制                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                CapabilityGate                            │   │
│  │  网络访问:                                               │   │
│  │    [ ] 允许 HTTP 请求                                    │   │
│  │    [ ] 允许访问外部 API                                  │   │
│  │  文件系统:                                               │   │
│  │    [ ] 允许读取临时文件                                  │   │
│  │    [ ] 允许写入临时文件                                  │   │
│  │  系统调用:                                               │   │
│  │    [ ] 允许环境变量读取                                  │   │
│  │    [ ] 允许子进程创建                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │                AuditLogger                               │   │
│  │  - 记录所有 UDF 执行                                     │   │
│  │  - 记录资源使用情况                                      │   │
│  │  - 记录异常和错误                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### D11.5 UDF 管理界面

```typescript
// UDF 编辑器组件
interface UdfEditorProps {
  udf: UdfDefinition;
  onChange: (udf: UdfDefinition) => void;
}

const UdfEditor: React.FC<UdfEditorProps> = ({ udf, onChange }) => {
  return (
    <div className="udf-editor">
      {/* 语言选择 */}
      <Select
        value={udf.runtime.language}
        options={['sql', 'javascript', 'python', 'wasm']}
        onChange={lang => onChange({ ...udf, runtime: { ...udf.runtime, language: lang } })}
      />

      {/* 代码编辑器 */}
      <MonacoEditor
        language={udf.runtime.language}
        value={udf.source}
        onChange={source => onChange({ ...udf, source })}
        options={{
          minimap: { enabled: false },
          lineNumbers: 'on',
          automaticLayout: true,
        }}
      />

      {/* 签名定义 */}
      <SignatureEditor
        signature={udf.signature}
        onChange={sig => onChange({ ...udf, signature: sig })}
      />

      {/* 测试面板 */}
      <UdfTester udf={udf} />

      {/* 依赖管理 */}
      {udf.runtime.language !== 'sql' && (
        <DependencyManager
          language={udf.runtime.language}
          dependencies={udf.dependencies}
          onChange={deps => onChange({ ...udf, dependencies: deps })}
        />
      )}
    </div>
  );
};
```

## Risks / Trade-offs

### R1: GML 求值器复杂度

**风险**: GML 语法相对复杂，完整实现需要大量工作

**缓解措施**:
- 分阶段实现：先核心语法，后高级特性
- 建立全面的测试用例库
- 考虑使用 Tree-sitter 作为备选方案

### R2: 并行执行资源消耗

**风险**: 大量节点并行执行可能耗尽系统资源

**缓解措施**:
- 使用信号量限制最大并行数
- 支持配置租户级别的资源配额
- 实现优雅降级：资源不足时回退到顺序执行

### R3: 工具配置迁移

**风险**: 现有工具配置格式变更可能导致数据丢失

**缓解措施**:
- 提供自动迁移脚本
- 旧格式保持只读支持
- 迁移前自动备份

### R4: 前端复杂度上升

**风险**: ToolsPage 功能扩展导致代码膨胀

**缓解措施**:
- 采用模块化设计，每个功能独立组件
- 使用 React Query 管理服务端状态
- 建立组件设计规范

## Migration Plan

### 阶段 1: 数据模型迁移

1. 添加新的数据库表（`tool_services`, `tools`, `tool_args`）
2. 编写迁移脚本将旧数据转换为新格式
3. 旧 API 保持兼容，内部转换为新格式

### 阶段 2: 后端 API 升级

1. 新增 `/api/v1/services` 端点
2. 扩展 `/api/v1/tools` 端点支持完整 ToolArgs
3. 旧端点标记为 deprecated

### 阶段 3: 前端 UI 迁移

1. 重构 ToolsPage 使用新数据模型
2. 添加 ToolArgsEditor 组件
3. ExecNode 集成 ToolSelector

### 阶段 4: 执行器升级

1. 实现 GML 求值器（分步骤）
2. 实现并行调度器
3. 集成状态持久化

### 回滚计划

每个阶段提供独立回滚能力：
- 数据库：保留旧表和数据
- API：旧端点保持可用
- 前端：feature flag 控制新旧 UI

## Open Questions

### Q1: UDF 执行环境

**问题**: JavaScript UDF 的执行环境如何隔离？

**选项**:
- A) 使用 V8 隔离 (Deno)
- B) 使用 QuickJS (轻量级)
- C) 仅支持纯函数，无 I/O

**待确认**: 安全性要求和性能需求

### Q2: MCP 服务认证

**问题**: 连接 MCP 服务时如何处理认证？

**选项**:
- A) 支持 API Key 认证
- B) 支持 OAuth 2.0
- C) 支持 mTLS

**待确认**: 目标 MCP 服务的认证要求

### Q3: 工具测试数据

**问题**: 工具测试调用时使用什么数据？

**选项**:
- A) 用户手动输入
- B) 提供模拟数据生成器
- C) 使用历史调用数据

**待确认**: 产品体验优先级

## 附录

### A1: ToolType 完整列表

| 类型 | URI 前缀 | 说明 |
|------|----------|------|
| api | `api://` | HTTP API 调用 |
| mcp | `mcp://` | MCP 服务调用 |
| db | `db://` | 数据库操作 |
| flow | `flow://` | 子流程调用 |
| agent | `agent://` | AI Agent 调用 |
| svc | `svc://` | 微服务调用 |
| oss | `oss://` | 对象存储 |
| mq | `mq://` | 消息队列 |
| mail | `mail://` | 邮件服务 |
| sms | `sms://` | 短信服务 |

### A2: GML 原型方法实现优先级

**P0 (必须)**:
- 数组: `map`, `filter`, `proj`, `sum`, `length`
- 对象: `proj`
- 字符串: `toLowerCase`, `toUpperCase`, `length`

**P1 (重要)**:
- 数组: `group`, `sort`, `distinct`, `join`, `some`, `every`
- 时间: `offset`
- CASE 表达式

**P2 (增强)**:
- 数组: `collap`, `expand`, `chunk`, `flat`
- 聚合: `avg`, `min`, `max`, `med`

### A3: 数据库 Schema 变更

```sql
-- 工具服务表
CREATE TABLE tool_services (
    id UUID PRIMARY KEY,
    tool_type VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    tenant_id VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 工具表
CREATE TABLE tools (
    id UUID PRIMARY KEY,
    service_id UUID REFERENCES tool_services(id),
    code VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    args JSONB,                          -- ToolArgs JSON
    opts JSONB,                          -- ConfigOptions JSON
    tenant_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (service_id, code)
);

-- 索引
CREATE INDEX idx_tool_services_tenant ON tool_services(tenant_id);
CREATE INDEX idx_tool_services_type ON tool_services(tool_type);
CREATE INDEX idx_tools_tenant ON tools(tenant_id);
CREATE INDEX idx_tools_service ON tools(service_id);
```
