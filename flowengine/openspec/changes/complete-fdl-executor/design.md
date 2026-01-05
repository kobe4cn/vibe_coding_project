# Technical Design: Complete FDL Executor with Flow Management

## Context

FDL (Flow Definition Language) 流程编辑器需要：

1. **完整的执行能力** - 从设计时模拟到生产部署
2. **完善的流程管理** - 查看、创建、管理多个流程及其版本

当前实现存在两大问题：
- TypeScript 执行器仅支持基础框架，缺少 GML 求值和并行执行
- 缺少流程管理界面，无法查看已创建的所有流程

### Stakeholders
- 流程设计者：使用可视化编辑器设计和管理多个流程
- 后端开发者：部署和运维生产流程
- 业务用户：通过流程自动化业务逻辑
- 团队协作者：共享和协作编辑流程

## Goals / Non-Goals

### Goals
- 提供流程列表视图，展示所有已创建流程
- 使用 UUID 作为稳定的流程标识符
- 支持流程 CRUD 操作和导入导出
- 完整实现 GML 表达式语法和求值
- 支持无依赖节点的隐式并行执行
- 支持 each/loop 子流程递归执行
- 提供 Rust 后端 API 用于生产执行
- 支持长时间运行流程的状态持久化和恢复
- 基于 JWT 的用户认证和权限控制
- 多租户数据隔离和资源配额管理

### Non-Goals
- 分布式集群执行（后续版本）
- 流程协作编辑（实时多人编辑）
- 流程模板市场
- OAuth2/OIDC 集成（后续版本，当前仅支持 JWT）

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Flow Editor (Browser)                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     App Router                                  │ │
│  │  /flows              → FlowListPage                             │ │
│  │  /flows/new          → FlowEditor (new)                         │ │
│  │  /flows/:id          → FlowEditor (edit)                        │ │
│  │  /flows/:id/v/:vid   → FlowEditor (view version)                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                 │
│         ▼                    ▼                    ▼                 │
│  ┌─────────────┐      ┌─────────────┐      ┌───────────────┐       │
│  │ FlowListPage│      │ Visual      │      │ Version Panel │       │
│  │             │      │ Canvas      │      │               │       │
│  └──────┬──────┘      └──────┬──────┘      └───────┬───────┘       │
│         │                    │                     │                │
│         └────────────────────┼─────────────────────┘                │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  Storage Abstraction Layer                      │ │
│  │                                                                  │ │
│  │   ┌──────────────────────────────────────────────────────────┐ │ │
│  │   │           StorageProvider (Interface)                     │ │ │
│  │   └──────────────────────────────────────────────────────────┘ │ │
│  │                      │                                         │ │
│  │         ┌────────────┼────────────┐                            │ │
│  │         ▼                         ▼                            │ │
│  │   ┌───────────┐             ┌───────────┐                     │ │
│  │   │ IndexedDB │             │ Backend   │                     │ │
│  │   │ Provider  │             │ Provider  │                     │ │
│  │   └───────────┘             └─────┬─────┘                     │ │
│  └───────────────────────────────────┼────────────────────────────┘ │
│                                      │                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    FDL Runtime (TypeScript)                     │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐        │ │
│  │  │ Mock Mode   │  │ GML Engine  │  │ WebSocket Client│        │ │
│  │  │ (Simulate)  │  │ (Expression)│  │ (Real Execute)  │        │ │
│  │  └─────────────┘  └─────────────┘  └────────┬────────┘        │ │
│  └─────────────────────────────────────────────┼──────────────────┘ │
└────────────────────────────────────────────────┼────────────────────┘
                                                 │
                                       WebSocket │ REST API + JWT
                                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FDL Runtime (Rust)                                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  fdl-runtime (Axum)                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐ │ │
