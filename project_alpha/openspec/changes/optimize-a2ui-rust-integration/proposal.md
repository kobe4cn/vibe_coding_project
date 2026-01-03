# Change: 优化 A2UI 架构 - React + A2UI 混合架构重构

## Why
当前 A2UI 架构存在以下问题：
1. **Python 中间层增加复杂性**：Browser → Python A2UI Server → Rust Backend 的三层架构导致额外的网络调用和维护成本
2. **代码重复**：Python 端重复了 Rust 端已有的业务逻辑
3. **技术栈分裂**：需要同时维护 Python 和 Rust 两套代码
4. **过度迁移风险**：完全迁移到 A2UI 会丧失 React 在复杂交互场景的优势

根据 `cursor_a2ui_rust_improve.md` 的建议和对 `frontend/` 代码的深入分析，本提案将：
- **建议一**：将 A2UI 消息生成能力合并到 Rust Backend
- **建议二**：简化 A2UI 消息协议，降低构建复杂度
- **建议四**：采用混合架构 - **React 作为主框架，A2UI Surface 嵌入特定区域**

## 关键决策

| 决策项 | 选择 | 原因 |
|--------|------|------|
| TicketEditPage | 混合方案 | 表单主体 A2UI + TagSelector/附件上传 React（文件上传+复杂选择器需要 React）|
| 集成方式 | A2UI 嵌入 React | React 作为主框架，A2UI Surface 作为 Web Component 嵌入 |
| Rust 规范 | 遵循现有结构 | 参考 backend/src 的 handlers/routes/models 模式 |

## 页面策略

| 页面 | 方案 | 原因 |
|------|------|------|
| TicketsPage | 纯 A2UI | 列表+筛选，完全服务端驱动 |
| TicketDetailPage | 混合 | 静态内容 A2UI，状态转移面板 React |
| TicketCreatePage | 纯 A2UI | 简单表单，理想用例 |
| TicketEditPage | 混合 | 表单 A2UI + TagSelector/附件 React |
| TagsPage | 纯 A2UI | 简单 CRUD |

## 组件策略

**迁移到 A2UI：** StatusBadge, PriorityBadge, TagBadge, TicketCard, StatusActions, TicketHistory

**保留 React：** Toast, TagSelector, IconSelector, AppLayout, StatusTransitionDialog, AttachmentUploader

## What Changes

### 后端 Rust 模块 (新增)
- **NEW**: 在 `backend/src/a2ui/` 添加 A2UI 模块
  - `mod.rs` - 模块入口
  - `builder.rs` - A2UI 消息构建器（surfaceUpdate/dataModelUpdate/beginRendering）
  - `handlers.rs` - SSE 端点和 userAction 处理
  - `pages/` - 页面构建器（tickets、tags、layout、error）
  - `types.rs` - A2UI 消息类型定义

### 后端 API 端点 (新增)
- **NEW**: `GET /api/a2ui/stream` - SSE 流式推送 A2UI JSONL 消息
- **NEW**: `POST /api/a2ui/action` - 处理 userAction 用户交互事件

### 前端混合架构 (新建)
- **NEW**: `a2ui_front/` 新目录，采用 React + A2UI 混合架构
- **NEW**: `a2ui_front/src/a2ui/` A2UI 集成层
  - `A2UISurface.tsx` - React 包装的 A2UI Web Component
  - `useA2UI.ts` - SSE 连接管理 Hook
  - `A2UIContext.tsx` - React-A2UI 状态桥接 Context
  - `renderer/` - 迁移的 Lit 渲染器代码
- **NEW**: 从 `frontend/` 复用的 React 组件
  - TagSelector, IconSelector, Toast, AppLayout
- **NEW**: AttachmentUploader 新组件
- **MODIFIED**: 应用 MotherDuck 风格规则（style.md）

### 文档 (新增)
- **NEW**: `a2ui_front/README.md` - 安装与启动指南
- **NEW**: `a2ui_front/docs/architecture.md` - 混合架构说明
- **NEW**: `a2ui_front/docs/hybrid-integration.md` - React + A2UI 集成指南
- **NEW**: `a2ui_front/docs/components.md` - 组件使用指南

## Impact
- Affected specs:
  - a2ui-rust-module（Rust A2UI 消息生成模块）
  - a2ui-frontend-client（React + A2UI 混合架构客户端）
  - a2ui-backend-integration（后端 API 与 A2UI 集成）
- Affected code:
  - 新建 `backend/src/a2ui/` 模块
  - 新建 `a2ui_front/` 目录（React + A2UI 混合架构）
  - 修改 `backend/src/routes/mod.rs` 添加 A2UI 路由
  - 复用 `frontend/src/components/` 部分组件
  - 复用 `frontend/src/api/` 和 `frontend/src/hooks/`
  - Python A2UI Server (`a2ui_frontend/server/`) 保留作为参考

## Migration Plan
1. 创建 `a2ui_front/` 目录，配置 React + Vite 项目
2. 实现 A2UI 集成层（A2UISurface, useA2UI, A2UIContext）
3. 在 Rust Backend 实现 A2UI 模块
4. 迁移复用 React 组件（TagSelector, Toast 等）
5. 按页面逐步实现（先纯 A2UI 页面，后混合页面）
6. 应用 MotherDuck 风格，完成文档
7. 端到端测试验证

## Risks
- **中等风险**：Rust 实现 SSE 流需要正确处理并发和资源释放
- **中等风险**：React 与 A2UI 状态同步需要正确实现桥接层
- **低风险**：复用现有 React 组件降低了开发风险

## Non-Goals
- 不改变现有 REST API（`/api/tickets`, `/api/tags` 等保持不变）
- 不实现移动端渲染器（iOS/Android）
- 不重构原 `frontend/` 目录（保持独立作为对比参考）
