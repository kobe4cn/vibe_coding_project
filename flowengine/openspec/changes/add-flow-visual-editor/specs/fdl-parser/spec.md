# FDL Parser 能力规格

## ADDED Requirements

### Requirement: FDL YAML 解析

系统 SHALL 能够将 FDL YAML 文本解析为结构化的 Flow Model。

#### Scenario: 解析基础流程结构
- **GIVEN** 一个包含 name、desp、args、node 的 FDL YAML
- **WHEN** 调用解析器
- **THEN** 返回包含以下属性的 FlowModel 对象：
  - `name`: 流程名称
  - `description`: 流程描述
  - `args`: 包含 in、out、defs 的参数定义
  - `vars`: 全局变量定义
  - `nodes`: 节点数组

#### Scenario: 解析输入参数
- **GIVEN** args.in 定义 `customerId: string` 和 `from: DATE('-3M')`
- **WHEN** 解析器处理参数
- **THEN** 识别 `customerId` 为必填字符串类型
- **AND** 识别 `from` 为可选日期类型，默认值为 `DATE('-3M')` 表达式

#### Scenario: 解析复杂类型定义
- **GIVEN** args.defs 定义了 Order 和 Item 两个类型
- **WHEN** 解析器处理类型定义
- **THEN** 构建类型引用关系（Order.items 引用 Item[]）
- **AND** 支持在 in/out 中引用定义的类型

#### Scenario: 解析工具调用节点
- **GIVEN** 节点定义包含 exec、args、with、only、next、fail
- **WHEN** 解析器处理节点
- **THEN** 正确识别节点类型为 ExecNode
- **AND** 解析 exec URI 为 toolType、toolCode、options
- **AND** 保留 args、with、only 的 GML 表达式文本

#### Scenario: 解析条件跳转节点
- **GIVEN** 节点定义包含 when、then、else
- **WHEN** 解析器处理节点
- **THEN** 正确识别节点类型为 ConditionNode
- **AND** 解析 when 为条件表达式
- **AND** 解析 then、else 为目标节点 ID

#### Scenario: 解析多分支跳转节点
- **GIVEN** 节点定义包含 case 数组和 else
- **WHEN** 解析器处理节点
- **THEN** 正确识别节点类型为 SwitchNode
- **AND** 解析每个 case 的 when 和 then
- **AND** 解析 else 为默认分支目标

#### Scenario: 解析子流程
- **GIVEN** 节点定义包含 each/loop 和内嵌的 node 块
- **WHEN** 解析器处理节点
- **THEN** 递归解析子流程中的节点
- **AND** 建立父子节点关系

#### Scenario: 解析错误处理
- **GIVEN** 一个语法错误的 YAML 文本
- **WHEN** 调用解析器
- **THEN** 返回包含错误信息的结果
- **AND** 错误信息包含行号和错误描述

### Requirement: FDL YAML 序列化

系统 SHALL 能够将 Flow Model 序列化为符合 FDL 规范的 YAML 文本。

#### Scenario: 序列化基础流程
- **GIVEN** 一个包含 3 个节点的 FlowModel
- **WHEN** 调用序列化器
- **THEN** 生成格式规范的 YAML 文本
- **AND** 使用 4 空格缩进
- **AND** 保持 flow.name、flow.desp、flow.args、flow.node 的顺序

#### Scenario: 序列化参数定义
- **GIVEN** FlowModel 包含输入输出参数和类型定义
- **WHEN** 序列化时
- **THEN** defs 在 in 之前输出
- **AND** 类型注释右对齐

#### Scenario: 序列化节点
- **GIVEN** FlowModel 包含各类型节点
- **WHEN** 序列化时
- **THEN** 节点按照引用关系排序（起始节点在前）
- **AND** 节点属性按规范顺序输出（name, desp, exec, args, with, only, next, fail）

#### Scenario: 序列化 GML 表达式
- **GIVEN** 节点的 args/with 包含 GML 表达式
- **WHEN** 序列化时
- **THEN** 单行表达式使用行内格式
- **AND** 多行表达式使用 YAML 多行字符串 `|`
- **AND** 多行表达式中 `=` 对齐

#### Scenario: 序列化子流程
- **GIVEN** FlowModel 包含 each/loop 节点及其子节点
- **WHEN** 序列化时
- **THEN** 子流程节点正确嵌套在父节点的 node 块内
- **AND** 保持正确的缩进层级

### Requirement: Flow Model 数据结构

系统 SHALL 定义清晰的 Flow Model TypeScript 类型作为解析和序列化的中间表示。

#### Scenario: 节点模型定义
- **GIVEN** Flow Model 类型定义
- **THEN** 节点类型包含以下公共属性：
  - `id`: 节点唯一标识
  - `type`: 节点类型枚举
  - `name`: 节点显示名称
  - `description`: 节点描述
  - `position`: 画布坐标 {x, y}
- **AND** 各节点类型包含特定属性

#### Scenario: 边模型定义
- **GIVEN** Flow Model 类型定义
- **THEN** 边类型包含：
  - `id`: 边唯一标识
  - `source`: 源节点 ID
  - `target`: 目标节点 ID
  - `sourceHandle`: 源端口类型（next/then/else/fail）
  - `type`: 边类型（normal/condition-true/condition-false/error）

### Requirement: 双向转换一致性

系统 SHALL 保证 YAML → Model → YAML 的转换一致性。

#### Scenario: 往返转换
- **GIVEN** 一个有效的 FDL YAML 文本
- **WHEN** 解析为 Model 后再序列化回 YAML
- **THEN** 重新序列化的 YAML 与原始 YAML 语义等价
- **AND** 格式可能略有不同（如空格、注释），但结构完全一致

#### Scenario: 保留注释
- **GIVEN** FDL YAML 中包含 `#` 注释
- **WHEN** 解析并序列化
- **THEN** 字段级注释 SHALL 被保留
- **AND** 注释与对应字段关联正确
