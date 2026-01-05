# GML Editor 能力规格

## ADDED Requirements

### Requirement: GML 语法高亮

系统 SHALL 为 GML 表达式提供语法高亮显示。

#### Scenario: 关键字高亮
- **GIVEN** GML 表达式包含 CASE、WHEN、THEN、ELSE、END、return
- **WHEN** 在编辑器中显示
- **THEN** 关键字使用紫色高亮显示

#### Scenario: 操作符高亮
- **GIVEN** GML 表达式包含 =、==、!=、>、<、>=、<=、&&、||、!、+、-、*、/、%
- **WHEN** 在编辑器中显示
- **THEN** 操作符使用红色高亮显示

#### Scenario: 字符串高亮
- **GIVEN** GML 表达式包含单引号字符串 `'hello'` 或模板字符串 `` `${name}` ``
- **WHEN** 在编辑器中显示
- **THEN** 字符串内容使用绿色高亮
- **AND** 模板字符串中的 `${}` 插值表达式保持正常高亮

#### Scenario: 数字高亮
- **GIVEN** GML 表达式包含数字字面量 42、3.14、-100
- **WHEN** 在编辑器中显示
- **THEN** 数字使用蓝色高亮

#### Scenario: 注释高亮
- **GIVEN** GML 表达式包含 `# 注释内容`
- **WHEN** 在编辑器中显示
- **THEN** 注释使用灰色斜体显示

#### Scenario: 函数调用高亮
- **GIVEN** GML 表达式包含 `DATE()`, `COUNT(items)`, `MD5(key)`
- **WHEN** 在编辑器中显示
- **THEN** 函数名使用黄色高亮

### Requirement: GML 智能补全

系统 SHALL 为 GML 表达式提供智能代码补全。

#### Scenario: 关键字补全
- **GIVEN** 用户在编辑器中输入 "CA"
- **WHEN** 触发自动补全
- **THEN** 显示候选项 "CASE"
- **AND** 选择后插入完整的 CASE 模板

#### Scenario: 内置函数补全
- **GIVEN** 用户在编辑器中输入 "DAT"
- **WHEN** 触发自动补全
- **THEN** 显示候选项 "DATE", "DATE_FORMAT" 等时间相关函数
- **AND** 每个候选项显示函数签名和简要说明

#### Scenario: 上下文变量补全
- **GIVEN** 流程定义了输入参数 customerId、from
- **AND** 上游节点 customer 已输出数据
- **WHEN** 用户在当前节点的 args 编辑器中输入
- **THEN** 自动补全显示 customerId、from、customer
- **AND** 选择 customer 后可继续补全其属性（如 customer.name）

#### Scenario: 原型方法补全
- **GIVEN** 用户输入 "orders."
- **AND** orders 被识别为数组类型
- **WHEN** 触发自动补全
- **THEN** 显示数组方法：map, filter, proj, sum, avg, min, max, flat, group 等
- **AND** 每个方法显示参数签名和返回类型

#### Scenario: 对象方法补全
- **GIVEN** 用户输入 "user."
- **AND** user 被识别为对象类型
- **WHEN** 触发自动补全
- **THEN** 显示对象方法 proj 以及对象的已知属性

#### Scenario: 展开语法补全
- **GIVEN** 用户在对象构造中输入 "..."
- **WHEN** 触发自动补全
- **THEN** 显示可展开的对象变量列表

### Requirement: GML 悬浮提示

系统 SHALL 在鼠标悬浮时显示 GML 元素的提示信息。

#### Scenario: 函数悬浮提示
- **GIVEN** 用户鼠标悬浮在 `DATE('-3M')` 的 DATE 上
- **WHEN** 悬浮超过 300ms
- **THEN** 显示提示框包含：
  - 函数签名：`DATE(offset?: string): Date`
  - 说明：返回当前时间或偏移后的时间
  - 示例：`DATE()`, `DATE('-3M')`, `DATE('+1d')`

#### Scenario: 变量悬浮提示
- **GIVEN** 用户鼠标悬浮在变量 `customer` 上
- **WHEN** 该变量来自上游节点输出
- **THEN** 显示提示框包含：
  - 来源：节点 "customer" 的输出
  - 类型：对象（若可推断）
  - 已知属性：name, email, mobile 等

#### Scenario: 原型方法悬浮提示
- **GIVEN** 用户鼠标悬浮在 `.filter(o => o.amount > 1000)` 的 filter 上
- **WHEN** 悬浮超过 300ms
- **THEN** 显示提示框包含：
  - 方法签名：`filter(callback: (item) => boolean): Array`
  - 说明：保留满足条件的元素，返回过滤后的新数组
  - 示例：`orders.filter(o => o.amount > 1000)`

### Requirement: GML 错误提示

系统 SHALL 对 GML 表达式进行基础语法检查并显示错误。

#### Scenario: 括号不匹配
- **GIVEN** GML 表达式 `CASE WHEN a > 1 THEN 'yes'` 缺少 END
- **WHEN** 编辑器进行检查
- **THEN** 在表达式末尾显示红色波浪线
- **AND** 悬浮显示错误信息 "CASE 表达式缺少 END"

#### Scenario: 字符串未闭合
- **GIVEN** GML 表达式 `name = 'hello`
- **WHEN** 编辑器进行检查
- **THEN** 在字符串起始位置显示红色波浪线
- **AND** 悬浮显示错误信息 "字符串未闭合"

#### Scenario: 未知函数
- **GIVEN** GML 表达式 `UNKNOWNFUNC(x)`
- **WHEN** 编辑器进行检查
- **THEN** 在函数名处显示黄色波浪线（警告）
- **AND** 悬浮显示警告信息 "未知函数 UNKNOWNFUNC"

### Requirement: GML 编辑器组件

系统 SHALL 提供可嵌入的 GML 编辑器 React 组件。

#### Scenario: 单行编辑器
- **GIVEN** 简单的 GML 表达式输入场景（如节点的 only 条件）
- **WHEN** 渲染编辑器
- **THEN** 显示单行输入框样式
- **AND** 支持语法高亮和自动补全
- **AND** 按 Enter 提交，Shift+Enter 不换行

#### Scenario: 多行编辑器
- **GIVEN** 复杂的 GML 表达式输入场景（如节点的 with 映射）
- **WHEN** 渲染编辑器
- **THEN** 显示多行文本区域
- **AND** 显示行号
- **AND** 支持代码折叠
- **AND** Ctrl+Enter 提交

#### Scenario: 只读模式
- **GIVEN** 仅需展示 GML 表达式
- **WHEN** 设置 readonly 属性
- **THEN** 编辑器不可编辑
- **AND** 保持语法高亮
- **AND** 悬浮提示仍可用
