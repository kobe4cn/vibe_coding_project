# A2UI Frontend Refactoring - Technical Design

## Context
现有前端是一个基于 React 18、React Router、TanStack Query 的传统 SPA 应用，直接调用后端 REST API。需要迁移到 A2UI v0.8 协议，实现服务端驱动的 UI 渲染模式。

### 现有功能清单
1. **票据管理**
   - 票据列表（分页、搜索、状态/优先级筛选）
   - 票据详情（查看、状态切换、删除确认）
   - 票据创建（标题、描述、优先级）
   - 票据编辑（标题、描述、优先级、状态）
   - 附件查看与下载
   - 变更历史查看

2. **标签管理**
   - 标签列表（预定义/自定义分类）
   - 标签创建（名称、颜色）
   - 标签删除

3. **通用功能**
   - 导航布局（顶部导航栏）
   - 状态徽章、优先级徽章、标签徽章
   - Toast 通知
   - 弹窗确认

### 后端 API 端点
- `GET/POST /api/tickets` - 票据列表与创建
- `GET/PUT/DELETE /api/tickets/:id` - 票据详情、更新、删除
- `PATCH /api/tickets/:id/status` - 状态更新
- `POST/DELETE /api/tickets/:id/tags` - 标签关联
- `GET /api/tickets/:id/history` - 变更历史
- `GET/POST/DELETE /api/tickets/:id/attachments` - 附件管理
- `GET/POST /api/tags` - 标签列表与创建
- `GET/PUT/DELETE /api/tags/:id` - 标签详情、更新、删除

## Goals / Non-Goals

### Goals
- 使用 A2UI v0.8 协议完整实现现有前端功能
- 采用 JSONL 流式消息实现服务端驱动 UI
- 实现 userAction 事件回传机制
- 应用 MotherDuck 风格主题（主色 #FFD93D，深蓝 #1E3A5F）
- 提供完整的使用手册和开发文档
- 保持与现有后端 API 100% 兼容

### Non-Goals
- 不修改现有后端 API
- 不删除原有 React 前端代码
- 不实现原功能之外的新特性
- 不实现用户认证/授权（原系统未实现）

## Decisions

### Decision 1: 架构选型
**选择**: 采用「A2UI Agent Server + Lit Renderer Client」双层架构

**架构图**:
```
┌─────────────────────────────────────────────────────────────┐
│                     a2ui_frontend                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Lit Renderer      │◄───│    A2UI Agent Server        │ │
│  │   (Browser Client)  │    │    (Python FastAPI)         │ │
│  │                     │    │                             │ │
│  │  - Surface 渲染     │    │  - JSONL 消息生成           │ │
│  │  - DataModel 管理   │    │  - userAction 处理          │ │
│  │  - userAction 发送  │    │  - 后端 API 代理            │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│            ▲                            │                   │
│            │ A2UI JSONL (SSE)           │                   │
│            └────────────────────────────┘                   │
│                                         │                   │
│                                         ▼ REST API          │
│                            ┌─────────────────────────────┐  │
│                            │    Existing Backend         │  │
│                            │    (Rust/Axum)              │  │
│                            └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**理由**:
- A2UI Agent Server 负责生成 JSONL 消息，处理业务逻辑
- Lit Renderer 专注于 UI 渲染，保持轻量
- 通过 SSE/WebSocket 实现流式消息传输
- 便于后续扩展到 AI Agent 场景

**替代方案考虑**:
- 纯前端方案（前端生成 A2UI 消息）：不符合 A2UI 服务端驱动的设计理念
- Node.js Server：可行，但 Python 更适合后续 AI Agent 集成

### Decision 2: Surface 设计
**选择**: 采用单 Surface + 组件更新策略

**Surface ID 规划**:
- `main` - 主应用 Surface，包含导航和内容区

**页面映射**:
| 页面 | 根组件 | 主要组件 |
|------|--------|----------|
| 票据列表 | `tickets-page` | 搜索栏、筛选器、票据卡片列表、分页 |
| 票据详情 | `ticket-detail-page` | 详情卡片、状态操作、附件列表、历史记录 |
| 票据创建 | `ticket-create-page` | 表单（标题、描述、优先级） |
| 票据编辑 | `ticket-edit-page` | 表单（标题、描述、优先级、状态） |
| 标签管理 | `tags-page` | 创建表单、预定义标签、自定义标签列表 |
| 404 页面 | `not-found-page` | 提示信息、返回链接 |

**理由**:
- 单 Surface 简化状态管理
- 通过 surfaceUpdate 替换整个页面组件实现「路由」
- 减少组件 ID 冲突风险

### Decision 3: 数据模型设计
**选择**: 采用层级化 DataModel 路径

**数据路径规划**:
```
/app
├── /nav              # 导航状态
│   └── active        # 当前激活的导航项
├── /tickets          # 票据列表页数据
│   ├── /query        # 查询参数
│   │   ├── search
│   │   ├── status
│   │   ├── priority
│   │   └── page
│   ├── /list         # 票据列表（Map）
│   └── /pagination   # 分页信息
├── /ticket           # 当前票据详情
│   ├── /detail       # 票据数据
│   ├── /attachments  # 附件列表
│   └── /history      # 变更历史
├── /form             # 表单数据
│   ├── /create       # 创建表单
│   └── /edit         # 编辑表单
└── /tags             # 标签数据
    ├── /list         # 标签列表
    └── /form         # 创建表单
