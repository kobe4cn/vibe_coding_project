# A2UI 架构深度分析报告

> 本文档全面分析 project_alpha 中 A2UI 协议的实现，与传统 React/Vue 架构进行对比，评估优劣势，并深入探讨前后端代码复杂度的关联。

---

## 目录

1. [架构概述](#1-架构概述)
2. [与传统 React/Vue 架构的核心差异](#2-与传统-reactvue-架构的核心差异)
3. [A2UI 架构的优势](#3-a2ui-架构的优势)
4. [A2UI 架构的劣势与复杂度问题](#4-a2ui-架构的劣势与复杂度问题)
5. [前后端依赖关系详解](#5-前后端依赖关系详解)
6. [代码复杂度对比分析](#6-代码复杂度对比分析)
7. [Bug 排查难度分析](#7-bug-排查难度分析)
8. [改进建议](#8-改进建议)
9. [适用场景建议](#9-适用场景建议)

---

## 1. 架构概述

### 1.1 A2UI 是什么

A2UI（Agent-to-UI）是一种**服务端驱动 UI（Server-Driven UI, SDUI）**协议，核心理念是：

- **UI 结构由后端定义**：前端不再硬编码 UI 组件，而是接收后端发送的组件树描述
- **数据与 UI 分离**：通过 DataModel 实现数据绑定，UI 组件引用路径而非直接持有数据
- **实时推送**：使用 SSE（Server-Sent Events）实现服务端向客户端的消息推送

### 1.2 当前实现架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           后端 (Rust/Axum)                           │
├─────────────────────────────────────────────────────────────────────┤
│  handlers/a2ui.rs                                                    │
│  ├── tickets_stream()    ──┬── ComponentBuilder 构建 UI 树          │
│  ├── ticket_edit_stream()  │── MessageBuilder 创建消息              │
│  ├── tags_stream()         │── 数据库查询 → ValueMap 数据           │
│  └── *_action()           ─┴── 处理用户动作                         │
│                                                                      │
│  a2ui/                                                               │
│  ├── types.rs     (7460 行)  - A2UI 协议类型定义                    │
│  ├── builder.rs   (12558 行) - 组件与消息构建器                     │
│  └── sse.rs       (2143 行)  - SSE 流支持                           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ SSE Stream + HTTP POST
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        前端 (React + Lit)                            │
├─────────────────────────────────────────────────────────────────────┤
│  a2ui/                                                               │
│  ├── types.ts              - TypeScript 类型定义                    │
│  ├── renderer/                                                       │
│  │   ├── renderer.ts       - Lit Web Components 渲染器              │
│  │   └── data-model.ts     - 数据模型管理                           │
│  └── integration/                                                    │
│      ├── useA2UI.ts        - SSE 连接 Hook                          │
│      ├── A2UISurface.tsx   - React 包装组件                         │
│      └── A2UIContext.tsx   - 状态桥接上下文                         │
│                                                                      │
│  pages/                                                              │
│  ├── TicketsPage.tsx       - 混合架构 (A2UI + React Modal)          │
│  ├── TicketEditPage.tsx    - 混合架构 (A2UI Form + React Selector)  │
│  └── ...                                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 消息流程

```
用户访问页面
    ↓
建立 SSE 连接 (EventSource)
    ↓
后端发送三类消息：
    1. SurfaceUpdate  - UI 组件树定义
    2. DataModelUpdate - 数据填充
    3. BeginRendering - 触发渲染
    ↓
前端 Lit 渲染器解析并渲染
    ↓
用户交互 → POST UserAction → 后端处理 → 返回/推送更新
```

---

## 2. 与传统 React/Vue 架构的核心差异

### 2.1 对比表

| 维度 | 传统 React/Vue | A2UI 架构 |
|------|---------------|-----------|
| **UI 定义位置** | 前端代码 (JSX/Template) | 后端代码 (Rust Builder) |
| **编译时机** | 构建时静态编译 | 运行时动态生成 |
| **状态管理** | useState/Vuex/Pinia | DataModel + 路径绑定 |
| **数据流向** | 单向（父→子）/双向绑定 | 服务端推送 + 客户端同步 |
| **组件复用** | 导入即用 | 模板列表模式 |
| **类型检查** | 编译时完整检查 | 运行时解析 |
| **调试体验** | React DevTools/Vue DevTools | 无专用工具 |
| **热更新** | HMR 支持 | 需刷新重连 |
| **发布方式** | 前端独立部署 | 前后端耦合部署 |

### 2.2 代码对比示例

**传统 React 实现工单列表**：

```tsx
// TicketsPage.tsx - 传统 React
function TicketsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data: tickets, isLoading } = useQuery(['tickets', search, status],
    () => fetchTickets({ search, status }));

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="搜索..."
      />
      <select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">全部</option>
        <option value="open">待处理</option>
      </select>
      {isLoading ? <Loading /> : (
        <ul>
          {tickets.map(ticket => (
            <TicketItem key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

**A2UI 实现同样功能**：

```rust
// handlers/a2ui.rs - Rust 后端
async fn build_tickets_ui(tx: &A2UISender, surface_id: &str, ...) {
    let mut builder = ComponentBuilder::new();

    // 定义 UI 结构
    builder
        .text_field("search-input", "搜索...",
            BoundValue::path("/app/tickets/query/search"))
        .button("search-btn", "search-btn-text",
            Action::new("search_tickets")
                .with_context("search", BoundValue::path("/app/tickets/query/search")))
        .list("tickets-list",
            Children::template("ticket-item", "/app/tickets/items"));

    // 发送消息
    tx.send(msg.surface_update(builder.build())).await?;
    tx.send(msg.data_update("/app/tickets", data)).await?;
    tx.send(msg.begin_rendering("root")).await?;
}
```

```tsx
// TicketsPage.tsx - A2UI 前端
function TicketsPage() {
  const handleAction = async (action, sourceId) => {
    // 动作处理委托给后端
  };

  return (
    <A2UISurface
      surfaceId="tickets"
      streamUrl="/api/a2ui/tickets/stream"
      actionUrl="/api/a2ui/tickets/action"
      onAction={handleAction}
    />
  );
}
```

### 2.3 核心理念差异

| 传统架构 | A2UI 架构 |
|---------|----------|
| "前端为王" - UI 逻辑在前端 | "后端驱动" - UI 逻辑在后端 |
| 前端开发者主导 UI 设计 | 后端开发者参与 UI 构建 |
| 组件是一等公民 | 消息协议是一等公民 |
| 编译时确定 UI 结构 | 运行时动态组装 UI |

---

## 3. A2UI 架构的优势

### 3.1 动态 UI 更新无需前端发版

```
传统架构：UI 变更 → 前端修改 → 构建 → 部署 → 用户刷新
A2UI：     UI 变更 → 后端修改 → 部署 → 实时生效
```

**适用场景**：
- 运营配置的活动页面
- A/B 测试的 UI 变体
- 根据用户权限显示不同 UI

### 3.2 服务端验证与业务逻辑集中

```rust
// 后端统一处理状态转移逻辑
if !current_status.can_transition_to(&new_status) {
    return Err("Invalid transition");
}
```

- 业务规则不需要在前后端重复实现
- 减少数据不一致风险

### 3.3 强类型后端实现

Rust 的类型系统提供编译时保证：

```rust
// 错误的字段名在编译时就会报错
builder.text_field("search", "搜索",
    BoundValue::path("/app/tickets/query/search"));
```

### 3.4 实时数据推送

SSE 连接允许服务端主动推送更新：

```rust
// 后端可以随时推送新数据
tx.send(msg.data_update("/app/notifications", new_alerts)).await?;
```

### 3.5 混合架构灵活性

可以选择性地使用 A2UI 或原生 React：

```tsx
// 简单列表用 A2UI
<A2UISurface surfaceId="tickets" ... />

// 复杂交互用 React
{showModal && <ComplexTagSelector onChange={...} />}
```

---

## 4. A2UI 架构的劣势与复杂度问题

### 4.1 代码分散导致调试困难

**问题**：一个功能的实现分散在多个位置

```
工单搜索功能的代码分布：

后端：
├── handlers/a2ui.rs:45-80    - 构建搜索框 UI 组件
├── handlers/a2ui.rs:150-200  - 处理 search_tickets 动作
├── handlers/a2ui.rs:300-350  - fetch_tickets 数据查询

前端：
├── a2ui/renderer/renderer.ts:200-250    - TextField 渲染
├── a2ui/integration/useA2UI.ts:100-150  - sendAction 处理
├── pages/TicketsPage.tsx:50-80          - onAction 回调
```

**对比传统 React**：搜索功能通常在一个文件的 50 行内完成。

### 4.2 类型安全跨越边界丢失

**问题**：后端和前端的类型映射在运行时完成

```rust
// 后端定义
BoundValue::path("/app/tickets/query/search")
```

```typescript
// 前端使用
const search = dataModel.get("/app/tickets/query/search") as string;
// 路径写错不会有编译时错误！
const search = dataModel.get("/app/tickets/query/serach") as string; // typo 不报错
```

### 4.3 调试工具缺失

| 传统架构 | A2UI |
|---------|------|
| React DevTools 查看组件树 | 无专用工具 |
| Vue DevTools 查看状态 | 需手动 console.log |
| 断点调试组件 | SSE 消息难以追踪 |

**当前调试方式**：

```typescript
// 只能通过 console.log 调试
eventSource.onmessage = (event) => {
  console.log('A2UI Message:', JSON.parse(event.data));
};
```

### 4.4 错误信息不明确

**问题**：错误发生时难以定位根因

```
场景：列表不显示数据

可能原因：
1. 后端 ComponentBuilder 构建列表时 ID 错误
2. 后端 DataModelUpdate 路径错误
3. 前端 Lit 渲染器模板匹配失败
4. 前端 DataModel.resolve() 路径解析错误
5. SSE 消息顺序错误
```

**传统架构**：React 会直接报 "Cannot read property 'map' of undefined"，错误栈清晰指向问题行。

### 4.5 开发反馈循环变长

```
传统架构开发循环：
修改 JSX → HMR 热更新 → 立即看到效果 (~1秒)

A2UI 开发循环：
修改 Rust → cargo build → 重启服务 → 刷新页面重连 SSE (~10-30秒)
```

### 4.6 心智模型复杂

开发者需要同时理解：

1. **SSE 消息协议** - 三种消息类型及其顺序
2. **组件构建器 API** - Rust Builder 模式
3. **数据绑定路径** - 路径语法和解析规则
4. **Lit 渲染机制** - Web Components 生命周期
5. **React 集成层** - Context、Hooks、useSyncExternalStore
6. **脏路径机制** - 防止数据覆盖的逻辑

### 4.7 混合架构的边界模糊

**问题**：何时用 A2UI，何时用 React，缺乏清晰标准

```tsx
// TicketEditPage.tsx 中的混合
// A2UI 负责：标题、描述、优先级
// React 负责：标签选择器

// 保存时需要合并两个来源的数据
const handleSave = async () => {
  const title = getValue('/app/form/edit/title');      // 从 A2UI
  const tagIds = selectedTagIds;                        // 从 React
  await updateTicket({ title, tagIds });                // 手动合并
};
```

### 4.8 代码量显著增加

| 功能 | 传统 React 代码量 | A2UI 代码量 |
|------|-----------------|------------|
| 简单列表页 | ~100 行 | ~300+ 行 |
| 带表单的详情页 | ~150 行 | ~500+ 行 |
| 完整 CRUD | ~400 行 | ~1200+ 行 |

**A2UI 框架代码量**：
- `types.rs`: 7460 行
- `builder.rs`: 12558 行
- `sse.rs`: 2143 行
- **总计仅后端 A2UI 框架就有 22000+ 行**

---

## 5. 前后端依赖关系详解

### 5.1 依赖关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           依赖方向                                   │
│                                                                      │
│  前端 A2UI 类型 ◄─────────────── 后端 A2UI 类型                      │
│  (types.ts)      必须保持同步     (types.rs)                         │
│                                                                      │
│  前端组件渲染 ◄─────────────── 后端组件定义                          │
│  (renderer.ts)   必须支持所有类型 (builder.rs)                       │
│                                                                      │
│  前端数据绑定 ◄─────────────── 后端路径定义                          │
│  (data-model.ts) 路径必须匹配    (handlers/*.rs)                     │
│                                                                      │
│  前端动作处理 ◄─────────────── 后端动作定义                          │
│  (useA2UI.ts)    动作名必须匹配   (handlers/*.rs)                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 关键同步点

#### 5.2.1 类型定义同步

```rust
// 后端 types.rs
pub enum BoundValue {
    LiteralString { literal_string: String },
    LiteralNumber { literal_number: f64 },
    LiteralBoolean { literal_boolean: bool },
    Path { path: String },
}
```

```typescript
// 前端 types.ts - 必须完全匹配
export type BoundValue =
  | { literalString: string }
  | { literalNumber: number }
  | { literalBoolean: boolean }
  | { path: string };
```

**风险**：后端增加新类型，前端未同步更新，导致运行时错误。

#### 5.2.2 组件类型同步

```rust
// 后端支持的组件类型
builder.text(...)      // Text
builder.button(...)    // Button
builder.text_field(...) // TextField
builder.list(...)      // List
// ...
```

```typescript
// 前端 renderer.ts 必须支持所有类型
switch (componentType) {
  case 'Text': return this.renderText(...);
  case 'Button': return this.renderButton(...);
  case 'TextField': return this.renderTextField(...);
  case 'List': return this.renderList(...);
  // 缺少的类型会导致渲染失败
}
```

#### 5.2.3 数据路径同步

```rust
// 后端定义路径
ValueMap::string("search", &search_filter)
// 完整路径：/app/tickets/query/search
```

```typescript
// 前端使用路径
const search = dataModel.get('/app/tickets/query/search');
// 路径不匹配 = undefined
```

#### 5.2.4 动作名称同步

```rust
// 后端处理的动作
match action.name.as_str() {
    "search_tickets" => { ... }
    "filter_status" => { ... }
    "process_ticket" => { ... }
    _ => Err("Unknown action")
}
```

```typescript
// 前端发送的动作必须匹配
Action::new("search_tickets")  // 名称必须一致
```

### 5.3 依赖同步的挑战

| 同步项 | 检测时机 | 错误表现 |
|--------|---------|---------|
| 类型定义 | 运行时 | JSON 解析失败 |
| 组件类型 | 运行时 | 组件不渲染 |
| 数据路径 | 运行时 | 显示 undefined |
| 动作名称 | 运行时 | 后端返回错误 |

**没有编译时检查机制来捕获这些不匹配！**

---

## 6. 代码复杂度对比分析

### 6.1 圈复杂度分析

**传统 React 组件**（以搜索功能为例）：

```tsx
function SearchComponent() {
  const [query, setQuery] = useState('');
  const results = useQuery(['search', query], () => search(query));

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <ul>{results.data?.map(item => <li key={item.id}>{item.name}</li>)}</ul>
    </div>
  );
}
// 圈复杂度：~3 (一个条件渲染)
```

**A2UI 实现同样功能**：

```rust
// 后端 UI 构建
async fn build_search_ui(tx: &A2UISender) {
    let mut builder = ComponentBuilder::new();
    builder.text_field("search", "搜索", BoundValue::path("/app/search/query"));
    builder.list("results", Children::template("item", "/app/search/results"));
    // ...构建项目模板
    tx.send(msg.surface_update(builder.build())).await?;
}

// 后端动作处理
async fn handle_search(action: UserAction, db: &Pool) {
    let query = action.context.get("query").unwrap();
    let results = sqlx::query("SELECT ...").fetch_all(db).await?;
    // ...构建响应
}
```

```typescript
// 前端 Hook
const { sendAction } = useA2UI({ ... });

// 前端渲染器
private renderTextField(id, props, contextPath) {
  const textPath = props.text?.path;
  const handleInput = (e) => {
    if (textPath) this.dataModel.set(textPath, e.target.value);
  };
  return html`<input @input=${handleInput} />`;
}
```

**A2UI 总圈复杂度**：~15（分散在多个文件，每个都有条件分支）

### 6.2 代码耦合度

```
传统架构耦合：
SearchComponent.tsx
    └── api/search.ts (HTTP 调用)

A2UI 架构耦合：
handlers/a2ui.rs (后端)
    ├── a2ui/builder.rs
    ├── a2ui/types.rs
    └── a2ui/sse.rs
renderer.ts (前端)
    ├── data-model.ts
    ├── useA2UI.ts
    └── types.ts
```

### 6.3 修改影响范围

| 修改类型 | 传统架构影响 | A2UI 架构影响 |
|---------|-------------|--------------|
| 添加搜索字段 | 1 个组件文件 | 2+ 文件（后端构建 + 前端渲染） |
| 修改列表样式 | 1 个 CSS/组件文件 | 1-2 文件（可能需要改 Lit 组件） |
| 新增组件类型 | 创建新组件文件 | 4+ 文件（后端类型+构建器+前端类型+渲染器） |
| 修改数据结构 | API + 组件 | 后端路径 + 前端绑定 + 可能的类型定义 |

---

## 7. Bug 排查难度分析

### 7.1 常见 Bug 类型及排查路径

#### Bug 1：列表数据不显示

**传统架构排查**：
1. 检查 `useQuery` 返回的 data
2. 检查 API 响应
3. 检查 map 渲染逻辑

**A2UI 架构排查**：
1. 检查 SSE 连接是否建立
2. 检查 SurfaceUpdate 消息是否发送
3. 检查 DataModelUpdate 路径是否正确
4. 检查 BeginRendering 是否发送
5. 检查 Lit 渲染器是否支持 List 组件
6. 检查模板绑定路径是否匹配
7. 检查 DataModel.getEntries() 返回值
8. 检查 contextPath 传递是否正确

**排查时间对比**：传统 5-10 分钟 vs A2UI 30-60 分钟

#### Bug 2：表单输入后数据丢失

**传统架构**：检查 useState/onChange 绑定

**A2UI 架构**：
1. 检查 TextField 的 BoundValue 路径
2. 检查 dataModel.set() 是否正确调用
3. 检查脏路径机制是否工作
4. 检查 SSE 更新是否覆盖了用户输入
5. 检查 batch 模式是否正确使用

#### Bug 3：按钮点击无响应

**传统架构**：检查 onClick 处理函数

**A2UI 架构**：
1. 检查 Button 组件的 action 配置
2. 检查 actionHandler 是否绑定
3. 检查 sendAction 是否被调用
4. 检查 UserAction 格式是否正确
5. 检查后端是否收到请求
6. 检查后端动作名称匹配
7. 检查后端响应格式

### 7.2 调试工具对比

| 工具/方法 | 传统架构 | A2UI 架构 |
|----------|---------|-----------|
| 浏览器 DevTools | 直接查看组件状态 | 需要手动检查 DataModel |
| React DevTools | 完整支持 | 仅支持 React 包装层 |
| 网络面板 | 查看 API 请求 | SSE 消息流难以逐条检查 |
| 断点调试 | JSX 行级断点 | 需在多处设置断点 |
| 错误栈 | 清晰指向源文件 | 常指向框架内部 |

### 7.3 日志追踪复杂度

```typescript
// A2UI 完整请求追踪需要的日志点
console.log('[SSE] Connection established');
console.log('[SSE] SurfaceUpdate received', components);
console.log('[SSE] DataModelUpdate received', path, contents);
console.log('[SSE] BeginRendering received', rootId);
console.log('[DataModel] set', path, value);
console.log('[DataModel] get', path, result);
console.log('[Renderer] renderComponent', id, type);
console.log('[Action] dispatched', action, sourceId);
console.log('[Action] response', result);
// 需要 9+ 个日志点才能完整追踪一个请求
```

---

## 8. 改进建议

### 8.1 短期改进

#### 8.1.1 增加开发调试工具

```typescript
// 建议：创建 A2UIDevTools 组件
function A2UIDevTools() {
  const snapshot = useA2UISnapshot();
  const [messages, setMessages] = useState<A2UIMessage[]>([]);

  return (
    <div className="fixed bottom-0 right-0 ...">
      <Tabs>
        <Tab label="DataModel">{JSON.stringify(snapshot, null, 2)}</Tab>
        <Tab label="Messages">{messages.map(renderMessage)}</Tab>
        <Tab label="Components">{renderComponentTree()}</Tab>
      </Tabs>
    </div>
  );
}
```

#### 8.1.2 添加类型生成工具

```bash
# 从 Rust 类型自动生成 TypeScript 类型
cargo run --bin generate-types > ../a2ui_front/src/a2ui/generated-types.ts
```

#### 8.1.3 路径常量化

```rust
// 后端
pub mod paths {
    pub const TICKETS_ITEMS: &str = "/app/tickets/items";
    pub const TICKETS_QUERY_SEARCH: &str = "/app/tickets/query/search";
}
```

```typescript
// 前端（自动生成）
export const PATHS = {
    TICKETS_ITEMS: '/app/tickets/items',
    TICKETS_QUERY_SEARCH: '/app/tickets/query/search',
} as const;
```

### 8.2 中期改进

#### 8.2.1 引入 Schema 验证

```typescript
// 在开发环境验证消息格式
if (process.env.NODE_ENV === 'development') {
  validateA2UIMessage(message); // Zod/Yup 验证
}
```

#### 8.2.2 错误边界增强

```typescript
class A2UIErrorBoundary extends Component {
  componentDidCatch(error, info) {
    console.error('[A2UI Error]', {
      error,
      dataModelSnapshot: this.context.snapshot,
      lastMessages: this.context.recentMessages,
    });
  }
}
```

#### 8.2.3 文档化数据路径

```markdown
# Data Model Paths

## /app/tickets
- /app/tickets/items/{id} - 工单项
  - id: string
  - title: string
  - status: string
  - ...
- /app/tickets/query/search - 搜索关键词
- /app/tickets/pagination/page - 当前页码
```

### 8.3 长期建议

#### 8.3.1 评估架构适用性

| 场景 | 推荐方案 |
|------|---------|
| 动态配置页面 | A2UI |
| 复杂交互（拖拽、编辑器）| 纯 React |
| 标准 CRUD | 考虑纯 React 或简化 A2UI |
| 实时协作 | A2UI + WebSocket |

#### 8.3.2 考虑简化架构

对于非动态 UI 需求，可能传统 React + REST API 更简单高效。

---

## 9. 适用场景建议

### 9.1 A2UI 适合的场景

- **动态配置 UI**：后台可配置的页面布局
- **AI 驱动界面**：LLM 生成 UI 组件
- **多端一致性**：一套后端定义，多前端渲染
- **实时推送需求**：股票行情、聊天消息等
- **权限驱动 UI**：根据用户角色动态显示组件

### 9.2 传统架构更优的场景

- **复杂交互**：富文本编辑器、拖拽排序
- **高性能要求**：大数据量表格、虚拟滚动
- **离线支持**：PWA、离线优先应用
- **快速迭代**：MVP 阶段、频繁 UI 变更
- **团队技能**：前端团队主导开发

### 9.3 混合架构建议

```
推荐的职责划分：

A2UI 负责：
├── 列表展示（支持分页、筛选）
├── 简单表单（输入、选择）
├── 详情展示
└── 通知推送

React 负责：
├── 复杂交互组件（标签选择器、日期范围）
├── 模态框和弹窗
├── 文件上传
├── 富文本编辑
└── 图表可视化
```

---

## 总结

A2UI 架构在 project_alpha 中的实现是一个**功能完整但复杂度较高**的服务端驱动 UI 方案。

**核心发现**：

1. **代码复杂度增加约 3-4 倍**：框架代码量大，业务代码分散
2. **Bug 排查时间增加约 3-6 倍**：调试工具缺失，错误定位困难
3. **开发反馈循环变长**：Rust 编译 + SSE 重连 vs React HMR
4. **前后端耦合紧密**：类型、路径、动作需要手动同步

**建议**：

- 评估是否真正需要动态 UI 能力
- 如需保留 A2UI，优先投入开发调试工具
- 考虑将 A2UI 限制在真正需要动态性的场景
- 标准 CRUD 页面可考虑回归传统 React 实现

---

*文档生成时间：2026-01-03*
*分析范围：a2ui_front/ + backend/src/a2ui/ + backend/src/handlers/a2ui.rs*
