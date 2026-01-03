# Tasks: React + A2UI 混合架构重构

## Phase 1: 基础架构 ✅

### 1.1 前端项目初始化 ✅
- [x] 1.1.1 创建 `a2ui_front/` 目录结构
- [x] 1.1.2 初始化 package.json（React 19 + Vite + TypeScript + Lit）
- [x] 1.1.3 配置 tsconfig.json
- [x] 1.1.4 配置 vite.config.ts（代理 /api 到 localhost:3000）
- [x] 1.1.5 创建 public/index.html 入口

### 1.2 A2UI 渲染器迁移 ✅
- [x] 1.2.1 迁移 data-model.ts 到 `src/a2ui/renderer/`
- [x] 1.2.2 迁移 renderer.ts 到 `src/a2ui/renderer/`
- [x] 1.2.3 迁移 types.ts 到 `src/a2ui/`
- [x] 1.2.4 添加 React 事件订阅支持到 DataModel

### 1.3 A2UI-React 集成层 ✅
- [x] 1.3.1 实现 `A2UISurface.tsx` React 组件
  - useRef 挂载 a2ui-surface Web Component
  - useEffect 管理生命周期
  - 暴露 dataModel 和 actionHandler 接口
- [x] 1.3.2 实现 `useA2UI.ts` Hook
  - SSE 连接管理
  - 消息解析和分发
  - 自动重连机制（3秒）
- [x] 1.3.3 实现 `A2UIContext.tsx` 状态桥接
  - getValue/setValue 读写 DataModel
  - subscribe 监听变更
  - syncToReact 同步到 React 状态
  - triggerAction 触发 A2UI action

## Phase 2: Rust A2UI 模块 ✅

### 2.1 模块基础架构 ✅
- [x] 2.1.1 创建 `backend/src/a2ui/mod.rs` 模块入口
- [x] 2.1.2 实现 `types.rs` A2UI 消息类型
  - BoundValue (LiteralString, LiteralNumber, LiteralBoolean, Path)
  - ValueMap 结构
  - Component 和 Children 结构
  - Action 和 ActionContext
  - SurfaceUpdate, DataModelUpdate, BeginRendering 消息
  - UserAction 请求类型
- [x] 2.1.3 修改 `backend/src/lib.rs` 声明 a2ui 模块
- [x] 2.1.4 添加依赖到 Cargo.toml（tokio-stream, futures）

### 2.2 消息构建器 ✅
- [x] 2.2.1 实现 `builder.rs` ComponentBuilder struct
- [x] 2.2.2 实现组件构建方法
  - text, button, text_field
  - column, row, card
  - list (explicit + template)
  - checkbox, icon, divider
- [x] 2.2.3 实现值类型辅助函数
  - BoundValue::string, number, boolean, path
  - ValueMap::string, number, boolean, map
- [x] 2.2.4 实现 MessageBuilder 消息生成方法
  - surface_update
  - data_update
  - begin_rendering

### 2.3 SSE 和 Action 处理 ✅
- [x] 2.3.1 实现 `sse.rs` SSE 工具
  - sse_response 创建 SSE 响应
  - create_channel 创建消息通道
  - A2UISender 消息发送器
- [x] 2.3.2 实现 `handlers/a2ui.rs` 处理器
  - tickets_stream SSE 端点
  - tickets_action 动作处理
  - ticket_edit_stream 编辑页面 SSE
  - ticket_edit_action 编辑动作处理

### 2.4 路由集成 ✅
- [x] 2.4.1 创建 `routes/a2ui.rs` 路由模块
- [x] 2.4.2 修改 `routes/mod.rs` 添加 A2UI 路由
  - GET /api/a2ui/tickets/stream
  - POST /api/a2ui/tickets/action
  - GET /api/a2ui/tickets/:id/edit/stream
  - POST /api/a2ui/tickets/:id/edit/action

## Phase 3: React 组件迁移 ✅

### 3.1 通用组件 ✅
- [x] 3.1.1 迁移 Toast 组件和 ToastProvider
- [x] 3.1.2 迁移 TagBadge 组件

### 3.2 复杂交互组件 ✅
- [x] 3.2.1 迁移 TagSelector 组件
  - 添加 A2UI 集成接口（与 A2UIContext 桥接）

### 3.3 布局组件 ✅
- [x] 3.3.1 迁移 AppLayout 组件
  - 集成 A2UIProvider
  - 保持 React Router 导航

### 3.4 API 和 Hooks ✅
- [x] 3.4.1 创建 hooks/useTicket.ts（简化版）
- [x] 3.4.2 复制 types/index.ts
- [x] 3.4.3 复制 lib/utils.ts

## Phase 4: 页面实现 ✅

### 4.1 纯 A2UI 页面 ✅
- [x] 4.1.1 实现 TicketsPage（纯 A2UI surface）
- [x] 4.1.2 实现 TicketDetailPage（纯 A2UI surface）
- [x] 4.1.3 实现 TicketCreatePage（纯 A2UI surface）
- [x] 4.1.4 实现 TagsPage（纯 A2UI surface）

### 4.2 混合架构页面 ✅
- [x] 4.2.1 实现 TicketEditPage（混合）
  - 表单主体：A2UI Surface
  - TagSelector：React 组件
  - 数据协调：A2UIContext 桥接

### 4.3 应用入口 ✅
- [x] 4.3.1 实现 main.tsx 应用入口
- [x] 4.3.2 实现 App.tsx 路由配置

## Phase 5: 样式和文档 ✅

### 5.1 MotherDuck 风格 ✅
- [x] 5.1.1 创建 styles/globals.css
  - 品牌配色（#FFD93D, #1E3A5F）
  - 字体配置（Inter, JetBrains Mono）
  - 间距和圆角（8px 网格）
- [x] 5.1.2 更新 A2UI 渲染器样式（嵌入在 renderer.ts）

### 5.2 项目文档 ✅
- [x] 5.2.1 编写 README.md（架构说明、快速开始、目录结构）

## Phase 6: 测试验证

### 6.1 构建验证
- [ ] 6.1.1 运行 `npm install` 验证依赖
- [ ] 6.1.2 运行 `npm run build` 验证构建
- [ ] 6.1.3 运行 `cargo build` 验证 Rust 编译

### 6.2 功能测试
- [ ] 6.2.1 票据列表页面功能验证
- [ ] 6.2.2 票据详情页面功能验证
- [ ] 6.2.3 票据创建页面功能验证
- [ ] 6.2.4 票据编辑页面功能验证（含标签选择）
- [ ] 6.2.5 标签管理页面功能验证

### 6.3 集成测试
- [ ] 6.3.1 React-A2UI 状态同步验证
- [ ] 6.3.2 SSE 连接稳定性验证

## Dependencies

- Phase 1.2 依赖 1.1
- Phase 1.3 依赖 1.2
- Phase 2.x 可与 Phase 1 并行开发
- Phase 3 依赖 Phase 1.3
- Phase 4 依赖 Phase 2 和 Phase 3
- Phase 5 依赖 Phase 4
- Phase 6 依赖 Phase 5

## Notes

- 保持与现有 Python A2UI Server 的消息格式兼容，便于对比测试
- Rust A2UI 模块遵循现有 backend/src 代码风格
- 混合页面的 React 组件通过 A2UIContext 与 A2UI DataModel 同步
- TicketEditPage 是混合架构的核心示例
