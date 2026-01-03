# Design: React + A2UI 混合架构

## Context

### 背景
当前项目有两种前端实现：
1. **传统 React 前端** (`frontend/`) - React 19 + React Router + TanStack Query
2. **A2UI 前端** (`a2ui_frontend/`) - 服务端驱动 UI，使用 Lit 渲染器 + Python FastAPI Server

A2UI 架构采用三层设计：
```
Browser Client → Python A2UI Server → Rust Backend
     (Lit)          (FastAPI)           (Axum)
```

### 问题分析
| 问题 | 影响 | 严重程度 |
|------|------|----------|
| Python 中间层增加延迟 | 每次请求多一次网络跳转 | 中 |
| 两套技术栈维护成本高 | 需要同时维护 Python 和 Rust | 高 |
| 代码重复 | 业务逻辑在两层重复实现 | 中 |
| 部署复杂度 | 需要部署两个后端服务 | 中 |
| 完全迁移风险 | 丧失 React 在复杂交互场景的优势 | 高 |

### 代码分析结论

**页面复杂度评估：**
| 页面 | 行数 | 复杂度 | 建议 |
|------|------|--------|------|
| TicketsPage | 152 | 中 | 纯 A2UI（列表+筛选）|
| TicketDetailPage | 287 | 高 | 混合（状态转移面板 React）|
| TicketCreatePage | 110 | 低 | 纯 A2UI（简单表单）|
| TicketEditPage | 340 | 极高 | 混合（TagSelector+附件 React）|
| TagsPage | 140 | 中 | 纯 A2UI（简单 CRUD）|

**组件复杂度评估：**
- **适合 A2UI**：StatusBadge, PriorityBadge, TagBadge, TicketCard, StatusActions, TicketHistory
- **保留 React**：Toast, TagSelector, IconSelector, AppLayout, StatusTransitionDialog, AttachmentUploader

### 约束条件
- 保持与现有 REST API 完全兼容
- 保持 A2UI v0.8 协议兼容性
- 遵循 Rust 社区最佳实践和项目现有风格
- React 作为主框架，A2UI Surface 作为嵌入组件

## Goals / Non-Goals

### Goals
- 将 A2UI 消息生成能力合并到 Rust Backend
- 采用 React + A2UI 混合架构，发挥各自优势
- 减少架构层级，提升性能
- 复用现有 React 组件，降低开发成本
- 重构客户端代码到新目录 `a2ui_front/`
- 提供完整的开发文档

### Non-Goals
- 不改变 A2UI v0.8 消息协议
- 不修改现有 REST API 接口
- 不实现移动端渲染器
- 不重构原 `frontend/` 目录

## Decisions

### Decision 1: Rust A2UI 模块结构

```
backend/src/a2ui/
├── mod.rs              # 模块入口，导出公共接口
├── types.rs            # A2UI 消息类型定义
├── builder.rs          # A2UI 消息构建器
├── handlers.rs         # SSE 端点和 Action 处理
└── pages/              # 页面构建器
    ├── mod.rs
    ├── layout.rs       # 应用布局
    ├── tickets.rs      # 票据相关页面
    ├── tags.rs         # 标签管理页面
    └── error.rs        # 错误页面
```

**为什么这样设计**：
- 与现有 `handlers/`、`routes/` 结构保持一致
- 页面构建器独立，便于扩展
- 类型单独模块，方便序列化/反序列化

### Decision 2: SSE 实现方案

使用 Axum 的 `axum::response::sse` 模块：

```rust
use axum::response::sse::{Event, Sse};
use futures::stream::Stream;

pub async fn stream_ui(
    State(state): State<AppState>,
    Query(params): Query<StreamParams>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        // 生成 surfaceUpdate 消息
        yield Ok(Event::default().data(surface_update));

        // 生成 dataModelUpdate 消息
        yield Ok(Event::default().data(data_model_update));

        // 生成 beginRendering 消息
        yield Ok(Event::default().data(begin_rendering));
    };

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping")
    )
}
```

**为什么选择 Axum SSE**：
- Axum 原生支持，无需额外依赖
- 与现有项目技术栈一致
- 支持 keep-alive，避免连接超时

**Alternatives considered**:
- `hyper` 直接实现：太底层，开发成本高
- WebSocket：过度设计，A2UI 只需单向推送

### Decision 3: A2UI Builder API 设计

采用链式调用风格，与 Python 版本保持一致：

```rust
pub struct A2UIBuilder {
    surface_id: String,
    components: Vec<Component>,
}

impl A2UIBuilder {
    pub fn new(surface_id: &str) -> Self { ... }

    // 组件构建
    pub fn text(&mut self, id: &str, text: impl Into<BoundValue>, usage_hint: Option<&str>) -> &mut Self { ... }
    pub fn button(&mut self, id: &str, child: &str, action: Action) -> &mut Self { ... }
    pub fn text_field(&mut self, id: &str, label: &str, text: Option<BoundValue>, field_type: Option<&str>) -> &mut Self { ... }
    pub fn column(&mut self, id: &str, children: Children) -> &mut Self { ... }
    pub fn row(&mut self, id: &str, children: Children) -> &mut Self { ... }
    pub fn card(&mut self, id: &str, child: &str) -> &mut Self { ... }
    pub fn list(&mut self, id: &str, children: Children) -> &mut Self { ... }

    // 消息生成
    pub fn build_surface_update(&self) -> String { ... }
    pub fn build_data_model_update(path: &str, contents: Vec<ValueMap>) -> String { ... }
    pub fn build_begin_rendering(&self, root: &str) -> String { ... }
}
```

