# 前后端代码依赖关系详解

> 本文档详细描述 A2UI 架构中前端与后端代码的依赖关系，包括类型定义、数据路径、组件映射和动作处理的同步要求。

---

## 目录

1. [依赖关系总览](#1-依赖关系总览)
2. [类型定义依赖](#2-类型定义依赖)
3. [组件类型依赖](#3-组件类型依赖)
4. [数据路径依赖](#4-数据路径依赖)
5. [动作定义依赖](#5-动作定义依赖)
6. [文件对应关系](#6-文件对应关系)
7. [同步检查清单](#7-同步检查清单)

---

## 1. 依赖关系总览

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              依赖关系图                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────┐        ┌──────────────────────┐                 │
│  │   后端 Rust 代码      │        │   前端 TypeScript    │                 │
│  └──────────────────────┘        └──────────────────────┘                 │
│                                                                            │
│  a2ui/types.rs ─────────────────▶ a2ui/types.ts                           │
│  (协议类型定义)                    (必须完全匹配)                            │
│                                                                            │
│  a2ui/builder.rs ───────────────▶ a2ui/renderer/renderer.ts               │
│  (支持的组件类型)                  (必须支持所有组件渲染)                     │
│                                                                            │
│  handlers/a2ui.rs ──────────────▶ a2ui/renderer/data-model.ts             │
│  (数据路径定义)                    (路径解析和访问)                          │
│                                                                            │
│  handlers/a2ui.rs ──────────────▶ pages/*.tsx                             │
│  (动作名称和上下文)                (动作发送和响应处理)                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 类型定义依赖

### 2.1 BoundValue 类型

**后端定义** (`backend/src/a2ui/types.rs`)：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BoundValue {
    LiteralString { literal_string: String },
    LiteralNumber { literal_number: f64 },
    LiteralBoolean { literal_boolean: bool },
    Path { path: String },
}
```

**前端对应** (`a2ui_front/src/a2ui/types.ts`)：

```typescript
export interface LiteralString {
  literalString: string;
}

export interface LiteralNumber {
  literalNumber: number;
}

export interface LiteralBoolean {
  literalBoolean: boolean;
}

export interface PathValue {
  path: string;
}

export type BoundValue = LiteralString | LiteralNumber | LiteralBoolean | PathValue;
```

**同步要求**：字段名必须通过 `serde(rename_all = "camelCase")` 转换后完全匹配。

### 2.2 ValueMap 类型

**后端定义**：

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ValueMap {
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_string: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_number: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_boolean: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_map: Option<Vec<ValueMap>>,
}
```

**前端对应**：

```typescript
export interface ValueMap {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueMap?: ValueMap[];
}
```

### 2.3 A2UIMessage 类型

**后端定义**：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum A2UIMessage {
    SurfaceUpdate { surface_update: SurfaceUpdatePayload },
    DataModelUpdate { data_model_update: DataModelUpdatePayload },
    BeginRendering { begin_rendering: BeginRenderingPayload },
    DeleteSurface { delete_surface: DeleteSurfacePayload },
}
```

**前端对应**：

```typescript
export interface SurfaceUpdate {
  surfaceUpdate: {
    surfaceId: string;
    components: Component[];
  };
}

export interface DataModelUpdate {
  dataModelUpdate: {
    surfaceId: string;
    path?: string;
    contents: ValueMap[];
  };
}

export interface BeginRendering {
  beginRendering: {
    surfaceId: string;
    root: string;
  };
}

export interface DeleteSurface {
  deleteSurface: {
    surfaceId: string;
  };
}

export type A2UIMessage = SurfaceUpdate | DataModelUpdate | BeginRendering | DeleteSurface;
```

### 2.4 Children 类型

**后端定义**：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Children {
    ExplicitList { explicit_list: Vec<String> },
    Template { template: TemplateBinding },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateBinding {
    pub component_id: String,
    pub data_binding: String,
}
```

**前端对应**：

```typescript
export interface ExplicitChildren {
  explicitList: string[];
}

export interface TemplateChildren {
  template: {
    componentId: string;
    dataBinding: string;
  };
}

export type Children = ExplicitChildren | TemplateChildren;
```

---

## 3. 组件类型依赖

### 3.1 后端支持的组件

**`backend/src/a2ui/builder.rs` 中定义的组件构建方法**：

| 方法名 | 生成的组件类型 | 用途 |
|--------|--------------|------|
| `text()` | Text | 文本显示 |
| `h1()` / `h2()` / `h3()` | Text (variant) | 标题 |
| `button()` | Button | 按钮 |
| `text_field()` | TextField | 输入框 |
| `column()` | Column | 垂直布局 |
| `row()` | Row | 水平布局 |
| `card()` | Card | 卡片容器 |
| `list()` | List | 列表 |
| `divider()` | Divider | 分隔线 |
| `icon()` | Icon | 图标 |
| `checkbox()` | CheckBox | 复选框 |
| `color_swatch()` | ColorSwatch | 颜色块 |

### 3.2 前端渲染器映射

**`a2ui_front/src/a2ui/renderer/renderer.ts` 中的渲染映射**：

```typescript
private renderComponent(comp: Component, contextPath?: string): TemplateResult {
  const componentType = Object.keys(comp.component)[0];
  const props = comp.component[componentType] as Record<string, unknown>;

  switch (componentType) {
    case 'Text':
      return this.renderText(comp.id, props, contextPath);
    case 'Button':
      return this.renderButton(comp.id, props, contextPath);
    case 'TextField':
      return this.renderTextField(comp.id, props, contextPath);
    case 'Column':
      return this.renderColumn(comp.id, props, contextPath);
    case 'Row':
      return this.renderRow(comp.id, props, contextPath);
    case 'Card':
      return this.renderCard(comp.id, props, contextPath);
    case 'List':
      return this.renderList(comp.id, props, contextPath);
    case 'Divider':
      return this.renderDivider(comp.id);
    case 'Icon':
      return this.renderIcon(comp.id, props);
    case 'CheckBox':
      return this.renderCheckBox(comp.id, props, contextPath);
    case 'ColorSwatch':
      return this.renderColorSwatch(comp.id, props, contextPath);
    default:
      console.warn(`Unknown component type: ${componentType}`);
      return html``;
  }
}
```

### 3.3 同步要求

| 后端组件类型 | 前端 case | 状态 |
|------------|----------|------|
| Text | Text | ✅ 已同步 |
| Button | Button | ✅ 已同步 |
| TextField | TextField | ✅ 已同步 |
| Column | Column | ✅ 已同步 |
| Row | Row | ✅ 已同步 |
| Card | Card | ✅ 已同步 |
| List | List | ✅ 已同步 |
| Divider | Divider | ✅ 已同步 |
| Icon | Icon | ✅ 已同步 |
| CheckBox | CheckBox | ✅ 已同步 |
| ColorSwatch | ColorSwatch | ✅ 已同步 |

**注意**：新增组件类型时，必须同时更新前后端。

---

## 4. 数据路径依赖

### 4.1 工单列表页路径 (`/app/tickets/*`)

**后端定义位置**：`handlers/a2ui.rs` - `build_tickets_ui()`

```
/app/tickets/
├── items/
│   └── {ticket_id}/
│       ├── id                    # 工单 ID
│       ├── title                 # 标题
│       ├── status                # 状态代码
│       ├── status_label          # 状态显示文本
│       ├── priority              # 优先级代码
│       ├── priority_label        # 优先级显示文本
│       ├── tags_display          # 标签显示文本
│       ├── created_at_display    # 创建时间显示
│       ├── updated_at_display    # 更新时间显示
│       └── process_btn_text      # 处理按钮文本
│
├── query/
│   ├── search                    # 搜索关键词
│   └── status                    # 状态筛选
│
├── pagination/
│   ├── page                      # 当前页码
│   ├── totalPages                # 总页数
│   ├── info                      # 分页信息文本
│   ├── prevEnabled               # 上一页是否可用
│   └── nextEnabled               # 下一页是否可用
│
└── filters/
    ├── filter-all/selected       # "全部" 筛选按钮状态
    ├── filter-open/selected      # "待处理" 筛选按钮状态
    ├── filter-progress/selected  # "处理中" 筛选按钮状态
    └── filter-completed/selected # "已完成" 筛选按钮状态
```

### 4.2 工单编辑页路径 (`/app/form/edit/*`)

**后端定义位置**：`handlers/a2ui.rs` - `build_ticket_edit_ui()`

```
/app/form/edit/
├── id                            # 工单 ID
├── title                         # 标题（可编辑）
├── description                   # 描述（可编辑）
├── status                        # 状态
├── status_label                  # 状态显示
├── priority                      # 优先级（可编辑）
└── priority_label                # 优先级显示
```

### 4.3 工单创建页路径 (`/app/form/create/*`)

```
/app/form/create/
├── title                         # 标题输入
├── description                   # 描述输入
└── priority                      # 优先级选择
```

### 4.4 工单详情页路径 (`/app/ticket/*`)

```
/app/ticket/
├── id
├── title
├── description
├── status
├── status_label
├── priority
├── priority_label
├── created_at_display
├── updated_at_display
├── tags/
│   └── {tag_id}/
│       ├── name
│       └── color
└── history/
    └── {history_id}/
        ├── from_status
        ├── to_status
        ├── note
        └── created_at_display
```

### 4.5 标签管理页路径 (`/app/tags/*`)

```
/app/tags/
└── items/
    └── {tag_id}/
        ├── id
        ├── name
        └── color
```

### 4.6 前端路径使用示例

```typescript
// pages/TicketsPage.tsx
const search = useA2UIValue<string>('/app/tickets/query/search');
const status = useA2UIValue<string>('/app/tickets/query/status');

// pages/TicketEditPage.tsx
const title = getValue('/app/form/edit/title') as string;
const priority = getValue('/app/form/edit/priority') as string;

// renderer.ts 中的模板渲染
const items = this.dataModel.getEntries('/app/tickets/items');
```

---

## 5. 动作定义依赖

### 5.1 工单列表动作

**后端处理** (`handlers/a2ui.rs` - `tickets_action()`)：

| 动作名称 | 上下文参数 | 响应 |
|---------|----------|------|
| `search_tickets` | search | `{ success: true }` |
| `filter_status` | status | `{ success: true }` |
| `prev_page` | - | `{ success: true }` |
| `next_page` | - | `{ success: true }` |
| `view_ticket` | ticketId | `{ success: true, redirect: "/tickets/{id}" }` |
| `process_ticket` | ticketId, newStatus, progressNote | `{ success: true, closeModal: true, dataUpdate: {...} }` |

### 5.2 工单编辑动作

**后端处理** (`handlers/a2ui.rs` - `ticket_edit_action()`)：

| 动作名称 | 上下文参数 | 响应 |
|---------|----------|------|
| `save_ticket` | title, description, priority, tagIds | `{ success: true, redirect: "/tickets/{id}" }` |
| `cancel_edit` | - | `{ success: true, redirect: "/tickets/{id}" }` |

### 5.3 工单创建动作

| 动作名称 | 上下文参数 | 响应 |
|---------|----------|------|
| `create_ticket` | title, description, priority | `{ success: true, redirect: "/tickets/{id}" }` |
| `cancel_create` | - | `{ success: true, redirect: "/tickets" }` |

### 5.4 标签管理动作

| 动作名称 | 上下文参数 | 响应 |
|---------|----------|------|
| `create_tag` | name, color | `{ success: true, dataUpdate: {...} }` |
| `delete_tag` | tagId | `{ success: true }` |

### 5.5 前端动作发送

```typescript
// useA2UI.ts - sendAction 方法
const sendAction = useCallback(async (
  action: Action,
  sourceId: string,
  contextPath?: string
): Promise<void> => {
  // 解析上下文参数
  const resolvedContext: Record<string, unknown> = {};
  if (action.context) {
    for (const { key, value } of action.context) {
      resolvedContext[key] = dataModel.resolve(value, contextPath);
    }
  }

  // 构建 UserAction
  const userAction: UserAction = {
    name: action.name,                    // 必须与后端匹配
    surfaceId,
    sourceComponentId: sourceId,
    timestamp: new Date().toISOString(),
    context: resolvedContext,
  };

  // 发送到后端
  const response = await fetch(actionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userAction),
  });

  const result = await response.json();
  // 处理响应...
}, []);
```

---

## 6. 文件对应关系

### 6.1 核心框架文件

| 后端文件 | 前端对应文件 | 依赖类型 |
|---------|------------|---------|
| `a2ui/types.rs` | `a2ui/types.ts` | 类型定义必须匹配 |
| `a2ui/builder.rs` | `a2ui/renderer/renderer.ts` | 组件类型必须支持 |
| `a2ui/sse.rs` | `a2ui/integration/useA2UI.ts` | SSE 消息格式匹配 |

### 6.2 业务处理文件

| 后端文件 | 前端对应文件 | 依赖内容 |
|---------|------------|---------|
| `handlers/a2ui.rs` | `pages/TicketsPage.tsx` | 数据路径、动作名称 |
| `handlers/a2ui.rs` | `pages/TicketEditPage.tsx` | 数据路径、动作名称 |
| `handlers/a2ui.rs` | `pages/TicketDetailPage.tsx` | 数据路径、动作名称 |
| `handlers/a2ui.rs` | `pages/TicketCreatePage.tsx` | 数据路径、动作名称 |
| `handlers/a2ui.rs` | `pages/TagsPage.tsx` | 数据路径、动作名称 |

### 6.3 路由文件

| 后端文件 | 前端对应文件 | 依赖内容 |
|---------|------------|---------|
| `routes/a2ui.rs` | `App.tsx` | API 路径 |

---

## 7. 同步检查清单

### 7.1 新增组件类型时

- [ ] 在 `builder.rs` 中添加构建方法
- [ ] 在 `types.rs` 中定义组件属性类型（如需要）
- [ ] 在 `renderer.ts` 中添加 switch case
- [ ] 在 `renderer.ts` 中实现 render 方法
- [ ] 在 `types.ts` 中添加类型定义（如需要）
- [ ] 添加对应的 Lit Web Component（如需要）

### 7.2 新增页面时

- [ ] 创建后端 `*_stream` 处理函数
- [ ] 创建后端 `*_action` 处理函数
- [ ] 在 `routes/a2ui.rs` 中添加路由
- [ ] 创建前端页面组件
- [ ] 在 `App.tsx` 中添加路由
- [ ] 文档化数据路径

### 7.3 修改数据路径时

- [ ] 更新后端 ValueMap 构建代码
- [ ] 更新前端所有使用该路径的代码
- [ ] 更新渲染器中的路径引用
- [ ] 更新文档

### 7.4 新增动作时

- [ ] 在后端 action 处理函数中添加 match 分支
- [ ] 在前端 onAction 回调中处理响应
- [ ] 确保上下文参数名称匹配
- [ ] 测试完整流程

### 7.5 修改类型定义时

- [ ] 同步修改 Rust 和 TypeScript 类型
- [ ] 确保 serde 序列化名称匹配
- [ ] 检查所有使用该类型的代码
- [ ] 重新测试 SSE 消息解析

---

## 附录：快速参考

### API 端点

| 端点 | 方法 | 用途 |
|-----|------|------|
| `/api/a2ui/tickets/stream` | GET (SSE) | 工单列表 |
| `/api/a2ui/tickets/action` | POST | 工单列表动作 |
| `/api/a2ui/tickets/:id/stream` | GET (SSE) | 工单详情 |
| `/api/a2ui/tickets/:id/action` | POST | 工单详情动作 |
| `/api/a2ui/tickets/:id/edit/stream` | GET (SSE) | 工单编辑 |
| `/api/a2ui/tickets/:id/edit/action` | POST | 工单编辑动作 |
| `/api/a2ui/tickets/create/stream` | GET (SSE) | 工单创建 |
| `/api/a2ui/tickets/create/action` | POST | 工单创建动作 |
| `/api/a2ui/tags/stream` | GET (SSE) | 标签列表 |
| `/api/a2ui/tags/action` | POST | 标签动作 |

### 常用数据路径

```typescript
// 工单列表
'/app/tickets/items'              // 工单列表数据
'/app/tickets/query/search'       // 搜索关键词
'/app/tickets/query/status'       // 状态筛选
'/app/tickets/pagination/page'    // 当前页码

// 工单表单
'/app/form/edit/title'           // 编辑标题
'/app/form/edit/description'     // 编辑描述
'/app/form/create/title'         // 创建标题

// 标签
'/app/tags/items'                // 标签列表
```

---

*文档生成时间：2026-01-03*
