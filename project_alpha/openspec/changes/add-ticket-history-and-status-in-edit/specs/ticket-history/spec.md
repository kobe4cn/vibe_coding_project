# Spec: 票据变更历史记录

## ADDED Requirements

### Requirement: 历史记录存储

系统 SHALL 记录票据的以下变更：
- 状态变更（status）
- 优先级变更（priority）
- 处理结果变更（resolution）
- 标签添加（tag_added）
- 标签删除（tag_removed）

#### Scenario: 状态变更记录
**Given** 一个状态为 `open` 的票据
**When** 状态变更为 `in_progress`
**Then** 系统应在 `ticket_history` 表中创建一条记录
- `change_type` = `'status'`
- `field_name` = `'status'`
- `old_value` = `'open'`
- `new_value` = `'in_progress'`
- `created_at` 为当前时间

#### Scenario: 优先级变更记录
**Given** 一个优先级为 `medium` 的票据
**When** 优先级变更为 `high`
**Then** 系统应在 `ticket_history` 表中创建一条记录
- `change_type` = `'priority'`
- `field_name` = `'priority'`
- `old_value` = `'medium'`
- `new_value` = `'high'`

#### Scenario: 处理结果变更记录
**Given** 一个处理结果为空的票据
**When** 设置处理结果为 `'已修复问题'`
**Then** 系统应在 `ticket_history` 表中创建一条记录
- `change_type` = `'resolution'`
- `field_name` = `'resolution'`
- `old_value` = `null` 或空字符串
- `new_value` = `'已修复问题'`

#### Scenario: 标签添加记录
**Given** 一个没有标签的票据
**When** 添加标签 `tag-123`
**Then** 系统应在 `ticket_history` 表中创建一条记录
- `change_type` = `'tag_added'`
- `field_name` = `null`
- `old_value` = `null`
- `new_value` = `'tag-123'` (标签 ID)

#### Scenario: 标签删除记录
**Given** 一个包含标签 `tag-123` 的票据
**When** 删除标签 `tag-123`
**Then** 系统应在 `ticket_history` 表中创建一条记录
- `change_type` = `'tag_removed'`
- `field_name` = `null`
- `old_value` = `'tag-123'` (标签 ID)
- `new_value` = `null`

### Requirement: 历史记录查询

系统 SHALL 提供查询票据变更历史的 API。

#### Scenario: 查询票据所有历史
**Given** 一个票据 ID `ticket-123`
**When** 调用 `GET /api/tickets/ticket-123/history`
**Then** 应返回该票据的所有历史记录
- 按时间倒序排列（最新的在前）
- 包含所有变更类型的历史记录

#### Scenario: 按变更类型过滤
**Given** 一个票据的历史记录包含多种变更类型
**When** 调用 `GET /api/tickets/ticket-123/history?change_type=status`
**Then** 应只返回状态变更的历史记录

#### Scenario: 分页查询
**Given** 一个票据有 100 条历史记录
**When** 调用 `GET /api/tickets/ticket-123/history?limit=20&offset=0`
**Then** 应返回前 20 条记录
**And** 响应应包含总数信息

### Requirement: 历史记录数据完整性

历史记录 MUST 与票据变更操作在同一事务中完成。

#### Scenario: 事务回滚
**Given** 一个状态变更操作
**When** 状态变更失败（如无效的状态转换）
**Then** 不应创建历史记录
**And** 票据状态不应改变

#### Scenario: 标签操作失败
**Given** 一个添加标签的操作
**When** 标签添加失败（如标签不存在）
**Then** 不应创建历史记录
**And** 票据标签不应改变

### Requirement: 历史记录不可变

历史记录一旦创建，SHALL NOT 被修改或删除。

#### Scenario: 历史记录只读
**Given** 一条历史记录已创建
**When** 尝试更新或删除该记录
**Then** 系统应拒绝该操作
**Note**: 此需求通过数据库约束和 API 设计实现，不提供更新/删除接口

## Data Model

### TicketHistory

```typescript
interface TicketHistory {
  id: string;                    // UUID
  ticket_id: string;             // UUID, 外键到 tickets.id
  change_type: ChangeType;       // 'status' | 'priority' | 'resolution' | 'tag_added' | 'tag_removed'
  field_name: string | null;     // 字段名，标签变更时为 null
  old_value: string | null;      // 变更前的值
  new_value: string | null;      // 变更后的值
  created_at: string;            // ISO 8601 时间戳
}

type ChangeType = 
  | 'status' 
  | 'priority' 
  | 'resolution' 
  | 'tag_added' 
  | 'tag_removed';
```

## API Endpoints

### GET /api/tickets/:id/history

查询票据的变更历史。

**Path Parameters**:
- `id` (UUID): 票据 ID

**Query Parameters**:
- `change_type` (optional, string): 过滤变更类型
- `limit` (optional, number): 返回记录数，默认 50，最大 100
- `offset` (optional, number): 分页偏移量，默认 0

**Response 200**:
```json
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
    }
  ],
  "total": 10
}
```

**Response 404**: 票据不存在

**Response 400**: 无效的查询参数

