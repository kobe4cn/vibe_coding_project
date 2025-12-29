# 架构说明

## 概述

本项目采用 A2UI v0.8 协议实现服务端驱动的 UI 渲染。核心架构包含两层：

1. **A2UI Agent Server (Python/FastAPI)**: 负责生成 A2UI JSONL 消息
2. **Lit Renderer Client**: 负责接收消息并渲染 UI

## 通信流程

```
┌──────────────────────────────────────────────────────────────────┐
│                         通信流程                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client                    Agent Server              Backend API │
│    │                           │                         │       │
│    │──── SSE Connect ─────────>│                         │       │
│    │                           │                         │       │
│    │                           │── GET /api/tickets ────>│       │
│    │                           │<────── JSON Response ───│       │
│    │                           │                         │       │
│    │<─── surfaceUpdate ────────│                         │       │
│    │<─── dataModelUpdate ──────│                         │       │
│    │<─── beginRendering ───────│                         │       │
│    │                           │                         │       │
│    │   [User Interaction]      │                         │       │
│    │                           │                         │       │
│    │──── POST userAction ─────>│                         │       │
│    │                           │── API Request ─────────>│       │
│    │                           │<─── API Response ───────│       │
│    │<─── navigate response ────│                         │       │
│    │                           │                         │       │
│    │──── SSE Reconnect ───────>│  (new page)            │       │
│    │                           │                         │       │
└──────────────────────────────────────────────────────────────────┘
```

## A2UI 消息类型

### surfaceUpdate

定义组件树结构：

```json
{
  "surfaceUpdate": {
    "surfaceId": "main",
    "components": [
      {
        "id": "title",
        "component": {
          "Text": {
            "text": {"literalString": "票据列表"},
            "usageHint": "h1"
          }
        }
      }
    ]
  }
}
```

### dataModelUpdate

更新数据模型：

```json
{
  "dataModelUpdate": {
    "surfaceId": "main",
    "path": "/app/tickets/list",
    "contents": [
      {"key": "ticket0", "valueMap": [
        {"key": "id", "valueString": "123"},
        {"key": "title", "valueString": "示例票据"}
      ]}
    ]
  }
}
```

### beginRendering

触发渲染：

```json
{
  "beginRendering": {
    "surfaceId": "main",
    "root": "app-layout"
  }
}
```

## 数据绑定

组件属性可以绑定到数据模型：

```json
{
  "id": "title",
  "component": {
    "Text": {
      "text": {"path": "/app/ticket/detail/title"}
    }
  }
}
```

- `literalString/literalNumber/literalBoolean`: 字面值
- `path`: 数据模型路径，支持相对路径

## 模板列表

使用 `template` 渲染动态列表：

```json
{
  "id": "ticket-list",
  "component": {
    "List": {
      "direction": "vertical",
      "children": {
        "template": {
          "componentId": "ticket-item",
          "dataBinding": "/app/tickets/list"
        }
      }
    }
  }
}
```

## userAction 事件

用户交互触发 action，客户端构建 userAction 发送到服务端：

```json
{
  "name": "view_ticket",
  "surfaceId": "main",
  "sourceComponentId": "ticket-item-btn",
  "timestamp": "2024-01-01T00:00:00Z",
  "context": {
    "id": "ticket-123"
  }
}
```

## 路由机制

采用 "navigate" action + SSE 重连实现页面切换：

1. 用户点击导航按钮
2. 触发 `navigate` action，context 包含目标路径
3. 服务端返回 `{"navigate": "/tickets/123"}`
4. 客户端更新 URL 并重新建立 SSE 连接
5. 服务端生成新页面的 A2UI 消息

## 错误处理

- API 调用失败时，Agent Server 生成错误页面
- SSE 连接断开时，客户端自动重连
- 未知路由返回 404 页面