│  │  │ HTTP API │  │ WebSocket│  │ Routes                        │ │ │
│  │  │          │  │          │  │ - /api/v1/flows              │ │ │
│  │  │          │  │          │  │ - /api/v1/flows/:id/versions │ │ │
│  │  │          │  │          │  │ - /api/v1/flows/:id/execute  │ │ │
│  │  └────┬─────┘  └────┬─────┘  └──────────────────────────────┘ │ │
│  │       │             │                                          │ │
│  │       └─────────────┼──────────────────┐                       │ │
│  │                     ▼                  ▼                       │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │              fdl-auth (JWT)                               │ │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌───────────┐              │ │ │
│  │  │  │ JWT Auth │  │ RBAC     │  │ Tenant    │              │ │ │
│  │  │  │ Middleware│  │ Checker  │  │ Resolver  │              │ │ │
│  │  │  └──────────┘  └──────────┘  └───────────┘              │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    fdl-executor                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐            │   │
│  │  │ Scheduler│  │ Context  │  │ Node Executors   │            │   │
│  │  │ (Tokio)  │  │ Manager  │  │ (exec/cond/loop) │            │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘            │   │
│  │                     │                                          │   │
│  │              ┌──────▼──────┐                                   │   │
│  │              │ Persistence │                                   │   │
│  │              │ (Snapshots) │                                   │   │
│  │              └──────┬──────┘                                   │   │
│  └─────────────────────┼──────────────────────────────────────────┘   │
│                        │                                              │
│  ┌─────────────┐  ┌────▼────────┐  ┌────────────────┐               │
│  │  fdl-gml    │  │   SQLx      │  │   fdl-tools    │               │
│  │ (Expression)│  │ (PostgreSQL)│  │ (API/DB/MCP)   │               │
│  └─────────────┘  └─────────────┘  └────────────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 Decisions: Frontend Flow Management

### Decision 1: 存储抽象层

使用 Provider 模式抽象存储实现，支持多种存储后端：

```typescript
// lib/storage/types.ts

export interface FlowEntry {
  id: string
  name: string
  description?: string
  tags?: string[]
  thumbnail?: string
  latestVersion: number
  versionCount: number
  createdAt: number
  updatedAt: number
}

export interface StorageProvider {
  // Flow operations
  listFlows(options?: ListOptions): Promise<FlowEntry[]>
  getFlow(id: string): Promise<FlowEntry | null>
  createFlow(flow: CreateFlowInput): Promise<FlowEntry>
  updateFlow(id: string, updates: UpdateFlowInput): Promise<FlowEntry>
  deleteFlow(id: string): Promise<void>

  // Version operations
  listVersions(flowId: string): Promise<FlowVersionSummary[]>
  getVersion(flowId: string, versionId: string): Promise<FlowVersion | null>
  saveVersion(flowId: string, version: SaveVersionInput): Promise<FlowVersion>
  deleteVersion(flowId: string, versionId: string): Promise<void>
}

export interface ListOptions {
  search?: string
  tags?: string[]
  sortBy?: 'name' | 'updatedAt' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}
```

### Decision 2: IndexedDB Provider 实现

纯前端存储实现，使用增强的 IndexedDB 结构：

```typescript
// lib/storage/indexeddb-provider.ts

import { createStore, get, set, del, keys } from 'idb-keyval'

const flowStore = createStore('fdl-flows-db', 'flows')
const versionStore = createStore('fdl-versions-db', 'versions')

export class IndexedDBProvider implements StorageProvider {
  async listFlows(options?: ListOptions): Promise<FlowEntry[]> {
    const allKeys = await keys(flowStore)
    const flows: FlowEntry[] = []

    for (const key of allKeys) {
      const flow = await get<FlowEntry>(key, flowStore)
      if (flow) flows.push(flow)
    }

    // Apply search filter
    let result = flows
    if (options?.search) {
      const search = options.search.toLowerCase()
      result = result.filter(f =>
        f.name.toLowerCase().includes(search) ||
        f.description?.toLowerCase().includes(search)
      )
    }

    // Apply sorting
    const sortBy = options?.sortBy || 'updatedAt'
    const sortOrder = options?.sortOrder || 'desc'
    result.sort((a, b) => {
      const aVal = a[sortBy] as number | string
      const bVal = b[sortBy] as number | string
      return sortOrder === 'asc'
        ? (aVal > bVal ? 1 : -1)
        : (aVal < bVal ? 1 : -1)
    })

    return result
  }

  async createFlow(input: CreateFlowInput): Promise<FlowEntry> {
    const id = crypto.randomUUID()
    const now = Date.now()

    const entry: FlowEntry = {
      id,
      name: input.name,
      description: input.description,
      tags: input.tags,
      latestVersion: 0,
      versionCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    await set(id, entry, flowStore)
    return entry
  }

  // ... other methods
}
```

### Decision 3: 流程列表页面设计

Material Design 3 风格的流程列表页面：

