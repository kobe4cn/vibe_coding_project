# Flow Runtime 能力规格

## ADDED Requirements

### Requirement: 流程执行引擎

系统 SHALL 提供基于 FDL 语义的流程运行时执行引擎，支持在浏览器中模拟执行流程。

#### Scenario: 启动流程执行
- **GIVEN** 一个有效的 FDL 流程定义
- **AND** 用户提供了必要的输入参数
- **WHEN** 用户点击"运行"按钮
- **THEN** 执行引擎开始执行流程
- **AND** 所有起始节点（无入边的节点）并行启动
- **AND** UI 显示执行状态为"运行中"

#### Scenario: 暂停和恢复执行
- **GIVEN** 流程正在执行中
- **WHEN** 用户点击"暂停"按钮
- **THEN** 当前正在执行的节点完成后暂停
- **AND** 后续节点不再启动
- **WHEN** 用户点击"继续"按钮
- **THEN** 从暂停点恢复执行

#### Scenario: 停止执行
- **GIVEN** 流程正在执行中
- **WHEN** 用户点击"停止"按钮
- **THEN** 立即终止所有执行中的任务
- **AND** 清理执行上下文
- **AND** UI 显示执行状态为"已停止"

### Requirement: 隐式并行执行

系统 SHALL 按照 FDL 语义，自动并行执行无依赖关系的节点。

#### Scenario: 起始节点并行
- **GIVEN** 流程有 3 个起始节点（A、B、C），均无入边
- **WHEN** 流程开始执行
- **THEN** A、B、C 三个节点同时开始执行
- **AND** 三个节点的执行互不阻塞

#### Scenario: 同级节点并行
- **GIVEN** 节点 A 的 next 指向 B 和 C
- **WHEN** 节点 A 执行完成
- **THEN** B 和 C 同时开始执行

### Requirement: 显式依赖执行

系统 SHALL 按照 next/then/else/fail 定义的依赖关系顺序执行节点。

#### Scenario: 顺序执行
- **GIVEN** 节点 A 的 next 指向 B，B 的 next 指向 C
- **WHEN** 流程执行
- **THEN** A 完成后才启动 B
- **AND** B 完成后才启动 C

#### Scenario: 汇聚节点等待
- **GIVEN** 节点 A 和 B 的 next 都指向 C
- **WHEN** A 先完成，B 尚未完成
- **THEN** C 等待 B 完成后才开始执行

### Requirement: GML 表达式求值

系统 SHALL 提供完整的 GML 表达式求值器，用于计算节点的 args、with、only、sets 等表达式。

#### Scenario: 基础表达式求值
- **GIVEN** GML 表达式 `price * quantity`
- **AND** 上下文变量 price=100, quantity=5
- **WHEN** 求值器计算表达式
- **THEN** 返回结果 500

#### Scenario: 字符串模板求值
- **GIVEN** GML 表达式 `` `订单${orderId}已创建` ``
- **AND** 上下文变量 orderId="ORD001"
- **WHEN** 求值器计算表达式
- **THEN** 返回结果 "订单ORD001已创建"

#### Scenario: CASE 表达式求值
- **GIVEN** GML 表达式包含 CASE WHEN ... THEN ... ELSE ... END
- **WHEN** 求值器计算表达式
- **THEN** 按顺序匹配 WHEN 条件
- **AND** 返回首个匹配的 THEN 值

#### Scenario: 数组原型方法求值
- **GIVEN** GML 表达式 `orders.filter(o => o.amount > 100).sum('amount')`
- **AND** 上下文变量 orders 为订单数组
- **WHEN** 求值器计算表达式
- **THEN** 正确执行 filter 和 sum 方法链

#### Scenario: 空值安全求值
- **GIVEN** GML 表达式引用了 null 值的属性
- **WHEN** 求值器计算表达式
- **THEN** 不抛出异常
- **AND** 返回 null

### Requirement: 工具调用节点执行

系统 SHALL 执行工具调用节点，通过 Mock 机制模拟外部工具响应。

#### Scenario: API 调用模拟
- **GIVEN** exec 节点配置为 `api://crm-service/customer`
- **AND** 配置了 Mock 响应数据
- **WHEN** 节点执行
- **THEN** 返回配置的 Mock 数据
- **AND** 执行结果绑定为与节点 ID 同名的上下文变量

#### Scenario: 数据库查询模拟
- **GIVEN** exec 节点配置为 `db://ec.mysql.order/list`
- **WHEN** 节点执行
- **THEN** 根据 Mock 配置返回模拟的查询结果

