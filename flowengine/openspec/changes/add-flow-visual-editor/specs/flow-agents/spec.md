# Flow Agents 能力规格

## ADDED Requirements

### Requirement: AI Agent 节点

系统 SHALL 支持 AI Agent 节点，实现 LLM 驱动的智能处理。

#### Scenario: Agent 节点基础执行
- **GIVEN** Agent 节点配置了 model 和 instructions
- **WHEN** 节点执行
- **THEN** 使用配置的模型处理输入
- **AND** 按照 instructions 指令生成响应
- **AND** 结果绑定为与节点 ID 同名的上下文变量

#### Scenario: Agent 工具调用
- **GIVEN** Agent 节点配置了 tools 列表
- **AND** tools 引用了流程中的其他 exec 节点
- **WHEN** Agent 需要调用工具
- **THEN** 执行对应的 exec 节点
- **AND** 工具结果返回给 Agent 继续处理

#### Scenario: Agent 输出格式
- **GIVEN** Agent 节点配置 output_format 为 json
- **WHEN** Agent 生成响应
- **THEN** 尝试解析响应为 JSON 对象
- **AND** 解析失败时返回错误

#### Scenario: Agent Mock 模式
- **GIVEN** 流程在 Mock 模式下执行
- **WHEN** Agent 节点执行
- **THEN** 使用预配置的 Mock 响应
- **AND** 不调用真实 LLM API