```typescript
// pages/FlowListPage.tsx

export function FlowListPage() {
  const [flows, setFlows] = useState<FlowEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const storage = useStorage()

  useEffect(() => {
    loadFlows()
  }, [search])

  const loadFlows = async () => {
    setLoading(true)
    const result = await storage.listFlows({ search })
    setFlows(result)
    setLoading(false)
  }

  const handleCreateFlow = async () => {
    const flow = await storage.createFlow({ name: '新流程' })
    navigate(`/flows/${flow.id}`)
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b">
        <h1>流程管理</h1>
        <div className="flex gap-4 mt-4">
          <SearchInput value={search} onChange={setSearch} />
          <Button onClick={handleCreateFlow}>新建流程</Button>
        </div>
      </header>

      {/* Flow Grid */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {flows.map(flow => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onClick={() => navigate(`/flows/${flow.id}`)}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
```

### Decision 4: 路由结构

使用 React Router 实现页面导航：

```typescript
// App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/flows" replace />} />
        <Route path="/flows" element={<FlowListPage />} />
        <Route path="/flows/new" element={<FlowEditorPage isNew />} />
        <Route path="/flows/:flowId" element={<FlowEditorPage />} />
        <Route path="/flows/:flowId/v/:versionId" element={<FlowEditorPage readOnly />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### Decision 5: 数据迁移

从旧版 IndexedDB 结构迁移到新结构：

```typescript
// lib/storage/migration.ts

export async function migrateFromLegacy(): Promise<MigrationResult> {
  const legacyStore = createStore('flow-versions-db', 'versions')
  const legacyMetaStore = createStore('flow-meta-db', 'meta')

  // Get all legacy keys
  const allKeys = await keys(legacyStore)

  // Group by flowId (legacy format: flowId:versionId)
  const flowVersions = new Map<string, FlowVersion[]>()

  for (const key of allKeys) {
    const [flowId] = String(key).split(':')
    const version = await get<FlowVersion>(key, legacyStore)
    if (version) {
      const versions = flowVersions.get(flowId) || []
      versions.push(version)
      flowVersions.set(flowId, versions)
    }
  }

  // Create new flow entries and migrate versions
  const storage = new IndexedDBProvider()
  let migratedFlows = 0
  let migratedVersions = 0

  for (const [legacyFlowId, versions] of flowVersions) {
    const latestVersion = versions.reduce((max, v) =>
      v.version > max.version ? v : max
    )

    const flow = await storage.createFlow({
      name: latestVersion.flow.meta.name,
      description: latestVersion.flow.meta.description,
    })
    migratedFlows++

    for (const version of versions) {
      await storage.saveVersion(flow.id, {
        name: version.name,
        description: version.description,
        flow: version.flow,
        isAutoSave: version.isAutoSave,
      })
      migratedVersions++
    }
  }

  return { migratedFlows, migratedVersions }
}
```

---

## Phase 2 Decisions: Rust Backend Core

### Decision 6: Rust Workspace 结构

采用多 crate workspace 结构，职责清晰：

```
packages/fdl-rust/
├── Cargo.toml              # Workspace manifest
├── fdl-executor/           # 核心执行引擎
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── scheduler.rs    # 并行调度器
│       ├── context.rs      # 执行上下文
│       ├── persistence.rs  # 状态持久化
│       ├── nodes/          # 节点执行器
│       │   ├── mod.rs
│       │   ├── exec.rs
│       │   ├── condition.rs
│       │   ├── loop.rs
│       │   └── ...
│       └── error.rs
├── fdl-gml/                # GML 表达式引擎
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── lexer.rs
│       ├── parser.rs
│       ├── evaluator.rs
│       └── functions.rs    # 内置函数
├── fdl-auth/               # 认证鉴权
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── jwt.rs          # JWT 处理
│       ├── middleware.rs   # Axum 中间件
│       ├── rbac.rs         # 角色权限
│       └── tenant.rs       # 多租户
├── fdl-tools/              # 工具集成
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── api.rs          # HTTP API 调用
│       ├── database.rs     # 数据库查询
│       └── mcp.rs          # MCP 服务调用
└── fdl-runtime/            # HTTP/WebSocket 服务
    ├── Cargo.toml
    └── src/
        ├── main.rs
        ├── routes/
        │   ├── mod.rs
        │   ├── flows.rs    # 流程管理 API
        │   ├── versions.rs # 版本管理 API
        │   ├── execute.rs  # 执行 API
        │   ├── auth.rs     # 认证路由
        │   └── health.rs
        ├── ws.rs           # WebSocket handler
        └── state.rs        # 应用状态
