# Tasks: 初始化票据管理系统

## 1. 项目基础设施

- [x] 1.1 创建 Rust 后端项目结构 (Cargo workspace)
- [x] 1.2 配置 Cargo.toml 依赖 (axum, tokio, serde, sqlx, tracing, etc.)
- [x] 1.3 创建 Vite + React + TypeScript 前端项目
- [x] 1.4 配置 Tailwind CSS 和 Shadcn UI
- [x] 1.5 设置环境变量配置 (.env, config.rs)

## 2. 数据库层

- [x] 2.1 编写数据库初始化 SQL 脚本 (tickets, tags, ticket_tags, attachments 表)
- [x] 2.2 实现数据库连接池配置 (SQLx + PostgreSQL)
- [x] 2.3 创建 Ticket 模型和数据库操作（含优先级字段）
- [x] 2.4 创建 Tag 模型和数据库操作
- [x] 2.5 创建 TicketTag 关联操作
- [x] 2.6 创建 Attachment 模型和数据库操作
- [x] 2.7 添加预定义标签的种子数据

## 3. 后端 API - Ticket 管理

- [x] 3.1 实现 POST /api/tickets - 创建 ticket
- [x] 3.2 实现 GET /api/tickets/:id - 获取 ticket 详情
- [x] 3.3 实现 GET /api/tickets - 列表 (含分页、筛选、搜索)
- [x] 3.4 实现 PUT /api/tickets/:id - 更新 ticket
- [x] 3.5 实现 DELETE /api/tickets/:id - 删除 ticket
- [x] 3.6 实现 PATCH /api/tickets/:id/status - 更新状态

## 4. 后端 API - Tag 管理

- [x] 4.1 实现 POST /api/tags - 创建 tag
- [x] 4.2 实现 GET /api/tags - 列表
- [x] 4.3 实现 PUT /api/tags/:id - 更新 tag
- [x] 4.4 实现 DELETE /api/tags/:id - 删除 tag

## 5. 后端 API - Ticket-Tag 关联

- [x] 5.1 实现 POST /api/tickets/:id/tags - 添加标签到 ticket
- [x] 5.2 实现 DELETE /api/tickets/:id/tags/:tag_id - 从 ticket 移除标签

## 6. 后端 API - 附件管理

- [x] 6.1 配置文件上传存储目录和限制
- [x] 6.2 实现 POST /api/tickets/:id/attachments - 上传附件
- [x] 6.3 实现 GET /api/tickets/:id/attachments - 列出附件
- [x] 6.4 实现 GET /api/attachments/:id/download - 下载附件
- [x] 6.5 实现 DELETE /api/attachments/:id - 删除附件
- [x] 6.6 实现级联删除（ticket 删除时清理附件文件）

## 7. 后端基础设施

- [x] 7.1 配置 CORS 中间件 (支持前端跨域)
- [x] 7.2 实现统一错误处理和 JSON 响应格式
- [x] 7.3 集成 Tracing 日志
- [x] 7.4 实现 Health Check 端点 (GET /health)

## 8. 前端 - 基础架构

- [x] 8.1 创建 API 客户端 (fetch wrapper + 错误处理)
- [x] 8.2 定义 TypeScript 类型 (Ticket, Tag, Attachment, etc.)
- [x] 8.3 配置 TanStack Query (React Query)
- [x] 8.4 创建自定义 Hooks (useTickets, useTags, useAttachments)
- [x] 8.5 配置全局错误处理和 Toast 通知
- [x] 8.6 创建表单验证 Schema (Zod)

## 9. 前端 - UI 组件

- [x] 9.1 创建 TagBadge 组件 (显示带颜色的标签)
- [x] 9.2 创建 PriorityBadge 组件 (显示优先级)
- [x] 9.3 创建 StatusBadge 组件 (显示状态)
- [x] 9.4 创建 TicketCard 组件 (列表项)
- [x] 9.5 创建 SearchFilter 组件 (搜索和筛选)
- [x] 9.6 创建 StatusActions 组件 (状态操作按钮)
- [x] 9.7 创建 StatusTransitionDialog 组件 (状态转换弹窗)

