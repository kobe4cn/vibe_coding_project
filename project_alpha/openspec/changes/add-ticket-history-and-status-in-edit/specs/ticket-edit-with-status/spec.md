# Spec: 编辑时设置状态

## MODIFIED Requirements

### Requirement: 编辑票据支持状态字段

编辑票据的 API SHALL 支持同时修改状态。

#### Scenario: 编辑时设置状态
**Given** 一个状态为 `open` 的票据
**When** 调用 `PUT /api/tickets/ticket-123` 并设置 `status: 'in_progress'`
**Then** 票据状态应更新为 `in_progress`
**And** 应记录状态变更历史
**And** 其他字段（如 title, description）也应正常更新

#### Scenario: 编辑时状态转换验证
**Given** 一个状态为 `completed` 的票据
**When** 调用 `PUT /api/tickets/ticket-123` 并设置 `status: 'in_progress'`
**Then** 应返回错误 `400 Invalid Transition`
**And** 错误信息应说明允许的状态转换

#### Scenario: 编辑时完成状态必需处理结果
**Given** 一个状态为 `open` 的票据
**When** 调用 `PUT /api/tickets/ticket-123` 并设置 `status: 'completed'` 但未提供 `resolution`
**Then** 应返回错误 `400 Validation Error`
**And** 错误信息应说明完成状态需要处理结果

#### Scenario: 编辑时完成状态设置处理结果
**Given** 一个状态为 `open` 的票据
**When** 调用 `PUT /api/tickets/ticket-123` 并设置 `status: 'completed'` 和 `resolution: '已修复'`
**Then** 票据状态应更新为 `completed`
**And** 处理结果应设置为 `'已修复'`
**And** `completed_at` 应设置为当前时间
**And** 应记录状态和处理结果的变更历史

#### Scenario: 编辑时不修改状态
**Given** 一个票据
**When** 调用 `PUT /api/tickets/ticket-123` 但不包含 `status` 字段
**Then** 票据状态应保持不变
**And** 其他字段正常更新

### Requirement: 前端编辑页面状态选择器

编辑页面 SHALL 提供状态选择器，允许用户直接设置状态。

#### Scenario: 显示当前状态
**Given** 打开编辑页面
**When** 页面加载完成
**Then** 状态选择器应显示当前状态
**And** 应显示允许转换的状态选项

#### Scenario: 选择完成状态
**Given** 编辑页面状态选择器
**When** 用户选择 `completed` 状态
**Then** 处理结果输入框应显示为必填
**And** 如果处理结果为空，提交按钮应禁用

#### Scenario: 状态选择器选项
**Given** 一个状态为 `open` 的票据
**When** 打开编辑页面
**Then** 状态选择器应显示选项：`in_progress`, `cancelled`
**And** 不应显示 `completed`（因为需要先到 `in_progress`）

#### Scenario: 提交包含状态的编辑
**Given** 编辑页面
**When** 用户修改标题、优先级和状态后提交
**Then** 应调用 `PUT /api/tickets/:id` 包含所有修改的字段
**And** 所有字段应一次性更新

## MODIFIED Data Model

### UpdateTicketRequest

```typescript
interface UpdateTicketRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TicketStatus;        // NEW: 可选的状态字段
  resolution?: string;           // 如果 status='completed' 则为必填
}
```

## MODIFIED API Endpoints

### PUT /api/tickets/:id

更新票据信息，现在支持同时更新状态。

**Path Parameters**:
- `id` (UUID): 票据 ID

**Request Body**:
```json
{
  "title": "Updated Title",      // optional
  "description": "Updated desc", // optional
  "priority": "high",            // optional
  "status": "in_progress",       // NEW: optional
  "resolution": "Fixed issue"    // optional, required if status='completed'
}
```

**Response 200**: `TicketWithTags` (same as before)

**Response 400**: 
- 无效的状态转换
- 完成状态缺少处理结果
- 其他验证错误

**Response 404**: 票据不存在

**Behavior Changes**:
- 如果提供了 `status`，会验证状态转换合法性
- 如果 `status='completed'`，会验证 `resolution` 是否提供
- 如果状态发生变化，会设置 `completed_at`（如果完成）或清除（如果从完成状态转换）
- 状态变更会记录到历史表

## Frontend Changes

### TicketEditPage Component

**New Fields**:
- `status` state: 当前编辑的状态值

**New UI Elements**:
- 状态选择器（在优先级选择器下方）
- 状态选择器显示当前状态和允许转换的状态
- 如果选择 `completed`，处理结果输入框显示为必填

**Updated Behavior**:
- 表单提交时包含 `status` 字段（如果已修改）
- 状态选择器根据当前状态动态显示可用选项