#### Scenario: Agent 节点可视化
- **GIVEN** 画布上有 Agent 节点
- **THEN** 节点显示为带 AI 图标的圆角矩形
- **AND** 背景颜色为深蓝色 (#0D47A1)
- **AND** 显示 Agent 名称和模型信息

### Requirement: Guardrail 安全校验节点

系统 SHALL 支持 Guardrail 节点，提供输入/输出安全校验。

#### Scenario: PII 检测
- **GIVEN** Guardrail 节点配置 type 包含 pii
- **WHEN** 输入包含个人隐私信息（姓名、手机号、身份证等）
- **THEN** 检测结果标记为触发
- **AND** 返回检测到的 PII 类型和位置

#### Scenario: Jailbreak 检测
- **GIVEN** Guardrail 节点配置 type 包含 jailbreak
- **WHEN** 输入包含越狱攻击提示词
- **THEN** 检测结果标记为触发
- **AND** 返回风险等级和触发原因

#### Scenario: 内容审核
- **GIVEN** Guardrail 节点配置 type 包含 moderation
- **WHEN** 输入包含有害内容（暴力、色情、仇恨等）
- **THEN** 检测结果标记为触发
- **AND** 返回违规类别

#### Scenario: Schema 校验
- **GIVEN** Guardrail 节点配置 type 为 schema
- **AND** 配置了 JSON Schema 定义
- **WHEN** 输出不符合 Schema
- **THEN** 返回校验错误详情

#### Scenario: 自定义校验
- **GIVEN** Guardrail 节点配置 type 为 custom
- **AND** 配置了 GML 校验表达式
- **WHEN** 表达式求值为 false
- **THEN** 触发校验失败

#### Scenario: 校验失败处理 - Block
- **GIVEN** Guardrail 节点 action 配置为 block
- **WHEN** 校验失败
- **THEN** 流程跳转到 else 指向的节点
- **AND** 不继续执行后续节点

#### Scenario: 校验失败处理 - Warn
- **GIVEN** Guardrail 节点 action 配置为 warn
- **WHEN** 校验失败
- **THEN** 记录警告日志
- **AND** 继续执行 then 指向的节点

#### Scenario: 校验失败处理 - Redact
- **GIVEN** Guardrail 节点 action 配置为 redact
- **WHEN** PII 检测触发
- **THEN** 自动脱敏检测到的敏感信息
- **AND** 使用脱敏后的数据继续执行

#### Scenario: Guardrail 节点可视化
- **GIVEN** 画布上有 Guardrail 节点
- **THEN** 节点显示为盾牌形状
- **AND** 背景颜色为红色 (#C62828)
- **AND** 显示配置的校验类型列表

### Requirement: 人工审批节点

系统 SHALL 支持人工审批节点，实现 Human-in-the-Loop 流程。

#### Scenario: 审批节点触发
- **GIVEN** 流程执行到人工审批节点
- **WHEN** 节点开始执行
- **THEN** 流程暂停
- **AND** 弹出审批对话框
- **AND** 执行状态显示为"等待审批"

#### Scenario: 审批通过
- **GIVEN** 审批对话框显示
- **WHEN** 用户选择"批准"选项
- **THEN** 流程继续执行 then 指向的节点
- **AND** 审批结果记录到执行日志

#### Scenario: 审批拒绝
- **GIVEN** 审批对话框显示
- **WHEN** 用户选择"拒绝"选项
- **THEN** 流程跳转到 else 指向的节点
- **AND** 审批结果和拒绝原因记录到日志

#### Scenario: 审批超时
- **GIVEN** 审批节点配置了 timeout
- **WHEN** 超时时间到达且用户未操作
- **THEN** 执行 timeout_action 配置的默认操作
- **AND** 记录超时事件

#### Scenario: 审批意见
- **GIVEN** 审批对话框显示
- **WHEN** 用户输入审批意见
- **THEN** 意见文本保存到执行上下文
- **AND** 可在后续节点通过变量访问

#### Scenario: 审批节点可视化
- **GIVEN** 画布上有审批节点
- **THEN** 节点显示为带人形图标的圆形
- **AND** 背景颜色为青色 (#00838F)
- **AND** 显示审批标题

### Requirement: MCP 工具节点

系统 SHALL 支持 MCP 工具节点，通过 Model Context Protocol 连接外部服务。

#### Scenario: MCP Server 连接
- **GIVEN** 流程配置了 mcp_servers 列表
- **AND** MCP 节点引用了某个 server
- **WHEN** 流程开始执行
- **THEN** 建立与 MCP Server 的连接
- **AND** 获取可用工具列表

#### Scenario: MCP 工具调用
- **GIVEN** MCP 节点配置了 tool 名称和参数
- **WHEN** 节点执行
- **THEN** 调用 MCP Server 的指定工具
- **AND** 等待工具返回结果
- **AND** 结果绑定为与节点 ID 同名的上下文变量

#### Scenario: MCP 连接失败
- **GIVEN** MCP Server 不可用
- **WHEN** 尝试连接
- **THEN** 记录连接错误
- **AND** 根据配置执行重试或跳转到 fail 节点

#### Scenario: MCP 工具超时
- **GIVEN** MCP 工具调用超过配置的超时时间
- **WHEN** 超时发生
- **THEN** 取消等待
- **AND** 返回超时错误

#### Scenario: MCP Mock 模式
- **GIVEN** 流程在 Mock 模式下执行
- **WHEN** MCP 节点执行
- **THEN** 使用预配置的 Mock 响应
- **AND** 不实际连接 MCP Server

#### Scenario: MCP 节点可视化
- **GIVEN** 画布上有 MCP 节点
- **THEN** 节点显示为带插件图标的矩形
- **AND** 背景颜色为靛蓝色 (#303F9F)
- **AND** 显示 MCP Server 名称和工具名称

### Requirement: Agent 移交节点

系统 SHALL 支持 Agent 移交节点，实现 Agent 间的任务委托。

#### Scenario: 移交执行
- **GIVEN** Handoff 节点配置了 target Agent 流程
- **WHEN** 节点执行
- **THEN** 当前流程暂停
- **AND** 启动目标 Agent 流程
- **AND** 传递配置的上下文变量

#### Scenario: 移交返回
- **GIVEN** 目标 Agent 流程执行完成
- **WHEN** 返回条件满足（resume_on: completed）
- **THEN** 恢复当前流程执行
- **AND** 目标流程的输出可在当前流程中访问

#### Scenario: 移交超时
- **GIVEN** Handoff 节点配置了超时时间
- **WHEN** 目标流程执行超过超时时间
- **THEN** 取消目标流程
- **AND** 跳转到 fail 目标节点

#### Scenario: 循环移交检测
- **GIVEN** 多个 Agent 流程存在循环移交
- **WHEN** 检测到移交深度超过限制（默认 5 层）
- **THEN** 报告循环移交错误
- **AND** 中止执行

#### Scenario: 上下文传递
- **GIVEN** Handoff 节点配置了 context 列表
- **WHEN** 移交执行
- **THEN** 仅传递指定的上下文变量
- **AND** 其他变量不可见于目标流程

#### Scenario: Handoff 节点可视化
- **GIVEN** 画布上有 Handoff 节点
- **THEN** 节点显示为带箭头的双圆
- **AND** 背景颜色为棕色 (#5D4037)
- **AND** 显示目标 Agent 名称

### Requirement: Agent 节点属性编辑

系统 SHALL 提供 Agent 相关节点的属性编辑面板。

#### Scenario: Agent 节点编辑
- **GIVEN** 用户选中 Agent 节点
- **WHEN** 打开属性面板
- **THEN** 显示以下可编辑字段：
  - 节点名称
  - 模型选择（下拉列表）
  - Instructions（多行文本，支持 Markdown）
  - Tools 列表（可选择流程中的 exec 节点）
  - 输出格式选择
  - 温度参数滑块

#### Scenario: Guardrail 节点编辑
- **GIVEN** 用户选中 Guardrail 节点
- **WHEN** 打开属性面板
- **THEN** 显示以下可编辑字段：
  - 节点名称
  - 校验类型多选（pii, jailbreak, moderation, schema, custom）
  - 失败处理方式（block/warn/redact）
  - Schema 定义（当选择 schema 类型时）
  - 自定义 GML 表达式（当选择 custom 类型时）
  - then/else 目标节点选择

#### Scenario: 审批节点编辑
- **GIVEN** 用户选中审批节点
- **WHEN** 打开属性面板
- **THEN** 显示以下可编辑字段：
  - 节点名称
  - 审批标题
  - 审批描述（支持 GML 模板）
  - 审批选项列表（可添加/删除/排序）
  - 超时时间
  - 超时默认操作

#### Scenario: MCP 节点编辑
- **GIVEN** 用户选中 MCP 节点
- **WHEN** 打开属性面板
- **THEN** 显示以下可编辑字段：
  - 节点名称
  - MCP Server 选择（下拉列表，来自流程 mcp_servers 配置）
  - Tool 选择（下拉列表，来自 MCP Server 工具列表）
  - 参数配置（基于工具 Schema 动态生成）

#### Scenario: Handoff 节点编辑
- **GIVEN** 用户选中 Handoff 节点
- **WHEN** 打开属性面板
- **THEN** 显示以下可编辑字段：
  - 节点名称
  - 目标 Agent 流程选择
  - 传递上下文变量列表
  - 返回条件配置
  - 超时时间
