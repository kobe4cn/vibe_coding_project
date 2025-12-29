# userAction 事件参考

## 概述

用户与 A2UI 组件交互时，客户端会生成 `userAction` 事件发送到 Agent Server。

## userAction 结构

```typescript
interface UserAction {
  name: string;           // action 名称
  surfaceId: string;      // Surface ID
  sourceComponentId: string;  // 触发组件 ID
  timestamp: string;      // ISO 8601 时间戳
  context: Record<string, any>;  // 上下文数据
}
```

## 事件清单

### 导航

| Action | 描述 | Context |
|--------|------|---------|
| `navigate` | 页面导航 | `{to: string}` |

### 票据管理

| Action | 描述 | Context |
|--------|------|---------|
| `search_tickets` | 搜索票据 | `{search: string}` |
| `filter_status` | 状态筛选 | `{status: string}` |
| `filter_priority` | 优先级筛选 | `{priority: string}` |
| `paginate` | 分页 | `{page: number}` |
| `view_ticket` | 查看票据 | `{id: string}` |
| `create_ticket` | 创建票据 | `{form: {title, description, priority}}` |
| `update_ticket` | 更新票据 | `{id: string, form: {...}}` |
| `delete_ticket` | 删除票据 | `{id: string}` |
| `change_status` | 切换状态 | `{id: string, status: string, resolution?: string}` |

### 标签管理

| Action | 描述 | Context |
|--------|------|---------|
| `create_tag` | 创建标签 | `{form: {name, color}}` |
| `delete_tag` | 删除标签 | `{id: string}` |
| `set_tag_color` | 设置标签颜色 | `{color: string}` |

### 表单

| Action | 描述 | Context |
|--------|------|---------|
| `set_form_priority` | 设置优先级 | `{priority: string}` |

### 对话框

| Action | 描述 | Context |
|--------|------|---------|
| `show_delete_dialog` | 显示删除确认 | `{id: string}` |
| `show_create_tag_form` | 显示创建标签表单 | `{}` |
| `hide_create_tag_form` | 隐藏创建标签表单 | `{}` |
| `dismiss_dialog` | 关闭对话框 | `{}` |

### 其他

| Action | 描述 | Context |
|--------|------|---------|
| `retry` | 重试操作 | `{}` |
| `download_attachment` | 下载附件 | `{id: string}` |

## 服务端处理

在 `server/main.py` 的 `process_action` 函数中处理：

```python
async def process_action(action: UserAction) -> dict:
    name = action.name
    context = action.context

    if name == "navigate":
        return {"navigate": context.get("to", "/tickets")}

    elif name == "create_ticket":
        form = context.get("form", {})
        ticket = await api_client.create_ticket({
            "title": form.get("title"),
            "description": form.get("description"),
            "priority": form.get("priority", "medium"),
        })
        return {"navigate": f"/tickets/{ticket['id']}"}

    # ... 其他处理
```

## 响应格式

```python
# 导航到新页面
{"navigate": "/tickets/123"}

# 刷新当前页面
{"refresh": True}

# 客户端处理
{"handled": True}
```

## 添加新 Action

1. 在组件定义中添加 action：

```python
builder.button(
    "my-btn",
    "my-text",
    "my_action",
    [{"key": "data", "value": {"path": "/app/data"}}]
)
```

2. 在 `process_action` 中添加处理：

```python
elif name == "my_action":
    data = context.get("data")
    # 处理逻辑
    return {"navigate": "/result"}
```
