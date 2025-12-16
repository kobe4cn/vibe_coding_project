# Change: 初始化票据管理系统

## Why

构建一个基于标签分类和管理 ticket 的工具，用于跟踪任务、问题或工单。项目需要从零开始搭建，包括后端 API、数据库模型和前端界面。

## What Changes

### 后端 (Rust)
- 使用 Axum 框架搭建 RESTful API 服务
- 使用 SQLx 连接 PostgreSQL 数据库
- 实现 Ticket CRUD 操作 API
- 实现 Tag 管理 API
- 实现搜索和筛选 API
- 集成 Tracing 日志和 Health 健康检查

### 前端 (TypeScript)
- 使用 Vite + React + TypeScript 搭建前端项目
- 使用 Tailwind CSS + Shadcn UI 构建界面
- 实现 Ticket 列表、创建、编辑、详情页面
- 实现 Tag 管理界面
- 实现按标签筛选和标题搜索功能

### 数据库 (PostgreSQL)
- 设计 tickets 表（含状态、优先级、处理结果、完成时间等字段）
- 设计 tags 表（含颜色、图标属性）
- 设计 ticket_tags 关联表
- 设计 attachments 表（支持文件附件）

## Impact

- **新增规范**:
  - `ticket-management` - 票据核心管理功能（含优先级）
  - `tag-management` - 标签管理功能
  - `ticket-filtering` - 搜索和筛选功能
  - `ticket-attachments` - 附件管理功能

- **技术栈**:
  - 后端: Rust, Axum, Tokio, Serde, SQLx, Tracing
  - 前端: TypeScript, Vite, React, Tailwind, Shadcn
  - 数据库: PostgreSQL

- **部署**: 前后端分开部署，无需用户认证

