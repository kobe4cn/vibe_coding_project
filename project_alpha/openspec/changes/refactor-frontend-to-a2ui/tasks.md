# Tasks: A2UI Frontend Refactoring

## 1. 项目初始化与基础架构
- [x] 1.1 创建 `a2ui_frontend/` 目录结构
- [x] 1.2 初始化 A2UI Agent Server（Python FastAPI 项目）
- [x] 1.3 配置 A2UI Lit Renderer Client Shell（Vite + TypeScript）
- [x] 1.4 实现 SSE 消息通道（Agent Server → Client）
- [x] 1.5 实现 userAction 回传机制（Client → Agent Server）
- [x] 1.6 配置 MotherDuck 主题样式（CSS Variables）

## 2. 导航与布局
- [x] 2.1 实现 AppLayout 组件（顶部导航栏）
- [x] 2.2 实现路由状态管理（navigate action）
- [x] 2.3 实现 404 页面组件

## 3. 票据列表功能
- [x] 3.1 实现票据列表页面组件结构
- [x] 3.2 实现搜索框组件与 search_tickets action
- [x] 3.3 实现状态筛选器组件与 filter_status action
- [x] 3.4 实现优先级筛选器组件与 filter_priority action
- [x] 3.5 实现票据卡片组件（TicketCard）
- [x] 3.6 实现分页组件与 paginate action
- [x] 3.7 集成后端 API（GET /api/tickets）

## 4. 票据详情功能
- [x] 4.1 实现票据详情页面组件结构
- [x] 4.2 实现状态徽章组件（StatusBadge）
- [x] 4.3 实现优先级徽章组件（PriorityBadge）
- [x] 4.4 实现标签徽章组件（TagBadge）
- [x] 4.5 实现状态切换操作与 change_status action
- [x] 4.6 实现完成状态弹窗（输入处理结果）
- [x] 4.7 实现删除确认弹窗与 delete_ticket action
- [x] 4.8 实现附件列表展示与下载
- [x] 4.9 实现变更历史组件
- [x] 4.10 集成后端 API（GET/DELETE /api/tickets/:id, PATCH /api/tickets/:id/status）

## 5. 票据创建/编辑功能
- [x] 5.1 实现票据创建页面组件结构
- [x] 5.2 实现表单组件（标题、描述、优先级）
- [x] 5.3 实现 create_ticket action 与后端集成
- [x] 5.4 实现票据编辑页面组件结构
- [x] 5.5 实现 update_ticket action 与后端集成

## 6. 标签管理功能
- [x] 6.1 实现标签管理页面组件结构
- [x] 6.2 实现标签创建表单（名称、颜色选择）
- [x] 6.3 实现 create_tag action 与后端集成
- [x] 6.4 实现标签删除与 delete_tag action
- [x] 6.5 集成后端 API（GET/POST/DELETE /api/tags）

## 7. 通用组件与交互
- [x] 7.1 实现加载状态组件（Spinner）
- [x] 7.2 实现错误状态组件
- [x] 7.3 实现空状态组件
- [x] 7.4 实现 Toast 通知机制

## 8. 样式与主题
- [x] 8.1 应用 MotherDuck 配色方案
- [x] 8.2 配置字体（Inter + JetBrains Mono）
- [x] 8.3 实现响应式布局
- [x] 8.4 实现按钮、卡片、输入框等基础样式

## 9. 文档编写
- [x] 9.1 编写项目 README.md（安装与启动指南）
- [x] 9.2 编写架构说明文档（architecture.md）
- [x] 9.3 编写 A2UI 组件使用指南（components.md）
- [x] 9.4 编写 userAction 事件参考（actions.md）
- [x] 9.5 编写主题定制指南（theming.md）

## 10. 测试与验收
- [ ] 10.1 端到端功能测试（票据 CRUD）
- [ ] 10.2 端到端功能测试（标签管理）
- [ ] 10.3 响应式布局测试
- [ ] 10.4 错误处理测试
- [ ] 10.5 性能基准测试

## Dependencies
- 1.x 必须先完成，后续任务依赖基础架构
- 2.x 依赖 1.x
- 3.x, 4.x, 5.x, 6.x 可在 2.x 完成后并行开发
- 7.x 贯穿整个开发过程
- 8.x 可在功能开发过程中逐步应用
- 9.x 在功能完成后编写
- 10.x 在所有功能完成后进行

## Notes
测试任务 (10.x) 需要在实际运行环境中进行验证，待部署后执行。