```

### Decision 4: userAction 事件设计
**选择**: 统一的 action 命名规范

**Action 命名规则**: `<动作>_<对象>`

| Action Name | 触发场景 | Context 数据 |
|-------------|----------|-------------|
| `navigate` | 导航切换 | `{to: string}` |
| `search_tickets` | 搜索票据 | `{query: TicketQuery}` |
| `filter_status` | 状态筛选 | `{status: string}` |
| `filter_priority` | 优先级筛选 | `{priority: string}` |
| `view_ticket` | 查看票据详情 | `{id: string}` |
| `create_ticket` | 提交创建 | `{form: CreateTicketRequest}` |
| `update_ticket` | 提交更新 | `{id: string, form: UpdateTicketRequest}` |
| `delete_ticket` | 删除票据 | `{id: string}` |
| `change_status` | 切换状态 | `{id: string, status: string, resolution?: string}` |
| `create_tag` | 创建标签 | `{form: CreateTagRequest}` |
| `delete_tag` | 删除标签 | `{id: string}` |
| `paginate` | 分页切换 | `{page: number}` |
| `confirm_dialog` | 确认弹窗 | `{confirmed: boolean, action: string, payload: any}` |

### Decision 5: 主题与样式
**选择**: 基于 MotherDuck 风格的 A2UI 自定义主题

**配色方案**:
- 主色（Primary）: `#FFD93D`（品牌黄）
- 深蓝（Secondary）: `#1E3A5F`
- 天蓝（Accent）: `#D5E8F0`
- Success: `#10B981`
- Warning: `#F59E0B`
- Error: `#EF4444`
- Info: `#3B82F6`

**排版**:
- 正文字体: Inter (sans-serif)
- 代码字体: JetBrains Mono (monospace)
- 字号层级: H1 36px, H2 28px, H3 22px, Body 16px, Small 14px

**间距与圆角**:
- 基础网格: 8px
- 卡片圆角: 12-16px
- 按钮圆角: 8px
- 输入框圆角: 8px

## Risks / Trade-offs

### Risk 1: A2UI 组件能力限制
**风险**: A2UI 标准 Catalog 可能不支持所有现有 UI 模式
**缓解**: 使用组合方式实现复杂 UI，必要时扩展自定义组件

### Risk 2: 开发复杂度增加
**风险**: 双层架构增加了开发和调试复杂度
**缓解**: 提供完善的开发文档和调试工具，确保日志链路完整

### Risk 3: 性能影响
**风险**: 服务端生成 UI 消息可能增加延迟
**缓解**: 使用 SSE 流式传输，支持增量更新

## Migration Plan

### Phase 1: 基础架构搭建
1. 创建 `a2ui_frontend/` 目录结构
2. 搭建 A2UI Agent Server（FastAPI）
3. 配置 Lit Renderer Client Shell
4. 实现基础导航与路由机制

### Phase 2: 票据管理功能
1. 实现票据列表页面
2. 实现票据详情页面
3. 实现票据创建/编辑表单
4. 实现状态切换与删除确认弹窗

### Phase 3: 标签与附件功能
1. 实现标签管理页面
2. 实现附件显示与下载
3. 实现变更历史展示

### Phase 4: 样式与文档
1. 应用 MotherDuck 主题样式
2. 编写使用手册
3. 编写开发文档
4. 端到端测试

### Rollback
- 原有 `frontend/` 保持不变，可随时回退
- 新旧前端可并行运行，通过不同端口访问

## Open Questions
1. ~~是否需要支持 WebSocket 除 SSE 之外的传输方式？~~ 暂时只使用 SSE
2. ~~A2UI Agent Server 使用 Python 还是 Node.js？~~ 使用 Python (FastAPI)
3. 是否需要实现离线支持？（建议 Non-Goal）
