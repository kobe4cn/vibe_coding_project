# 流程节点能力扩展规范

## ADDED Requirements

### Requirement: OSS 节点（对象存储）

系统 SHALL 提供 OSS 节点用于对象存储操作。

#### Scenario: OSS 节点类型
- **WHEN** 用户从节点面板拖拽 OSS 节点
- **THEN** 系统创建对象存储操作节点
- **THEN** 节点支持配置：存储桶、操作类型、对象路径

#### Scenario: OSS 上传操作
- **WHEN** OSS 节点配置为 save 操作
- **THEN** 执行时将数据上传到指定路径
- **THEN** 返回上传后的对象 URL

#### Scenario: OSS 下载操作
- **WHEN** OSS 节点配置为 load 操作
- **THEN** 执行时从指定路径下载数据
- **THEN** 返回对象内容或二进制数据

#### Scenario: OSS 列表操作
- **WHEN** OSS 节点配置为 list 操作
- **THEN** 执行时列出指定前缀下的所有对象
- **THEN** 返回对象列表（包含名称、大小、修改时间）

### Requirement: MQ 节点（消息队列）

系统 SHALL 提供 MQ 节点用于消息队列操作。

#### Scenario: MQ 节点类型
- **WHEN** 用户从节点面板拖拽 MQ 节点
- **THEN** 系统创建消息队列操作节点
- **THEN** 节点支持配置：队列名称、操作类型、消息内容

#### Scenario: MQ 发布消息
- **WHEN** MQ 节点配置为 publish 操作
- **THEN** 执行时将消息发送到指定队列
- **THEN** 返回消息 ID

#### Scenario: MQ 订阅消息（触发器）
- **WHEN** MQ 节点配置为 subscribe 操作
- **THEN** 节点作为流程的事件触发器
- **THEN** 收到消息时触发流程执行

### Requirement: Mail 节点（邮件发送）

系统 SHALL 提供 Mail 节点用于邮件发送。

#### Scenario: Mail 节点类型
- **WHEN** 用户从节点面板拖拽 Mail 节点
- **THEN** 系统创建邮件发送节点
- **THEN** 节点支持配置：收件人、主题、正文、附件

#### Scenario: 发送普通邮件
- **WHEN** Mail 节点配置了收件人、主题和正文
- **THEN** 执行时发送邮件
- **THEN** 返回发送状态和消息 ID

#### Scenario: 发送模板邮件
- **WHEN** Mail 节点配置了模板 ID 和变量
- **THEN** 执行时使用模板渲染邮件内容
- **THEN** 发送渲染后的邮件

### Requirement: SMS 节点（短信发送）

系统 SHALL 提供 SMS 节点用于短信发送。

#### Scenario: SMS 节点类型
- **WHEN** 用户从节点面板拖拽 SMS 节点
- **THEN** 系统创建短信发送节点
- **THEN** 节点支持配置：手机号、内容、模板

#### Scenario: 发送短信
- **WHEN** SMS 节点配置了手机号和内容
- **THEN** 执行时通过配置的短信服务发送
- **THEN** 返回发送状态

### Requirement: Service 节点（微服务调用）

系统 SHALL 提供 Service 节点用于内部微服务调用。

#### Scenario: Service 节点类型
- **WHEN** 用户从节点面板拖拽 Service 节点
- **THEN** 系统创建微服务调用节点
- **THEN** 节点支持配置：服务名称、方法名、参数

#### Scenario: gRPC 服务调用
- **WHEN** Service 节点配置为 gRPC 类型
- **THEN** 执行时通过 gRPC 协议调用服务
- **THEN** 返回 protobuf 解码后的响应

### Requirement: ExecNode 工具选择器

系统 SHALL 为 ExecNode 提供可视化工具选择能力。

#### Scenario: 工具选择器显示
- **WHEN** 用户选中 ExecNode 并查看属性面板
- **THEN** exec 字段显示工具选择器组件
- **THEN** 选择器支持按类型、服务、工具三级选择

#### Scenario: 工具选择后自动填充
- **WHEN** 用户选择了一个工具
- **THEN** exec 字段自动填充为对应的 URI 格式
- **THEN** args 字段自动生成参数模板（基于工具的 args.in）

#### Scenario: 工具参数提示
- **WHEN** 用户编辑 ExecNode 的 args 表达式
- **THEN** 编辑器显示已选工具的参数定义
- **THEN** 提供参数名称的自动补全

### Requirement: AgentNode 工具绑定

系统 SHALL 支持为 AgentNode 绑定可用工具。

#### Scenario: 绑定工具列表
- **WHEN** 用户配置 AgentNode 的 tools 属性
- **THEN** 可从已注册的工具中选择
- **THEN** 选中的工具将作为 Agent 的可调用工具

#### Scenario: Agent 执行时工具调用
- **WHEN** Agent 运行时决定调用工具
- **THEN** 系统验证工具在绑定列表中
- **THEN** 执行工具调用并返回结果给 Agent

### Requirement: MCPNode 协议完善

系统 SHALL 完善 MCPNode 的 MCP 协议集成。

#### Scenario: MCP 服务器连接
- **WHEN** MCPNode 配置了 MCP 服务器地址
- **THEN** 系统建立 MCP 协议连接
- **THEN** 获取服务器提供的工具列表

#### Scenario: MCP 工具调用
- **WHEN** MCPNode 执行时
- **THEN** 通过 MCP 协议调用指定工具
- **THEN** 返回工具执行结果