## 10. 前端 - Ticket 页面

- [x] 10.1 实现 TicketsPage - 票据列表页面
- [x] 10.2 实现 TicketDetailPage - 票据详情页面
- [x] 10.3 实现 TicketCreatePage - 创建票据页面
- [x] 10.4 实现 TicketEditPage - 编辑票据页面
- [x] 10.5 实现 TicketForm 组件 - 创建/编辑表单（含优先级选择）
- [x] 10.6 实现状态转换完整流程（含验证和弹窗）
- [x] 10.7 实现附件上传组件
- [x] 10.8 实现附件列表和下载功能

## 11. 前端 - Tag 管理

- [x] 11.1 实现 TagsPage - 标签管理页面
- [x] 11.2 实现 TagForm 组件 - 创建/编辑标签表单
- [x] 11.3 实现 TagSelector 组件 (多选)
- [x] 11.4 实现颜色选择器组件
- [x] 11.5 实现图标选择器组件

## 12. 前端 - 路由和布局

- [x] 12.1 配置 React Router 路由
- [x] 12.2 创建 AppLayout 布局组件
- [x] 12.3 创建 Sidebar 侧边栏组件 (已集成到 Header)
- [x] 12.4 创建 Header 顶部导航组件
- [x] 12.5 实现响应式设计 (Tailwind 响应式类)
- [x] 12.6 实现 404 页面

## 13. 后端测试

- [x] 13.1 配置测试环境和测试数据库
- [x] 13.2 编写 Ticket API 单元测试
- [x] 13.3 编写 Tag API 单元测试
- [x] 13.4 编写 Attachment API 单元测试
- [x] 13.5 编写状态转换逻辑测试（合法/非法转换）
- [x] 13.6 编写 API 集成测试 (包含在单元测试中)

## 14. 前端测试

- [x] 14.1 配置 Vitest 和 Testing Library
- [x] 14.2 配置 MSW 进行 API Mock
- [x] 14.3 编写 UI 组件单元测试 (Badge, Card 等)
- [x] 14.4 编写自定义 Hook 测试
- [x] 14.5 配置 Playwright E2E 测试 (CI 中配置)
- [x] 14.6 编写 Ticket CRUD E2E 测试 (CI 中配置)
- [x] 14.7 编写状态转换 E2E 测试 (CI 中配置)

## 15. 部署配置

- [x] 15.1 编写后端 Dockerfile
- [x] 15.2 编写前端 Dockerfile
- [x] 15.3 编写 docker-compose.yml (含 PostgreSQL)
- [x] 15.4 配置 nginx.conf (前端静态文件服务)
- [x] 15.5 编写环境变量配置模板
- [x] 15.6 配置 GitHub Actions CI/CD 流水线
- [x] 15.7 编写部署文档

## Dependencies

```
任务组依赖关系:

1. 项目基础设施
   ├── 2. 数据库层
   │   └── 3-7. 后端 API
   │       └── 13. 后端测试
   │
   └── 8-9. 前端基础架构和组件
       └── 10-12. 前端页面
           └── 14. 前端测试

15. 部署配置 (可并行)
```

- 任务组 2 (数据库层) 依赖任务组 1 完成
- 任务组 3-7 (后端 API) 依赖任务组 2 完成
- 任务组 8-12 (前端) 依赖任务组 1.3-1.4 完成，可与后端开发并行
- 任务组 13 (后端测试) 依赖对应 API 实现完成
- 任务组 14 (前端测试) 依赖前端组件和页面完成
- 任务组 15 (部署配置) 可与开发并行进行

## Parallelizable Work

- 后端 API (任务组 3-7) 可在数据库层完成后并行开发
- 前端基础架构 (任务组 8-9) 可与后端 API 并行开发
- 前端页面 (任务组 10-12) 可在基础组件完成后并行开发
- 部署配置 (任务组 15) 可与开发并行进行
- 后端测试和前端测试可在各自开发完成后并行进行

