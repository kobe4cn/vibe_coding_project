# A2UI Frontend Core

## ADDED Requirements

### Requirement: A2UI Agent Server
系统 SHALL 提供一个基于 Python FastAPI 的 A2UI Agent Server，负责生成 A2UI v0.8 JSONL 消息并处理客户端 userAction 事件。

#### Scenario: 服务启动
- **WHEN** Agent Server 启动
- **THEN** 服务监听指定端口（默认 8080）
- **AND** 提供 SSE 端点用于消息推送
- **AND** 提供 POST 端点用于接收 userAction

#### Scenario: 初始 Surface 渲染
- **WHEN** 客户端连接到 SSE 端点
- **THEN** 服务返回 surfaceUpdate 消息定义组件结构
- **AND** 返回 dataModelUpdate 消息填充初始数据
- **AND** 返回 beginRendering 消息触发渲染

#### Scenario: userAction 处理
- **WHEN** 客户端发送 userAction 请求
- **THEN** 服务解析 action name 和 context
- **AND** 调用相应的后端 API
- **AND** 返回更新后的 A2UI 消息

### Requirement: A2UI Lit Renderer Client
系统 SHALL 提供一个基于 Lit 的客户端 Shell，负责渲染 A2UI 组件并发送用户交互事件。

#### Scenario: 客户端初始化
- **WHEN** 用户访问应用 URL
- **THEN** 客户端加载 Lit Renderer
- **AND** 建立与 Agent Server 的 SSE 连接
- **AND** 渲染接收到的 A2UI 组件

#### Scenario: 组件交互
- **WHEN** 用户与按钮、表单等组件交互
- **THEN** 客户端解析组件的 action 配置
- **AND** 从数据模型获取 context 值
- **AND** 发送 userAction 到 Agent Server

### Requirement: SSE 消息通道
系统 SHALL 使用 Server-Sent Events (SSE) 实现服务端到客户端的消息推送。

#### Scenario: 消息流式传输
- **WHEN** Agent Server 需要更新 UI
- **THEN** 通过 SSE 连接发送 JSONL 消息
- **AND** 客户端实时接收并处理消息

#### Scenario: 连接重连
- **WHEN** SSE 连接中断
- **THEN** 客户端自动尝试重新连接
- **AND** 重连成功后请求完整状态刷新

### Requirement: 路由状态管理
系统 SHALL 通过 A2UI 消息实现页面路由，而非浏览器原生路由。

#### Scenario: 页面导航
- **WHEN** 用户触发 navigate action
- **THEN** Agent Server 生成目标页面的组件结构
- **AND** 通过 surfaceUpdate 替换当前页面组件
- **AND** 更新浏览器 URL（可选，用于书签和分享）

#### Scenario: 深度链接
- **WHEN** 用户直接访问特定 URL（如 /tickets/123）
- **THEN** Agent Server 解析 URL 路径
- **AND** 生成对应页面的 A2UI 消息

### Requirement: MotherDuck 主题
系统 SHALL 应用 MotherDuck 风格主题，包括配色、字体、间距和圆角。

#### Scenario: 主题加载
- **WHEN** 客户端加载
- **THEN** 应用 MotherDuck 配色方案（主色 #FFD93D，深蓝 #1E3A5F）
- **AND** 使用 Inter 字体和 JetBrains Mono 代码字体
- **AND** 使用 8px 基础网格系统

#### Scenario: 组件样式
- **WHEN** 渲染按钮、卡片、输入框等组件
- **THEN** 应用 MotherDuck 风格的圆角（8-16px）
- **AND** 使用适当的阴影效果
- **AND** 保持响应式布局

### Requirement: 后端 API 代理
Agent Server SHALL 代理所有对后端的 API 请求，保持与现有 Rust 后端完全兼容。

#### Scenario: API 请求转发
- **WHEN** Agent Server 需要获取或更新数据
- **THEN** 向后端 API 发送对应的 HTTP 请求
- **AND** 将响应数据转换为 A2UI dataModelUpdate

#### Scenario: 错误处理
- **WHEN** 后端 API 返回错误
- **THEN** Agent Server 生成错误提示 UI 消息
- **AND** 保持用户当前的操作上下文
