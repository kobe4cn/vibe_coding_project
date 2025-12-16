# Design: 票据变更历史记录和编辑时设置状态

## Context

当前系统支持票据的 CRUD 操作和状态变更，但缺少变更历史的追踪。同时，状态变更需要通过单独的 API 端点，与编辑流程分离。

## Goals / Non-Goals

### Goals
- 记录票据的所有重要变更（状态、优先级、处理结果、标签）
- 提供历史记录查询接口
- 在编辑页面可以直接设置状态
- 保持状态变更的验证逻辑

### Non-Goals
- 不记录标题和描述的每次变更（避免历史表过大）
- 不提供历史记录的编辑或删除功能
- 不实现复杂的审计日志功能（如操作者追踪）

## Decisions

### 1. 历史记录表设计

**表结构**：
```sql
CREATE TABLE ticket_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    change_type VARCHAR(20) NOT NULL,  -- status, priority, resolution, tag_added, tag_removed
    field_name VARCHAR(50),             -- 字段名（如 'status', 'priority'）
    old_value TEXT,                     -- 变更前的值
    new_value TEXT,                     -- 变更后的值
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_change_type CHECK (change_type IN (
        'status', 'priority', 'resolution', 'tag_added', 'tag_removed'
    ))
);
```

**设计理由**：
- 使用统一的表结构记录所有类型的变更
- `change_type` 区分变更类型，便于查询和展示
- `old_value` 和 `new_value` 存储变更前后的值（JSON 格式存储复杂值）
- 标签变更使用 `tag_added` 和 `tag_removed` 两种类型，`new_value` 存储标签 ID

**索引**：
```sql
CREATE INDEX idx_ticket_history_ticket_id ON ticket_history(ticket_id, created_at DESC);
CREATE INDEX idx_ticket_history_change_type ON ticket_history(change_type);
```

### 2. 历史记录触发时机

**自动记录的场景**：
1. **状态变更**：通过 `update_status` 或 `update_ticket`（如果包含状态）
   - 记录：`change_type='status'`, `old_value='open'`, `new_value='in_progress'`
2. **优先级变更**：通过 `update_ticket`
   - 记录：`change_type='priority'`, `old_value='medium'`, `new_value='high'`
3. **处理结果变更**：通过 `update_ticket` 或 `update_status`
   - 记录：`change_type='resolution'`, `old_value='...'`, `new_value='...'`
4. **标签添加**：通过 `add_tag`
   - 记录：`change_type='tag_added'`, `new_value='<tag_id>'`
5. **标签删除**：通过 `remove_tag`
   - 记录：`change_type='tag_removed'`, `old_value='<tag_id>'`

**不记录的场景**：
- 标题和描述的变更（避免历史表过大）
- 附件的添加/删除（附件有独立的表）

### 3. 编辑时设置状态

**后端变更**：
- `UpdateTicketRequest` 添加可选的 `status` 字段
- `update_ticket` handler 中：
  - 如果提供了 `status`，验证状态转换是否合法
  - 如果状态变为 `completed`，验证是否提供了 `resolution`
  - 执行状态变更逻辑（设置 `completed_at` 等）
  - 记录状态变更历史

**前端变更**：
- `TicketEditPage` 添加状态选择器
- 状态选择器显示当前状态和允许转换的状态
- 如果选择 `completed`，显示处理结果输入框（必填）

### 4. API 设计

**历史记录查询**：
```
GET /api/tickets/:id/history
Query Parameters:
  - change_type (optional): 过滤特定类型的变更
  - limit (optional): 返回记录数，默认 50
  - offset (optional): 分页偏移量

Response:
{
  "data": [
    {
      "id": "uuid",
      "ticket_id": "uuid",
      "change_type": "status",
      "field_name": "status",
      "old_value": "open",
      "new_value": "in_progress",
      "created_at": "2024-01-01T10:00:00Z"
    },
    ...
  ],
  "total": 10
}
```

**更新票据（支持状态）**：
```
PUT /api/tickets/:id
Request Body:
{
  "title": "...",           // optional
  "description": "...",     // optional
  "priority": "...",        // optional
  "status": "...",          // NEW: optional
  "resolution": "..."       // optional, required if status=completed
}

Response: TicketWithTags (same as before)
```

### 5. 前端 UI 设计

**编辑页面状态选择器**：
- 位置：在优先级选择器下方
- 显示：当前状态 + 允许转换的状态选项
- 验证：选择 `completed` 时必须填写处理结果

**历史记录展示**：
- 位置：票据详情页面的侧边栏或新标签页
- 格式：时间线形式，显示变更类型、时间、变更前后值
- 标签变更：显示标签名称（通过 tag_id 查询）

## Implementation Strategy

### Phase 1: 历史记录表和后端逻辑
1. 创建数据库迁移脚本
2. 实现历史记录插入函数
3. 在相关 handler 中添加历史记录逻辑
4. 实现历史记录查询 API

### Phase 2: 编辑时设置状态
1. 修改 `UpdateTicketRequest` 模型
2. 更新 `update_ticket` handler 支持状态变更
3. 前端添加状态选择器
4. 更新相关测试

### Phase 3: 前端历史记录展示
1. 创建历史记录组件
2. 在详情页面集成
3. 添加样式和交互

## Risks

1. **性能影响**：每次变更都插入历史记录可能影响性能
   - **缓解**：使用批量插入，添加适当的索引

2. **数据一致性**：历史记录与当前数据不一致
   - **缓解**：使用事务确保原子性

3. **历史表增长**：长期运行后历史表可能很大
   - **缓解**：考虑定期归档或清理策略（未来优化）

## Open Questions

1. 是否需要记录操作者信息？（当前无用户系统，暂不考虑）
2. 历史记录是否需要支持软删除？（暂不考虑，历史记录应不可变）
3. 是否需要提供历史记录的导出功能？（暂不考虑，未来可添加）

