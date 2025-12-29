# A2UI Tag Management

## ADDED Requirements

### Requirement: 标签管理页面
系统 SHALL 提供标签管理页面，展示预定义标签和自定义标签，并支持创建和删除操作。

#### Scenario: 页面展示
- **WHEN** 用户访问标签管理页面
- **THEN** 显示「预定义标签」区域
- **AND** 显示「自定义标签」区域
- **AND** 显示「新建标签」按钮

#### Scenario: 预定义标签展示
- **WHEN** 渲染预定义标签
- **THEN** 以徽章形式展示所有预定义标签
- **AND** 预定义标签不可删除

#### Scenario: 自定义标签展示
- **WHEN** 渲染自定义标签
- **THEN** 以列表形式展示所有自定义标签
- **AND** 每个标签显示删除按钮

#### Scenario: 空自定义标签
- **WHEN** 没有自定义标签
- **THEN** 显示「暂无自定义标签」提示

### Requirement: 标签创建功能
系统 SHALL 提供标签创建表单，支持设置名称和颜色。

#### Scenario: 显示创建表单
- **WHEN** 用户点击「新建标签」按钮
- **THEN** 显示创建表单
- **AND** 表单包含名称输入框和颜色选择器

#### Scenario: 创建提交
- **WHEN** 用户填写名称并点击创建按钮
- **THEN** 触发 create_tag action
- **AND** Agent Server 调用后端 API 创建标签
- **AND** 创建成功后刷新标签列表

#### Scenario: 取消创建
- **WHEN** 用户点击取消按钮
- **THEN** 隐藏创建表单
- **AND** 清空表单数据

### Requirement: 标签删除功能
系统 SHALL 支持删除自定义标签。

#### Scenario: 删除确认
- **WHEN** 用户点击标签的删除按钮
- **THEN** 显示确认提示
- **AND** 用户确认后触发 delete_tag action

#### Scenario: 删除成功
- **WHEN** 标签删除成功
- **THEN** 从列表中移除该标签
- **AND** 显示成功提示

### Requirement: 标签徽章组件
系统 SHALL 提供标签徽章组件，使用标签的自定义颜色显示。

#### Scenario: 徽章渲染
- **WHEN** 渲染标签徽章
- **THEN** 使用标签的 color 属性作为背景色
- **AND** 显示标签名称
- **AND** 如果有图标则显示图标

#### Scenario: 颜色对比度
- **WHEN** 标签背景色较浅
- **THEN** 使用深色文字
- **WHEN** 标签背景色较深
- **THEN** 使用浅色文字