#### Scenario: 默认 Mock 数据生成
- **GIVEN** exec 节点未配置 Mock 数据
- **WHEN** 节点执行
- **THEN** 基于工具出参类型自动生成 Mock 数据
- **AND** 字符串类型生成随机文本
- **AND** 数字类型生成随机数值
- **AND** 数组类型生成 1-5 个元素

#### Scenario: 模拟延迟
- **GIVEN** exec 节点配置了 Mock 延迟 500ms
- **WHEN** 节点执行
- **THEN** 等待 500ms 后返回结果

### Requirement: 条件节点执行

系统 SHALL 根据条件表达式结果选择执行路径。

#### Scenario: 条件跳转 - 条件成立
- **GIVEN** 条件跳转节点 when 表达式为 `isMember == true`
- **AND** 上下文变量 isMember=true
- **WHEN** 节点执行
- **THEN** 执行 then 指向的节点
- **AND** 不执行 else 指向的节点

#### Scenario: 条件跳转 - 条件不成立
- **GIVEN** 条件跳转节点 when 表达式为 `isMember == true`
- **AND** 上下文变量 isMember=false
- **WHEN** 节点执行
- **THEN** 执行 else 指向的节点
- **AND** 不执行 then 指向的节点

#### Scenario: 多分支跳转
- **GIVEN** 多分支节点有 3 个 case 条件
- **WHEN** 第二个 case 条件匹配
- **THEN** 执行第二个 case 的 then 目标
- **AND** 不执行其他分支

### Requirement: 延迟执行节点

系统 SHALL 执行延迟节点，暂停指定时间后继续。

#### Scenario: 固定延迟
- **GIVEN** 延迟节点配置 wait='3s'
- **WHEN** 节点执行
- **THEN** 等待 3 秒后继续执行后续节点

#### Scenario: 条件延迟
- **GIVEN** 延迟节点配置 only 条件
- **AND** only 条件为 false
- **WHEN** 节点执行
- **THEN** 跳过延迟，立即继续

### Requirement: 循环节点执行

系统 SHALL 执行集合遍历和条件循环节点。

#### Scenario: 集合遍历
- **GIVEN** each 节点配置为 `ids => id, index`
- **AND** ids 数组有 3 个元素
- **WHEN** 节点执行
- **THEN** 子流程执行 3 次
- **AND** 每次 id 和 index 绑定为当前元素和索引
- **AND** 按顺序执行（前一次完成后才开始下一次）

#### Scenario: 条件循环
- **GIVEN** loop 节点配置 vars='count=0' when='count < 3'
- **AND** 子流程中 sets='count = count + 1'
- **WHEN** 节点执行
- **THEN** 子流程执行 3 次
- **AND** 第 4 次检查 when 条件为 false，退出循环

#### Scenario: 循环结果输出
- **GIVEN** loop 节点配置 with='result'
- **WHEN** 循环执行完成
- **THEN** result 变量的值作为节点输出
- **AND** 绑定为与节点 ID 同名的上下文变量

### Requirement: 执行上下文管理

系统 SHALL 管理流程执行过程中的上下文变量。

#### Scenario: 输入参数绑定
- **GIVEN** 流程定义了输入参数 customerId
- **AND** 执行时提供 customerId="C001"
- **WHEN** 流程开始执行
- **THEN** customerId 在所有节点的表达式中可访问

#### Scenario: 节点输出绑定
- **GIVEN** 节点 ID 为 "customer"
- **WHEN** 节点执行完成，输出 {name: "张三"}
- **THEN** 后续节点可通过 customer.name 访问该值

#### Scenario: 子流程变量作用域
- **GIVEN** each 节点定义 vars='sum=0'
- **AND** 子流程中更新 sum
- **WHEN** 遍历执行
- **THEN** sum 变量在子流程内可见和可更新
- **AND** 遍历完成后 sum 保持最终值

### Requirement: 执行状态通知

系统 SHALL 实时通知执行状态变化。

#### Scenario: 节点开始通知
- **WHEN** 节点开始执行
- **THEN** 发送状态更新事件
- **AND** 包含节点 ID、开始时间

#### Scenario: 节点完成通知
- **WHEN** 节点执行完成
- **THEN** 发送状态更新事件
- **AND** 包含节点 ID、完成时间、执行结果

#### Scenario: 节点错误通知
- **WHEN** 节点执行出错
- **THEN** 发送错误事件
- **AND** 包含节点 ID、错误信息
- **AND** 若配置了 fail 目标，继续执行错误处理流程
