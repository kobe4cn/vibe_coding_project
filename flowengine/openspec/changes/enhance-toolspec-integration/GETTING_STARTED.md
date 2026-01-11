# FlowEngine 增强功能快速入门指南

本文档介绍 ToolSpec 规范集成增强项目新增功能的初始化和配置方法。

## 目录

1. [功能概览](#功能概览)
2. [后端配置](#后端配置)
3. [前端配置](#前端配置)
4. [功能使用指南](#功能使用指南)
5. [API 参考](#api-参考)

---

## 功能概览

本次增强包含以下核心功能：

| 功能模块 | 说明 | 状态 |
|---------|------|------|
| ToolSpec 数据模型 | 工具服务和工具的结构化定义 | ✅ 完成 |
| GML 求值器 | 完整的表达式求值引擎 | ✅ 完成 |
| FDL 节点扩展 | OSS/MQ/Mail/SMS/Service 节点 | ✅ 完成 |
| 执行器优化 | 并行执行、状态持久化 | ✅ 完成 |
| OpenAPI 工具发现 | 从 Swagger/OpenAPI 导入工具 | ✅ 完成 |

---

## 后端配置

### 1. 依赖安装

确保 `Cargo.toml` 包含所需依赖：

```toml
[dependencies]
fdl-executor = { path = "../fdl-executor" }
fdl-tools = { path = "../fdl-tools" }
fdl-gml = { path = "../fdl-gml" }
```

### 2. 执行器初始化

#### 2.1 基础执行器

```rust
use fdl_executor::{Executor, ExecutorResult};
use fdl_gml::Value;

// 创建基础执行器
let executor = Executor::new();

// 执行流程
let result = executor.execute(&flow, inputs).await?;
```

#### 2.2 带工具注册表的执行器

```rust
use fdl_tools::{ToolRegistry, ManagedToolRegistry, ToolContext};

// 方式 1: 简单注册表
let registry = ToolRegistry::new();
let executor = Executor::with_registry(registry);

// 方式 2: 托管注册表（支持配置存储）
let managed_registry = Arc::new(ManagedToolRegistry::new(config_store));
let executor = Executor::with_managed_registry(managed_registry);
```

#### 2.3 带持久化的执行器

```rust
use fdl_executor::{PersistenceManager, InMemoryPersistence, PersistenceConfig};

// 创建持久化管理器
let persistence_config = PersistenceConfig {
    snapshot_interval: 5,           // 每 5 个节点保存一次快照
    max_history_size: 1000,         // 最多保存 1000 条历史
    persist_on_node_complete: true, // 每个节点完成时持久化
    async_write: true,              // 异步写入
};

// 内存持久化（用于测试）
let backend = Arc::new(InMemoryPersistence::new());
let persistence = Arc::new(PersistenceManager::new(backend, persistence_config));

// 创建带持久化的执行器
let executor = Executor::new()
    .with_persistence(persistence);
```

#### 2.4 设置执行上下文

```rust
use fdl_tools::ToolContext;

// 设置租户和业务单元上下文
let tool_context = ToolContext {
    tenant_id: "tenant-001".to_string(),
    bu_code: "BU001".to_string(),
    timeout_ms: 30000,
    metadata: HashMap::new(),
};

let executor = Executor::new()
    .with_tool_context(tool_context);
```

### 3. 工具服务配置

#### 3.1 创建工具服务

```rust
use fdl_tools::{
    ToolService, ToolServiceConfig, ToolType, Tool, ToolArgs, ParamDef,
    ApiConfig, ApiAuth,
};

// 创建 API 类型的工具服务
let api_config = ApiConfig {
    base_url: "https://api.example.com/v1".to_string(),
    auth: Some(ApiAuth::Bearer {
        token: "your-api-token".to_string(),
    }),
    default_headers: HashMap::new(),
    timeout_ms: 30000,
    retry: None,
};

let service = ToolService {
    id: uuid::Uuid::new_v4().to_string(),
    tool_type: ToolType::Api,
    code: "example-api".to_string(),
    name: "示例 API 服务".to_string(),
    description: Some("示例 API 服务描述".to_string()),
    config: ToolServiceConfig::Api(api_config),
    tools: vec![],
    tenant_id: "tenant-001".to_string(),
    enabled: true,
    created_at: Some(chrono::Utc::now()),
    updated_at: Some(chrono::Utc::now()),
};
```

#### 3.2 创建工具定义

```rust
// 定义工具参数
let tool_args = ToolArgs {
    defs: HashMap::new(),
    input: vec![
        ParamDef {
            name: "customerId".to_string(),
            param_type: "string".to_string(),
            nullable: false,
            default_value: None,
            description: Some("客户 ID".to_string()),
            builtin: false,
        },
    ],
    output: None,
};

let tool = Tool {
    id: uuid::Uuid::new_v4().to_string(),
    service_id: service.id.clone(),
    code: "get_customer".to_string(),
    name: "获取客户信息".to_string(),
    description: Some("根据客户 ID 获取客户详情".to_string()),
    args: tool_args,
    opts: None,
    enabled: true,
    created_at: Some(chrono::Utc::now()),
    updated_at: Some(chrono::Utc::now()),
};
```

### 4. OpenAPI 工具发现

#### 4.1 从 URL 导入

```rust
use fdl_tools::{ToolDiscoveryService, OpenApiParser};

let discovery = ToolDiscoveryService::new();

// 从 URL 发现工具
let spec = discovery.discover_from_url("https://api.example.com/openapi.json").await?;

// 转换为工具服务
let tool_service = spec.to_tool_service("example-api", "tenant-001");
```

#### 4.2 从文本内容导入

```rust
let openapi_json = r#"{
    "openapi": "3.0.0",
    "info": { "title": "My API", "version": "1.0.0" },
    "paths": { ... }
}"#;

let spec = OpenApiParser::parse_json(openapi_json)?;
let tool_service = spec.to_tool_service("my-api", "tenant-001");
```

### 5. 状态持久化和恢复

#### 5.1 保存执行快照

```rust
use fdl_executor::{ExecutionSnapshot, ExecutionStatus};

// 从执行上下文创建快照
let ctx = executor.context().read().await;
let snapshot = ExecutionSnapshot::from_context(
    execution_id,
    "tenant-001",
    "flow-001",
    &ctx,
    ExecutionStatus::Running,
);

// 保存快照
persistence.save(&snapshot).await?;
```

#### 5.2 从快照恢复执行

```rust
// 加载快照
let snapshot = persistence.load(execution_id).await?.unwrap();

// 恢复执行
let result = executor.resume_from_snapshot(&flow, &snapshot).await?;
```

#### 5.3 查询执行历史

```rust
// 获取未完成的执行
let incomplete = persistence.get_incomplete("tenant-001").await?;

// 列出流程的历史快照
let history = persistence.list("tenant-001", "flow-001", 10).await?;
```

---

## 前端配置

### 1. 类型定义

新增的节点类型在 `flow.ts` 中定义：

```typescript
// 新增节点类型
export type FlowNodeType =
  | 'start' | 'exec' | 'mapping' | 'condition' | 'switch'
  | 'delay' | 'each' | 'loop' | 'agent' | 'guard' | 'approval'
  | 'mcp' | 'handoff'
  // 新增集成服务节点
  | 'oss'      // 对象存储操作
  | 'mq'       // 消息队列操作
  | 'mail'     // 邮件发送
  | 'sms'      // 短信发送
  | 'service'  // 微服务调用
```

### 2. 节点数据接口

```typescript
// OSS 节点数据
export interface OSSNodeData extends BaseNodeData {
  nodeType: 'oss'
  oss: string      // OSS URI (e.g., "oss://bucket/path")
  operation?: 'upload' | 'download' | 'delete' | 'list'
  args?: string
  with?: string
  sets?: string
}

// MQ 节点数据
export interface MQNodeData extends BaseNodeData {
  nodeType: 'mq'
  mq: string       // MQ URI (e.g., "mq://topic/queue")
  operation?: 'send' | 'receive' | 'subscribe'
  args?: string
  with?: string
  sets?: string
}

// Mail 节点数据
export interface MailNodeData extends BaseNodeData {
  nodeType: 'mail'
  mail: string     // 邮件配置或收件人
  template?: string
  args?: string
  with?: string
  sets?: string
}

// SMS 节点数据
export interface SMSNodeData extends BaseNodeData {
  nodeType: 'sms'
  sms: string      // 短信配置或手机号
  template?: string
  args?: string
  with?: string
  sets?: string
}

// Service 节点数据
export interface ServiceNodeData extends BaseNodeData {
  nodeType: 'service'
  service: string  // 服务 URI (e.g., "svc://service/method")
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  args?: string
  with?: string
  sets?: string
}
```

### 3. 节点颜色配置

```typescript
export const NODE_COLORS: Record<FlowNodeType, string> = {
  // ... 现有节点颜色
  oss: '#fdba74',       // Orange - 对象存储
  mq: '#a78bfa',        // Purple - 消息队列
  mail: '#f472b6',      // Pink - 邮件
  sms: '#34d399',       // Emerald - 短信
  service: '#60a5fa',   // Blue - 微服务
}
```

### 4. 节点分类

```typescript
export const NODE_CATEGORIES = {
  entry: ['start'] as FlowNodeType[],
  basic: ['exec', 'mapping'] as FlowNodeType[],
  control: ['condition', 'switch', 'delay'] as FlowNodeType[],
  loop: ['each', 'loop'] as FlowNodeType[],
  agent: ['agent', 'guard', 'approval', 'mcp', 'handoff'] as FlowNodeType[],
  integration: ['oss', 'mq', 'mail', 'sms', 'service'] as FlowNodeType[],
}

export const NODE_CATEGORY_LABELS = {
  entry: '流程入口',
  basic: '基础节点',
  control: '流程控制',
  loop: '循环遍历',
  agent: 'Agent 能力',
  integration: '集成服务',
}
```

---

## 功能使用指南

### 1. 使用 OSS 节点

在流程中添加对象存储操作：

```yaml
# FDL 示例
upload_file:
  oss: oss://my-bucket/save
  args: |
    key = "reports/" + reportId + ".pdf"
    content = reportData
    contentType = "application/pdf"
  sets: uploadResult = $
```

### 2. 使用 MQ 节点

发布消息到队列：

```yaml
send_notification:
  mq: mq://notification-service/order_created
  args: |
    message = { orderId: order.id, status: "created" }
    delay = 0
```

### 3. 使用 Mail 节点

发送邮件：

```yaml
send_welcome_email:
  mail: mail://marketing/welcome
  args: |
    to = user.email
    subject = "欢迎加入"
    template = "welcome_template"
    variables = { name: user.name }
```

### 4. 使用 SMS 节点

发送短信：

```yaml
send_verification:
  sms: sms://auth-service/verification
  args: |
    to = user.phone
    template = "SMS_VERIFY"
    params = { code: verificationCode }
```

### 5. 使用 Service 节点

调用微服务：

```yaml
call_inventory:
  service: svc://inventory-service/check_stock
  method: POST
  args: |
    productId = order.productId
    quantity = order.quantity
  sets: stockResult = $
```

### 6. 使用条件执行 (only)

```yaml
premium_discount:
  only: customer.level == "premium"
  with: discount = 0.2
  next: apply_discount
```

### 7. 使用错误处理 (fail)

```yaml
risky_operation:
  exec: api://external/process
  args: data = input
  fail: handle_error
  next: success_path

handle_error:
  with: |
    errorMessage = "操作失败"
    shouldRetry = true
```

### 8. 使用变量更新 (sets)

```yaml
increment_counter:
  with: result = counter + 1
  sets: counter = result
```

---

## API 参考

### Executor API

| 方法 | 说明 |
|------|------|
| `Executor::new()` | 创建新执行器 |
| `with_registry(registry)` | 设置工具注册表 |
| `with_managed_registry(registry)` | 设置托管注册表 |
| `with_persistence(persistence)` | 设置持久化管理器 |
| `with_tool_context(context)` | 设置工具上下文 |
| `execute(&flow, inputs)` | 执行流程 |
| `execute_with_id(&flow, inputs, id)` | 使用指定 ID 执行 |
| `resume_from_snapshot(&flow, &snapshot)` | 从快照恢复执行 |

### PersistenceManager API

| 方法 | 说明 |
|------|------|
| `save(&snapshot)` | 保存执行快照 |
| `load(execution_id)` | 加载执行快照 |
| `list(tenant_id, flow_id, limit)` | 列出流程快照 |
| `delete(execution_id)` | 删除快照 |
| `get_incomplete(tenant_id)` | 获取未完成的执行 |

### ToolDiscoveryService API

| 方法 | 说明 |
|------|------|
| `discover_from_url(url)` | 从 URL 发现工具 |
| `discover_from_content(content)` | 从文本内容发现工具 |

### OpenApiParser API

| 方法 | 说明 |
|------|------|
| `parse_json(json_str)` | 解析 JSON 格式 OpenAPI |
| `parse_yaml(yaml_str)` | 解析 YAML 格式 OpenAPI |

---

## 测试验证

运行测试确认功能正常：

```bash
# 运行所有测试
cargo test

# 运行特定模块测试
cargo test --package fdl-executor
cargo test --package fdl-tools
cargo test --package fdl-gml

# 验证 TypeScript 编译
cd flow-editor && npx tsc --noEmit
```

当前测试覆盖：
- fdl-auth: 54 tests
- fdl-executor: 58 tests
- fdl-gml: 43 tests
- fdl-runtime: 24 tests
- fdl-tools: 52 tests
- **总计: 231 tests**

---

## 故障排查

### 常见问题

1. **执行器找不到工具**
   - 检查工具注册表是否正确配置
   - 确认工具 URI 格式正确：`tool-type://service-id/tool-id`

2. **快照恢复失败**
   - 确认快照 ID 存在
   - 检查流程定义是否与快照兼容

3. **OpenAPI 导入失败**
   - 确认 OpenAPI 版本（支持 2.0 和 3.x）
   - 检查 JSON/YAML 格式是否正确

4. **节点执行超时**
   - 调整 `ToolContext.timeout_ms`
   - 检查外部服务可用性

---

## 下一步

- 查看 [design.md](./design.md) 了解详细技术设计
- 查看 [proposal.md](./proposal.md) 了解变更背景
- 查看 [specs/](./specs/) 目录了解各模块规范
