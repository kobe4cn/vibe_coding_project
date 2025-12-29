# A2UI 组件使用指南

## 标准组件

本项目使用 A2UI v0.8 标准 Catalog 中的组件。

### Text

文本显示组件。

```python
builder.text("title", "票据列表", usage_hint="h1")
builder.text("desc", builder.path("/app/ticket/description"))
```

**属性：**
- `text`: 文本内容，支持字面值或路径绑定
- `usageHint`: 样式提示，可选 `h1`, `h2`, `h3`, `h4`

### Button

按钮组件，触发 action。

```python
builder.text("btn-text", "提交")
builder.button(
    "submit-btn",
    "btn-text",  # 子组件 ID
    "create_ticket",  # action name
    [{"key": "form", "value": {"path": "/app/form"}}]  # context
)
```

**属性：**
- `child`: 按钮内容（子组件 ID）
- `action.name`: 事件名称
- `action.context`: 上下文数据

### TextField

文本输入框。

```python
builder.text_field(
    "title-input",
    "请输入标题",  # label/placeholder
    builder.path("/app/form/title"),  # 绑定路径
    text_field_type="multiline"  # 可选，多行文本
)
```

**属性：**
- `label`: 标签/占位符
- `text`: 值绑定
- `textFieldType`: 类型，`multiline` 为多行

### Column / Row

布局组件。

```python
builder.column("form", ["field1", "field2", "field3"])
builder.row("actions", ["cancel", "submit"], distribution="end")
```

**属性：**
- `children`: 子组件列表（explicitList）
- `alignment`: 对齐方式 (`center`)
- `distribution`: 分布方式 (`spaceBetween`, `center`, `end`)

### Card

卡片容器。

```python
builder.card("ticket-card", "ticket-content")
```

**属性：**
- `child`: 内容组件 ID

### List

列表组件，支持模板渲染。

```python
# 静态列表
builder.list_component("items", children=["item1", "item2"])

# 动态模板列表
builder.list_component(
    "tickets",
    template={"componentId": "ticket-item", "dataBinding": "/app/tickets/list"},
    direction="vertical"
)
```

**属性：**
- `children.explicitList`: 静态子组件列表
- `children.template`: 动态模板配置
- `direction`: 方向 (`vertical`, `horizontal`)

### Icon

Material Icons 图标。

```python
builder.icon("add-icon", "add")
builder.icon("dynamic-icon", builder.path("/app/icon"))
```

**属性：**
- `name`: 图标名称（Material Icons）

### Divider

分隔线。

```python
builder.divider("divider-1")
```

### Modal

模态框。

```python
builder.modal(
    "confirm-modal",
    "open-btn",  # 触发按钮
    "modal-content"  # 弹窗内容
)
```

**属性：**
- `entryPointChild`: 入口点组件
- `contentChild`: 弹窗内容组件

### CheckBox

复选框。

```python
builder.checkbox(
    "agree-checkbox",
    "我同意条款",
    builder.path("/app/form/agreed")
)
```

**属性：**
- `label`: 标签
- `value`: 选中状态

## 数据绑定

### 字面值

```python
builder.literal_string("文本")
builder.literal_number(42)
builder.literal_bool(True)
```

### 路径绑定

```python
builder.path("/app/ticket/title")
```

相对路径在 List template 中使用：

```python
builder.path("title")  # 相对于当前 dataContextPath
```

## 组件树构建

```python
from a2ui_builder import A2UIBuilder

builder = A2UIBuilder("main")

# 构建组件
builder.text("title", "票据列表", usage_hint="h1")
builder.text("add-text", "新建")
builder.button("add-btn", "add-text", "navigate", [
    {"key": "to", "value": {"literalString": "/tickets/new"}}
])
builder.row("header", ["title", "add-btn"], distribution="spaceBetween")

# 生成消息
surface_update = builder.build_surface_update()
begin_rendering = builder.build_begin_rendering("header")
```