```

**Alternatives considered:**
- 单一 crate：简单但职责不清晰，不利于测试和复用
- 独立仓库：过度分离，增加维护成本

### Decision 7: 并行执行策略

使用 Tokio 的 JoinSet 实现隐式并行：

```rust
use tokio::task::JoinSet;

pub struct Scheduler {
    pending: Vec<NodeId>,
    running: JoinSet<NodeResult>,
    completed: HashSet<NodeId>,
}

impl Scheduler {
    pub async fn execute_parallel(&mut self, nodes: Vec<Node>) -> Vec<NodeResult> {
        // 找出无依赖的节点
        let ready = self.find_ready_nodes(&nodes);

        // 并行执行
        for node in ready {
            self.running.spawn(execute_node(node));
        }

        // 收集结果
        let mut results = Vec::new();
        while let Some(result) = self.running.join_next().await {
            results.push(result?);
            // 检查是否有新节点可执行
            self.schedule_next(&nodes);
        }
        results
    }
}
```

### Decision 8: GML 表达式求值

实现完整的 GML 语法支持：

```rust
// fdl-gml/src/lib.rs

pub struct GmlEngine {
    functions: HashMap<String, Box<dyn GmlFunction>>,
}

impl GmlEngine {
    pub fn evaluate(&self, expr: &str, context: &Context) -> Result<Value> {
        let tokens = Lexer::tokenize(expr)?;
        let ast = Parser::parse(tokens)?;
        Evaluator::new(&self.functions).eval(ast, context)
    }
}

// 支持的表达式类型
// - 算术: price * quantity
// - 字符串模板: `订单${orderId}已创建`
// - CASE: CASE WHEN x > 0 THEN 'positive' ELSE 'zero' END
// - 方法链: orders.filter(o => o.amount > 100).sum('amount')
// - 空值安全: user?.address?.city
```

**内置函数:**
- 数学: SUM, AVG, MIN, MAX, ROUND, CEIL, FLOOR
- 字符串: CONCAT, UPPER, LOWER, TRIM, SPLIT, JOIN
- 日期: DATE, NOW, FORMAT_DATE, ADD_DAYS
- 数组: FILTER, MAP, REDUCE, FIND, SORT

### Decision 9: 工具调用接口

统一的工具调用 trait：

```rust
// fdl-tools/src/lib.rs

#[async_trait]
pub trait ToolHandler: Send + Sync {
    async fn execute(
        &self,
        uri: &str,
        args: Value,
        context: &ExecutionContext,
    ) -> Result<Value>;
}

// API 调用
pub struct ApiHandler {
    client: reqwest::Client,
    config: ApiConfig,
}

// 数据库查询
pub struct DatabaseHandler {
    pool: sqlx::PgPool,
}

// MCP 服务
pub struct McpHandler {
    connections: DashMap<String, McpClient>,
}
```

### Decision 10: 前后端通信协议

使用 WebSocket + JSON-RPC 2.0：

```json
// 请求（带 JWT）
{
  "jsonrpc": "2.0",
  "id": "exec-001",
  "method": "flow.execute",
  "params": {
    "flowId": "order-process",
    "args": {"customerId": "C001"}
  }
}

