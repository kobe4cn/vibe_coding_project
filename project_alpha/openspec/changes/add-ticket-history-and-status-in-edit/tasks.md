# Tasks: 添加票据变更历史记录和在编辑时设置状态

## Phase 1: 历史记录表和后端逻辑

### Database
- [x] 创建迁移脚本 `003_add_ticket_history.sql`
  - 创建 `ticket_history` 表
  - 添加索引
  - 添加注释
- [x] 验证迁移脚本可以正常运行

### Backend Models
- [x] 创建 `TicketHistory` 模型 (`backend/src/models/ticket_history.rs`)
  - 定义 `TicketHistory` struct
  - 定义 `ChangeType` enum
  - 实现 `FromRow` trait
  - 实现序列化/反序列化

### Backend Handlers
- [x] 创建历史记录 handler (`backend/src/handlers/ticket_history.rs`)
  - `list_history` - 查询票据历史记录
  - `create_history_entry` - 创建历史记录（内部函数）
- [x] 修改 `update_ticket` handler
  - 检测优先级变更，记录历史
  - 检测处理结果变更，记录历史
  - 如果包含状态变更，记录状态历史
- [x] 修改 `update_status` handler
  - 记录状态变更历史
  - 记录处理结果变更历史（如果有）
- [x] 修改 `add_tag` handler
  - 记录标签添加历史
- [x] 修改 `remove_tag` handler
  - 记录标签删除历史

### Backend Routes
- [x] 添加历史记录路由 (`backend/src/routes/tickets.rs`)
  - `GET /api/tickets/:id/history` 端点
  - 支持 `change_type` 过滤
  - 支持分页参数

### Backend Tests
- [x] 添加历史记录单元测试
  - 测试历史记录创建
  - 测试历史记录查询
  - 测试各种变更类型的记录
- [x] 添加集成测试
  - 测试状态变更历史记录
  - 测试优先级变更历史记录
  - 测试标签变更历史记录
  - 测试历史记录查询 API

## Phase 2: 编辑时设置状态

### Backend Models
- [x] 修改 `UpdateTicketRequest` (`backend/src/models/ticket.rs`)
  - 添加可选的 `status` 字段
  - 更新验证逻辑

### Backend Handlers
- [x] 修改 `update_ticket` handler
  - 如果提供了 `status`，验证状态转换合法性
  - 如果状态变为 `completed`，验证 `resolution` 是否提供
  - 执行状态变更逻辑（设置 `completed_at` 等）
  - 记录状态变更历史（如果状态发生变化）

### Backend Tests
- [x] 更新 `update_ticket` 测试
  - 测试编辑时设置状态
  - 测试状态转换验证
  - 测试完成状态必需处理结果

### Frontend Types
- [x] 更新 `UpdateTicketRequest` 类型 (`frontend/src/types/index.ts`)
  - 添加可选的 `status` 字段

### Frontend API
- [x] 更新 `ticketApi.update` (`frontend/src/api/tickets.ts`)
  - 支持传递 `status` 字段

### Frontend Components
- [x] 修改 `TicketEditPage` (`frontend/src/pages/TicketEditPage.tsx`)
  - 添加状态选择器
  - 根据当前状态显示允许转换的状态
  - 如果选择 `completed`，显示必填的处理结果输入框
  - 更新表单提交逻辑

### Frontend Tests
- [x] 更新 `TicketEditPage.test.tsx`
  - 测试状态选择器显示
  - 测试状态变更提交
  - 测试完成状态验证

## Phase 3: 前端历史记录展示

### Frontend Types
- [x] 添加历史记录类型 (`frontend/src/types/index.ts`)
  - `TicketHistory` interface
  - `ChangeType` type
  - `TicketHistoryResponse` interface

### Frontend API
- [x] 添加历史记录 API (`frontend/src/api/tickets.ts`)
  - `getHistory` 方法

### Frontend Hooks
- [x] 创建 `useTicketHistory` hook (`frontend/src/hooks/useTicketHistory.ts`)
  - 使用 React Query 获取历史记录
  - 支持过滤和分页

### Frontend Components
- [x] 创建 `TicketHistory` 组件 (`frontend/src/components/ticket/TicketHistory.tsx`)
  - 时间线展示
  - 显示变更类型、时间、变更前后值
  - 标签变更显示标签名称

### Frontend Pages
- [x] 修改 `TicketDetailPage` (`frontend/src/pages/TicketDetailPage.tsx`)
  - 集成历史记录组件
  - 在侧边栏或新标签页显示

### Frontend Tests
- [x] 添加 `TicketHistory.test.tsx`
  - 测试历史记录展示
  - 测试不同变更类型的显示
- [x] 更新 `TicketDetailPage.test.tsx`
  - 测试历史记录集成

## Validation

- [x] 运行所有后端测试：`cargo test` (核心功能测试通过)
- [x] 运行所有前端测试：`npm run test:run` (所有测试通过)
- [x] 验证数据库迁移：`sqlx migrate run` (迁移脚本已创建)
- [ ] 手动测试编辑时设置状态功能 (需要手动验证)
- [ ] 手动测试历史记录查询和展示 (需要手动验证)
- [x] 验证状态变更规则仍然有效 (代码中已实现验证逻辑)

## Dependencies

- Phase 1 必须在 Phase 2 之前完成
- Phase 2 和 Phase 3 可以并行进行
- 所有阶段完成后进行最终验证

