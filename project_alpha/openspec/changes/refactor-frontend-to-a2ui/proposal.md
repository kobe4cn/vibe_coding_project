# Change: 基于 A2UI v0.8 重构前端应用

## Why
当前前端采用传统 React + React Router + TanStack Query 架构，需要迁移到 A2UI v0.8 协议，以便：
1. 实现服务端驱动的 UI 渲染（JSONL 流式消息）
2. 统一组件树与数据模型的绑定方式
3. 支持 userAction 事件回传机制，实现与后端的双向交互
4. 采用 MotherDuck 风格（黄色主色调、鸭子元素、温暖专业）

## What Changes
- **BREAKING**: 完全重构前端架构，从 React SPA 迁移到 A2UI 渲染器
- 创建新的 `a2ui_frontend` 目录，包含：
  - A2UI Lit 渲染器客户端 Shell
  - 与后端 API 对接的 Agent/Server 层（生成 A2UI JSONL 消息）
  - 基于 MotherDuck 风格的主题配置
- 保持与现有后端 API 完全兼容（`/api/tickets`、`/api/tags`、`/api/tickets/:id/attachments`）
- 提供完整的使用手册和文档

## Impact
- Affected specs:
  - a2ui-frontend-core（A2UI 渲染器与客户端架构）
  - a2ui-ticket-management（票据管理 UI 组件与交互）
  - a2ui-tag-management（标签管理 UI 组件与交互）
- Affected code:
  - 新建 `a2ui_frontend/` 目录
  - 新建 A2UI Agent Server（Python/Node）用于生成 UI 消息
  - 原有 `frontend/` 代码保持不变（可作为参考）
