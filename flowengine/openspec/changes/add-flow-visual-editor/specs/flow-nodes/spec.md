# Flow Nodes 能力规格

## ADDED Requirements

### Requirement: 节点类型体系

系统 SHALL 支持 FDL 规范定义的 7 种节点类型，每种类型有独特的视觉表现和行为。

#### Scenario: 节点类型识别
- **GIVEN** FDL 流程中的节点定义
- **WHEN** 解析节点参数时
- **THEN** 系统根据以下规则识别节点类型：
  - 包含 `exec` → 工具调用节点
  - 包含 `with` 但无 `exec` → 数据映射节点
  - 包含 `when` + `then` → 条件跳转节点
  - 包含 `case` → 多分支跳转节点
  - 包含 `wait` → 延迟执行节点
  - 包含 `each` → 集合遍历节点
  - 包含 `loop` + `when` → 条件循环节点

### Requirement: 工具调用节点 (ExecNode)

系统 SHALL 渲染工具调用节点为蓝色圆角矩形，并显示其核心配置。

#### Scenario: 工具调用节点渲染
- **GIVEN** 一个工具调用节点定义
- **WHEN** 节点渲染到画布
- **THEN** 显示蓝色 (#1976D2) 圆角矩形
- **AND** 节点标题显示 `name` 属性
- **AND** 节点副标题显示 `exec` URI 的简化形式
- **AND** 右下角显示工具类型图标（api/db/flow/agent）

#### Scenario: 工具调用节点端口
- **GIVEN** 一个工具调用节点
- **WHEN** 节点渲染完成
- **THEN** 顶部显示输入端口（可接收上游连线）
- **AND** 底部显示输出端口（可连接 next 节点）
- **AND** 若定义了 `fail`，显示错误输出端口（红色）

### Requirement: 数据映射节点 (MappingNode)

系统 SHALL 渲染数据映射节点为绿色菱形。

#### Scenario: 数据映射节点渲染
- **GIVEN** 一个数据映射节点定义
- **WHEN** 节点渲染到画布
- **THEN** 显示绿色 (#388E3C) 菱形
- **AND** 节点标题显示 `name` 属性
- **AND** 显示 GML 表达式的前 30 个字符预览

### Requirement: 条件跳转节点 (ConditionNode)

系统 SHALL 渲染条件跳转节点为橙色菱形，并显示条件分支。

#### Scenario: 条件跳转节点渲染
- **GIVEN** 一个条件跳转节点定义
- **WHEN** 节点渲染到画布
- **THEN** 显示橙色 (#F57C00) 菱形
- **AND** 节点内显示 `when` 条件表达式摘要
- **AND** 右侧显示绿色"是"输出端口（连接 then）
- **AND** 左侧显示红色"否"输出端口（连接 else）

#### Scenario: 条件分支连线
- **GIVEN** 条件跳转节点连接到后续节点
- **WHEN** 渲染连接线
- **THEN** then 分支使用绿色实线
- **AND** else 分支使用红色虚线

### Requirement: 多分支跳转节点 (SwitchNode)

系统 SHALL 渲染多分支跳转节点为橙色六边形。

#### Scenario: 多分支跳转节点渲染
- **GIVEN** 一个包含 3 个 case 的多分支节点
- **WHEN** 节点渲染到画布
- **THEN** 显示橙色 (#F57C00) 六边形
- **AND** 节点底部显示 3 个分支输出端口
- **AND** 若定义了 `else`，额外显示默认分支端口

### Requirement: 延迟执行节点 (DelayNode)

系统 SHALL 渲染延迟执行节点为灰色圆形。

#### Scenario: 延迟执行节点渲染
- **GIVEN** 一个延迟执行节点定义
- **WHEN** 节点渲染到画布
- **THEN** 显示灰色 (#616161) 圆形
- **AND** 节点内显示等待时间（如 "3s"、"5m"）
- **AND** 显示时钟图标

### Requirement: 集合遍历节点 (EachNode)

系统 SHALL 渲染集合遍历节点为紫色带循环标记的矩形容器。

#### Scenario: 集合遍历节点渲染
- **GIVEN** 一个集合遍历节点定义
- **WHEN** 节点渲染到画布
- **THEN** 显示紫色 (#7B1FA2) 边框的容器矩形
- **AND** 容器左上角显示循环图标和 `each` 表达式
- **AND** 容器内部显示子流程节点

#### Scenario: 子流程折叠
- **GIVEN** 一个展开的集合遍历节点
- **WHEN** 用户点击折叠按钮
- **THEN** 子流程节点隐藏
- **AND** 容器收缩为紧凑显示
- **AND** 显示"包含 N 个节点"提示

### Requirement: 条件循环节点 (LoopNode)

系统 SHALL 渲染条件循环节点为紫色带循环标记的矩形容器。

#### Scenario: 条件循环节点渲染
- **GIVEN** 一个条件循环节点定义
- **WHEN** 节点渲染到画布
- **THEN** 显示紫色 (#7B1FA2) 边框的容器矩形
- **AND** 容器左上角显示循环图标和 `when` 条件
- **AND** 容器内部显示子流程节点

### Requirement: 节点选择与交互

系统 SHALL 支持节点的选择、移动和删除操作。

#### Scenario: 单节点选择
- **GIVEN** 画布上有多个节点
- **WHEN** 用户点击某个节点
- **THEN** 该节点被选中并显示选中边框
- **AND** 其他节点取消选中
- **AND** 属性面板显示该节点的配置

#### Scenario: 节点拖动
- **GIVEN** 一个被选中的节点
- **WHEN** 用户拖动节点
- **THEN** 节点跟随鼠标移动
- **AND** 与该节点相连的连接线实时更新

#### Scenario: 节点删除
- **GIVEN** 一个或多个被选中的节点
- **WHEN** 用户按 Delete 键或 Backspace
- **THEN** 显示确认对话框"确定删除选中的节点？"
- **AND** 确认后删除节点及其所有连接线

### Requirement: 节点连接规则

系统 SHALL 根据 FDL 语义验证节点间的连接。

#### Scenario: 有效连接
- **GIVEN** 用户从节点 A 的输出端口拖出连线
- **WHEN** 连线到达节点 B 的输入端口
- **THEN** 若连接符合 FDL 规则，允许建立连接
- **AND** 自动更新源节点的 `next` 属性

#### Scenario: 无效连接 - 自连接
- **GIVEN** 用户从节点 A 的输出端口拖出连线
- **WHEN** 尝试连接回节点 A 的输入端口
- **THEN** 连接被拒绝
- **AND** 显示"不允许自连接"提示

#### Scenario: 无效连接 - 跨子流程
- **GIVEN** 用户在 each/loop 子流程内的节点
- **WHEN** 尝试连接到子流程外的节点
- **THEN** 连接被拒绝
- **AND** 显示"不允许跨子流程连接"提示

### Requirement: 节点拖拽创建

系统 SHALL 支持从节点面板拖拽创建新节点。

#### Scenario: 拖拽创建节点
- **GIVEN** 用户在节点面板选中某节点类型
- **WHEN** 用户将其拖拽到画布上
- **THEN** 在释放位置创建该类型的新节点
- **AND** 新节点自动获得唯一 ID
- **AND** 新节点进入编辑状态

#### Scenario: 拖拽到子流程容器
- **GIVEN** 用户拖拽一个节点类型
- **WHEN** 释放到 each/loop 容器内部
- **THEN** 新节点成为该子流程的一部分
- **AND** 节点 ID 在子流程范围内唯一
