# FDL 规范增强

## ADDED Requirements

### Requirement: 节点条件执行 (only)

系统 SHALL 支持通过 `only` 参数控制节点是否执行。

#### Scenario: only 条件为 true
- **WHEN** 节点配置了 `only: status == 'active'`
- **WHEN** 执行上下文中 status 值为 'active'
- **THEN** 节点正常执行
- **THEN** 执行结果绑定到上下文变量

#### Scenario: only 条件为 false
- **WHEN** 节点配置了 `only: status == 'active'`
- **WHEN** 执行上下文中 status 值为 'inactive'
- **THEN** 节点跳过执行
- **THEN** 不产生输出，流程继续执行后续节点

### Requirement: 错误跳转节点 (fail)

系统 SHALL 支持通过 `fail` 参数指定错误处理节点。

#### Scenario: 工具调用成功
- **WHEN** 工具调用节点执行成功
- **THEN** 按 `next` 定义继续执行后续节点

#### Scenario: 工具调用失败跳转
- **WHEN** 工具调用节点配置了 `fail: error_handler`
- **WHEN** 工具调用发生异常（超时、网络错误、服务错误）
- **THEN** 系统将错误信息注入上下文变量 `{nodeId}.error`
- **THEN** 流程跳转到 `fail` 指定的节点继续执行

#### Scenario: 未配置 fail 时失败
- **WHEN** 工具调用节点未配置 `fail` 参数
- **WHEN** 工具调用发生异常
- **THEN** 流程立即终止
- **THEN** 返回错误信息给调用方

### Requirement: 全局变量更新 (sets)

系统 SHALL 支持通过 `sets` 参数更新上下文变量。

#### Scenario: 更新单个变量
- **WHEN** 节点配置了 `sets: count = count + 1`
- **WHEN** 节点执行完成后
- **THEN** 系统执行 sets 表达式
- **THEN** 上下文中的 count 变量值增加 1

#### Scenario: 更新多个变量
- **WHEN** 节点配置了多行 sets 表达式
- **THEN** 系统按顺序执行所有赋值语句
- **THEN** 后续语句可引用前序语句的赋值结果

#### Scenario: sets 与 with 执行顺序
- **WHEN** 节点同时配置了 `sets` 和 `with`
- **THEN** 系统先执行 `sets` 更新全局变量
- **THEN** 再执行 `with` 计算节点输出值

### Requirement: 内置输入参数

系统 SHALL 自动注入多租户相关的内置参数。

#### Scenario: tenantId 自动注入
- **WHEN** 流程执行时
- **THEN** `tenantId` 变量自动可用于所有节点
- **THEN** 无需在 args.in 中显式定义

#### Scenario: buCode 自动注入
- **WHEN** 流程执行时
- **THEN** `buCode` 变量自动可用于所有节点
- **THEN** 工具调用节点自动将其传递给工具

### Requirement: 参数默认值支持

系统 SHALL 支持流程输入参数的默认值定义。

#### Scenario: 字面量默认值
- **WHEN** 参数定义为 `channel: string = 'pos'`
- **WHEN** 调用方未提供 channel 参数
- **THEN** 系统使用默认值 'pos'

#### Scenario: UDF 默认值
- **WHEN** 参数定义为 `from: date = DATE('-30d')`
- **WHEN** 调用方未提供 from 参数
- **THEN** 系统调用 DATE UDF 计算默认值
- **THEN** 返回 30 天前的日期

### Requirement: 类型定义可视化编辑

系统 SHALL 支持在流程画布中可视化编辑 args.defs 类型定义。

#### Scenario: 添加自定义类型
- **WHEN** 用户在流程参数面板点击"添加类型"
- **THEN** 系统显示类型编辑对话框
- **THEN** 用户可定义类型名称和字段列表
- **THEN** 保存后类型可在 args.in/out 中使用

#### Scenario: 编辑类型字段
- **WHEN** 用户编辑已有类型的字段
- **THEN** 可修改字段名称、类型、是否可空、注释
- **THEN** 修改实时同步到 YAML 定义