**值类型辅助函数**：
```rust
pub fn literal_string(value: &str) -> BoundValue { ... }
pub fn literal_number(value: f64) -> BoundValue { ... }
pub fn literal_bool(value: bool) -> BoundValue { ... }
pub fn path(value: &str) -> BoundValue { ... }
```

### Decision 4: React + A2UI 混合架构

采用 React 作为主框架，A2UI Surface 作为 Web Component 嵌入：

**整体数据流：**
```
React App
  └── A2UIProvider (状态桥接)
       ├── A2UI Surface (DataModel)
       │     ↕ A2UIContext.syncToReact/setValue
       └── React Components (useState/React Query)
             ↕ API calls
Rust Backend
  ├── GET /api/a2ui/stream (SSE)
  ├── POST /api/a2ui/action (UserAction)
  └── REST API (/api/tickets, /api/tags, /api/attachments)
```

**混合页面示例（TicketEditPage）：**
```tsx
<div className="ticket-edit-layout">
  {/* 表单主体：A2UI Surface */}
  <div className="form-main">
    <A2UISurface path={`/tickets/${id}/edit`} />
  </div>

  {/* 侧边栏：React 组件 */}
  <div className="form-sidebar">
    <TagSelector tags={allTags} selectedIds={...} onChange={...} />
    <AttachmentUploader ticketId={id} onUpload={...} onDelete={...} />
  </div>
</div>
```

**为什么采用混合架构**：
- React 在复杂交互（TagSelector、附件上传）中优势明显
- A2UI 适合服务端驱动的列表和简单表单
- 复用现有 React 组件，降低开发成本

### Decision 5: 前端目录结构

```
a2ui_front/
├── src/
│   ├── main.tsx              # React 应用入口
│   ├── App.tsx               # Router 配置
│   ├── a2ui/                 # A2UI 集成层
│   │   ├── A2UISurface.tsx   # React 包装 Web Component
│   │   ├── useA2UI.ts        # SSE 连接 Hook
│   │   ├── A2UIContext.tsx   # 状态桥接 Context
│   │   ├── types.ts          # A2UI 类型定义
│   │   └── renderer/         # Lit 渲染器迁移
│   │       ├── index.ts
│   │       ├── components.ts
│   │       └── data-model.ts
│   ├── components/           # React 组件
│   │   ├── common/Toast.tsx
│   │   ├── tag/TagSelector.tsx
│   │   ├── attachment/AttachmentUploader.tsx
│   │   └── layout/AppLayout.tsx
│   ├── pages/                # 页面组件
│   ├── hooks/                # 复用 frontend/ hooks
│   ├── api/                  # 复用 frontend/ API
│   └── types/                # 复用 frontend/ 类型
├── styles/
│   └── motherduck.css        # MotherDuck 风格样式
├── public/
│   └── index.html            # HTML 入口
├── docs/
│   ├── architecture.md       # 混合架构说明
│   ├── hybrid-integration.md # React + A2UI 集成指南
│   └── components.md         # 组件使用指南
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

### Decision 6: 代理配置

开发环境 Vite 配置：
```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',  // 直接指向 Rust Backend
        changeOrigin: true,
      }
    }
  }
})
```

**变更说明**：
- 移除 Python A2UI Server 代理（原 `/api/a2ui` → `localhost:8001`）
- 所有 `/api` 请求统一由 Rust Backend 处理

## Risks / Trade-offs

### 风险 1: SSE 连接管理
- **风险**：长连接可能导致资源泄漏
- **缓解**：使用 keep-alive 心跳，设置合理超时

### 风险 2: Rust 学习曲线
- **风险**：团队需要熟悉 Rust 异步编程
- **缓解**：参考现有 handlers 实现，保持风格一致

### 风险 3: 回归测试
- **风险**：迁移可能引入功能回归
- **缓解**：逐页面迁移，每步验证功能完整性

### Trade-off: 代码量增加
- Rust 代码通常比 Python 更冗长
- 但获得了类型安全和性能优势
- 统一技术栈后长期维护成本降低

## Migration Plan

### Phase 1: Rust A2UI 模块实现
1. 创建 `backend/src/a2ui/` 目录结构
2. 实现 `types.rs` - A2UI 消息类型
3. 实现 `builder.rs` - 消息构建器
4. 实现 `handlers.rs` - SSE 和 Action 端点
5. 实现页面构建器（layout, tickets, tags, error）
6. 添加路由到 `routes/mod.rs`
7. 单元测试验证消息格式

### Phase 2: 前端客户端迁移
1. 创建 `a2ui_front/` 目录
2. 复制 `a2ui_frontend/client/` 代码
3. 更新 `vite.config.ts` 代理配置
4. 应用 MotherDuck 风格样式
5. 端到端功能验证

### Phase 3: 文档与清理
1. 编写 README.md 和开发文档
2. 验证所有功能正常
3. 归档 Python A2UI Server

## Open Questions

1. **并发策略**：是否需要限制同时 SSE 连接数？
   - 建议：初期不限制，监控后按需调整

2. **缓存策略**：是否需要缓存 surfaceUpdate 消息？
   - 建议：暂不缓存，页面结构简单，生成成本低

3. **错误处理**：SSE 断开时客户端如何恢复？
   - 建议：客户端已有自动重连机制（3 秒后重试）
