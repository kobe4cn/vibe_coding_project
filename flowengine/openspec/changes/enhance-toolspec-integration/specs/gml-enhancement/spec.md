# GML 求值器增强规范

## ADDED Requirements

### Requirement: 完整语法解析

系统 SHALL 实现 GML 规范定义的完整语法解析能力。

#### Scenario: 基本映射解析
- **WHEN** 解析 GML 表达式 `name = user.profile.name`
- **THEN** 系统正确识别为赋值语句
- **THEN** 右侧解析为链式字段访问

#### Scenario: 单值映射解析
- **WHEN** 解析 GML 表达式 `user.addr.city`
- **THEN** 系统识别为单值映射模式
- **THEN** 返回字段访问表达式

#### Scenario: 对象构造解析
- **WHEN** 解析多行赋值语句
- **THEN** 系统识别为对象构造模式
- **THEN** 返回包含所有字段的对象

### Requirement: 数组原型方法

系统 SHALL 实现 GML 规范定义的所有数组原型方法。

#### Scenario: map 方法
- **WHEN** 执行 `items.map(item => item.sku)`
- **THEN** 返回包含所有 sku 值的新数组

#### Scenario: filter 方法
- **WHEN** 执行 `orders.filter(o => o.amount > 1000)`
- **THEN** 返回所有 amount 大于 1000 的订单数组

#### Scenario: proj 方法
- **WHEN** 执行 `orders.proj('channel, amount, time')`
- **THEN** 返回仅包含指定字段的对象数组

#### Scenario: sum 方法
- **WHEN** 执行 `orders.sum('amount')`
- **THEN** 返回所有订单 amount 字段的总和

#### Scenario: group 方法
- **WHEN** 执行 `orders.group('channel')`
- **THEN** 返回按 channel 分组的对象
- **THEN** 键为 channel 值，值为对应订单数组

#### Scenario: collap 方法
- **WHEN** 执行 `orders.collap('customerId', 'time DESC', 2)`
- **THEN** 按 customerId 分组
- **THEN** 每组按 time 降序排列
- **THEN** 每组最多保留 2 条记录

#### Scenario: sort 方法
- **WHEN** 执行 `orders.sort('amount DESC, time ASC')`
- **THEN** 返回按指定规则排序的数组

#### Scenario: distinct 方法
- **WHEN** 执行 `[1,2,2,3].distinct()`
- **THEN** 返回 `[1,2,3]`

#### Scenario: join 方法
- **WHEN** 执行 `['a','b'].join(',')`
- **THEN** 返回 `'a,b'`

#### Scenario: flat 方法
- **WHEN** 执行 `[[1,2],[3,4]].flat()`
- **THEN** 返回 `[1,2,3,4]`

#### Scenario: expand 方法
- **WHEN** 执行 `orders.expand('items')` 且订单包含 items 数组
- **THEN** 每个 item 展开为独立记录
- **THEN** 订单其他字段复制到每条记录

#### Scenario: length 方法
- **WHEN** 执行 `tags.length()`
- **THEN** 返回数组元素个数

### Requirement: 对象原型方法

系统 SHALL 实现 GML 规范定义的对象原型方法。

#### Scenario: 对象 proj 方法
- **WHEN** 执行 `user.proj('name, email')`
- **THEN** 返回仅包含 name 和 email 字段的新对象

### Requirement: 字符串原型方法

系统 SHALL 实现 GML 规范定义的字符串原型方法。

#### Scenario: toLowerCase 方法
- **WHEN** 执行 `'Hello'.toLowerCase()`
- **THEN** 返回 `'hello'`

#### Scenario: toUpperCase 方法
- **WHEN** 执行 `'Hello'.toUpperCase()`
- **THEN** 返回 `'HELLO'`

#### Scenario: 字符串 length 方法
- **WHEN** 执行 `'你好!'.length()`
- **THEN** 返回 `3`（Unicode 字符数）

### Requirement: 时间原型方法

系统 SHALL 实现 GML 规范定义的时间原型方法。

#### Scenario: offset 正向偏移
- **WHEN** 执行 `now.offset('30s')`
- **THEN** 返回当前时间加 30 秒

#### Scenario: offset 负向偏移
- **WHEN** 执行 `now.offset('-7d')`
- **THEN** 返回当前时间减 7 天

#### Scenario: offset 支持的单位
- **WHEN** 使用 offset 方法
- **THEN** 支持单位：y（年）、M（月）、d（天）、h（小时）、m（分钟）、s（秒）

### Requirement: CASE 表达式

系统 SHALL 实现 GML CASE 表达式求值。

#### Scenario: CASE 匹配第一个条件
- **WHEN** 执行 CASE 表达式且第一个 WHEN 条件为 true
- **THEN** 返回第一个 THEN 值

#### Scenario: CASE 无匹配使用 ELSE
- **WHEN** 执行 CASE 表达式且所有 WHEN 条件为 false
- **WHEN** 存在 ELSE 子句
- **THEN** 返回 ELSE 值

#### Scenario: CASE 无匹配无 ELSE
- **WHEN** 执行 CASE 表达式且所有 WHEN 条件为 false
- **WHEN** 不存在 ELSE 子句
- **THEN** 返回 null

### Requirement: 临时变量和作用域

系统 SHALL 支持 GML 的临时变量和作用域引用。

#### Scenario: $ 临时变量
- **WHEN** 定义 `$baseAmount = order.total`
- **THEN** 变量不出现在最终输出对象中
- **THEN** 可通过 `this.$baseAmount` 引用

#### Scenario: this 引用已定义字段
- **WHEN** 定义 `total = price * quantity`
- **WHEN** 后续定义 `discounted = this.total < 100`
- **THEN** 正确引用已计算的 total 值

### Requirement: 展开语法

系统 SHALL 支持对象展开语法。

#### Scenario: 展开所有字段
- **WHEN** 使用 `...user` 在对象构造中
- **THEN** user 的所有字段复制到目标对象

#### Scenario: 展开并裁剪
- **WHEN** 使用 `...user.proj('name, email')`
- **THEN** 仅复制 user 的 name 和 email 字段

#### Scenario: 展开后覆盖
- **WHEN** 使用 `...user` 后定义 `name = 'override'`
- **THEN** name 字段值为 'override'（覆盖展开值）

### Requirement: 空值安全

系统 SHALL 实现 GML 的空值安全处理。

#### Scenario: 对 null 调用方法
- **WHEN** 对 null 值调用原型方法
- **THEN** 返回 null（不抛出异常）

#### Scenario: 默认值运算符
- **WHEN** 执行 `user.name || 'unknown'`
- **WHEN** user.name 为 null
- **THEN** 返回 'unknown'