// 事件推送
{
  "jsonrpc": "2.0",
  "method": "flow.event",
  "params": {
    "type": "nodeStart",
    "nodeId": "fetch-customer",
    "timestamp": 1704067200000
  }
}
```

### Decision 11: 状态持久化

使用 PostgreSQL 存储执行状态快照：

```rust
// fdl-executor/src/persistence.rs

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionSnapshot {
    pub execution_id: Uuid,
    pub tenant_id: Uuid,
    pub flow_id: String,
    pub status: ExecutionStatus,
    pub current_nodes: Vec<String>,
    pub context: ExecutionContext,
    pub history: Vec<NodeExecutionRecord>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct PersistenceManager {
    pool: PgPool,
    snapshot_interval: Duration,
}

impl PersistenceManager {
    pub async fn save_snapshot(&self, snapshot: &ExecutionSnapshot) -> Result<()> {
        sqlx::query!(
            r#"
            INSERT INTO execution_snapshots
                (id, tenant_id, flow_id, status, context, history, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (id) DO UPDATE SET
                status = $4, context = $5, history = $6, updated_at = NOW()
            "#,
            snapshot.execution_id,
            snapshot.tenant_id,
            snapshot.flow_id,
            serde_json::to_value(&snapshot.status)?,
            serde_json::to_value(&snapshot.context)?,
            serde_json::to_value(&snapshot.history)?
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn restore_execution(&self, execution_id: Uuid) -> Result<ExecutionSnapshot> {
        // 从数据库加载快照并恢复执行状态
    }
}
```

### Decision 12: JWT 认证鉴权

使用 JWT 进行用户认证和授权：

```rust
// fdl-auth/src/jwt.rs

use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,           // 用户 ID
    pub tenant_id: Uuid,     // 租户 ID
    pub roles: Vec<String>,  // 角色列表
    pub exp: usize,          // 过期时间
    pub iat: usize,          // 签发时间
}

// fdl-auth/src/middleware.rs

pub async fn jwt_auth_middleware(
    State(jwt_service): State<Arc<JwtService>>,
    mut req: Request,
    next: Next,
) -> Result<Response, AuthError> {
    let token = extract_bearer_token(&req)?;
    let claims = jwt_service.validate_token(&token)?;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
```

**角色权限 (RBAC):**
```rust
// fdl-auth/src/rbac.rs

#[derive(Debug, Clone, PartialEq)]
pub enum Permission {
    FlowRead,
    FlowWrite,
    FlowExecute,
    FlowDelete,
    ExecutionView,
    ExecutionControl,
    AdminAll,
}

#[derive(Debug, Clone)]
pub enum Role {
    Viewer,      // FlowRead, ExecutionView
    Editor,      // + FlowWrite
    Operator,    // + FlowExecute, ExecutionControl
    Admin,       // AdminAll
}
```

### Decision 13: 多租户隔离

采用共享数据库、通过 tenant_id 字段实现数据隔离：

```rust
// fdl-auth/src/tenant.rs

#[derive(Debug, Clone)]
pub struct TenantContext {
    pub tenant_id: Uuid,
    pub name: String,
    pub config: TenantConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantConfig {
    pub max_concurrent_executions: u32,
    pub max_flow_size: usize,
    pub allowed_tools: Vec<String>,
    pub rate_limit: RateLimitConfig,
}

// 租户感知的仓储层
pub struct TenantAwareRepository<T> {
    pool: PgPool,
    _marker: PhantomData<T>,
}

impl<T> TenantAwareRepository<T> {
    pub async fn find_by_id(&self, tenant_id: Uuid, id: Uuid) -> Result<Option<T>> {
        sqlx::query_as!(
            T,
            "SELECT * FROM {} WHERE tenant_id = $1 AND id = $2",
            tenant_id,
            id
        )
        .fetch_optional(&self.pool)
        .await
    }
}
```

---

## Phase 3 Decisions: Full Stack Integration

### Decision 14: Backend Provider 实现

后端存储实现，通过 REST API 与 Rust 后端通信：

```typescript
// lib/storage/backend-provider.ts

export class BackendProvider implements StorageProvider {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  async listFlows(options?: ListOptions): Promise<FlowEntry[]> {
    const params = new URLSearchParams()
    if (options?.search) params.set('search', options.search)
    if (options?.sortBy) params.set('sort_by', options.sortBy)

    return this.fetch(`/api/v1/flows?${params}`)
  }

  async createFlow(input: CreateFlowInput): Promise<FlowEntry> {
    return this.fetch('/api/v1/flows', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  // ... other methods
}
```

### Decision 15: Rust 后端流程管理 API

扩展 fdl-runtime 添加流程管理 API：

```rust
// fdl-runtime/src/routes/flows.rs

use axum::{
    extract::{Path, Query, State},
    Json,
};

#[derive(Deserialize)]
pub struct ListFlowsQuery {
    search: Option<String>,
    sort_by: Option<String>,
    sort_order: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

pub async fn list_flows(
    State(state): State<AppState>,
    claims: Claims,
    Query(query): Query<ListFlowsQuery>,
) -> Result<Json<Vec<FlowEntry>>, ApiError> {
    let flows = sqlx::query_as!(
        FlowEntry,
        r#"
        SELECT id, name, description, tags, thumbnail,
               latest_version, version_count, created_at, updated_at
        FROM flows
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
        ORDER BY updated_at DESC
        LIMIT $3 OFFSET $4
        "#,
        claims.tenant_id,
        query.search,
        query.limit.unwrap_or(50),
        query.offset.unwrap_or(0)
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(flows))
}

pub async fn create_flow(
    State(state): State<AppState>,
    claims: Claims,
    Json(input): Json<CreateFlowInput>,
) -> Result<Json<FlowEntry>, ApiError> {
    let id = Uuid::new_v4();
    let now = Utc::now();

    let flow = sqlx::query_as!(
        FlowEntry,
        r#"
        INSERT INTO flows (id, tenant_id, name, description, tags, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        RETURNING *
        "#,
        id,
        claims.tenant_id,
        input.name,
        input.description,
        &input.tags,
        now
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(flow))
}
```

---

## Database Schema

```sql
-- 执行快照表
CREATE TABLE execution_snapshots (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    flow_id VARCHAR(255) NOT NULL,
    status JSONB NOT NULL,
    context JSONB NOT NULL,
    history JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_tenant ON execution_snapshots(tenant_id);
CREATE INDEX idx_snapshots_flow ON execution_snapshots(flow_id);
CREATE INDEX idx_snapshots_status ON execution_snapshots((status->>'state'));

-- 流程表
CREATE TABLE flows (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT[],
    thumbnail TEXT,
    latest_version INT NOT NULL DEFAULT 0,
    version_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_flows_tenant ON flows(tenant_id);
CREATE INDEX idx_flows_name ON flows(tenant_id, name);
CREATE INDEX idx_flows_updated ON flows(tenant_id, updated_at DESC);

-- 流程版本表
CREATE TABLE flow_versions (
    id UUID PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    version INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    flow_data JSONB NOT NULL,
    is_auto_save BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,

    UNIQUE(flow_id, version)
);

CREATE INDEX idx_versions_flow ON flow_versions(flow_id);
CREATE INDEX idx_versions_tenant ON flow_versions(tenant_id);

-- 租户表
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rust 学习曲线 | 开发周期延长 | 充分利用 Rust 技能规范，复用成熟库 |
| 前后端协议不一致 | 调试困难 | 共享 JSON Schema 定义，自动化测试 |
| GML 语法复杂度 | 实现周期长 | 分阶段实现，优先核心语法 |
| 工具调用超时 | 流程阻塞 | 配置超时，支持取消，fail 边处理 |
| 状态持久化性能 | 执行延迟增加 | 异步写入，批量合并快照 |
| JWT 密钥泄露 | 安全风险 | 密钥轮换机制，短有效期 |
| 多租户数据泄露 | 严重安全问题 | 数据库 RLS，代码审计，渗透测试 |
| 数据迁移失败 | 用户丢失历史版本 | 迁移前备份，提供回滚机制 |
| IndexedDB 容量限制 | 存储空间不足 | 提示用户清理或升级后端存储 |

---

## Migration Plan

### Phase 1: 前端流程管理
1. 创建存储抽象层和 IndexedDB Provider
2. 实现数据迁移工具
3. 实现流程列表页面和 FlowCard 组件
4. 添加 React Router 和路由结构
5. 重构 FlowEditorPage 和版本面板

### Phase 2: Rust 后端基础
1. 创建 workspace 结构
2. 实现 fdl-gml crate（GML 表达式引擎）
3. 实现 fdl-executor 基础框架

### Phase 3: 工具集成
1. 实现 fdl-tools crate
2. API 调用、数据库查询
3. MCP 服务集成

### Phase 4: 认证鉴权
1. 实现 fdl-auth crate
2. JWT 生成和验证
3. RBAC 权限控制
4. Axum 认证中间件

### Phase 5: 多租户支持
1. 数据库 Schema 添加 tenant_id
2. 租户感知的仓储层
3. 资源配额管理

### Phase 6: 状态持久化
1. 执行快照数据模型
2. 快照保存和恢复
3. 执行历史查询 API

### Phase 7: 全栈集成
1. 实现流程管理 API（flows, versions）
2. 实现 BackendProvider
3. 前端 WebSocket 客户端
4. 端到端测试

### Rollback
- 前端保持 IndexedDB 存储能力，后端可选
- 后端部署失败时可回退到前端本地模式
- 认证可配置为可选（开发环境）
- 多租户可降级为单租户模式
- 保留旧版 IndexedDB 数据，迁移失败可回退
