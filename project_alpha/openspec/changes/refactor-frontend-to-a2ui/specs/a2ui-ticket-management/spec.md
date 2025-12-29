# A2UI Ticket Management

## ADDED Requirements

### Requirement: 票据列表页面
系统 SHALL 提供票据列表页面，支持搜索、筛选、分页功能。

#### Scenario: 列表展示
- **WHEN** 用户访问票据列表页面
- **THEN** 显示票据卡片列表
- **AND** 每个卡片展示标题、状态徽章、优先级徽章、标签
- **AND** 显示分页控件

#### Scenario: 搜索票据
- **WHEN** 用户在搜索框输入关键词并提交
- **THEN** 触发 search_tickets action
- **AND** Agent Server 调用后端 API 进行搜索
- **AND** 更新列表显示匹配的票据

#### Scenario: 状态筛选
- **WHEN** 用户选择状态筛选器
- **THEN** 触发 filter_status action
- **AND** 列表只显示指定状态的票据

#### Scenario: 优先级筛选
- **WHEN** 用户选择优先级筛选器
- **THEN** 触发 filter_priority action
- **AND** 列表只显示指定优先级的票据

#### Scenario: 分页导航
- **WHEN** 用户点击分页按钮
- **THEN** 触发 paginate action
- **AND** 加载并显示指定页的票据

#### Scenario: 空状态
- **WHEN** 票据列表为空
- **THEN** 显示空状态提示
- **AND** 提供创建票据的快捷入口

### Requirement: 票据详情页面
系统 SHALL 提供票据详情页面，展示完整信息并支持状态操作。

#### Scenario: 详情展示
- **WHEN** 用户点击票据卡片或访问详情 URL
- **THEN** 触发 view_ticket action
- **AND** 显示票据的完整信息（标题、描述、状态、优先级、标签、时间信息）

#### Scenario: 附件展示
- **WHEN** 票据有附件
- **THEN** 显示附件列表（文件名、大小）
- **AND** 提供下载链接

#### Scenario: 变更历史
- **WHEN** 显示票据详情
- **THEN** 展示变更历史记录
- **AND** 每条记录显示变更类型、旧值、新值、时间

#### Scenario: 状态切换
- **WHEN** 用户点击允许的状态切换按钮
- **THEN** 触发 change_status action
- **AND** 更新票据状态并刷新页面

#### Scenario: 完成状态需要处理结果
- **WHEN** 用户将状态切换为「已完成」
- **THEN** 弹出对话框要求输入处理结果
- **AND** 用户确认后提交状态变更

#### Scenario: 删除票据
- **WHEN** 用户点击删除按钮
- **THEN** 显示确认对话框
- **AND** 用户确认后触发 delete_ticket action
- **AND** 删除成功后跳转到列表页面

### Requirement: 票据创建页面
系统 SHALL 提供票据创建表单，支持设置标题、描述和优先级。

#### Scenario: 表单展示
- **WHEN** 用户访问创建页面
- **THEN** 显示表单（标题输入框、描述文本域、优先级选择器）
- **AND** 标题为必填项

#### Scenario: 创建提交
- **WHEN** 用户填写表单并点击创建按钮
- **THEN** 触发 create_ticket action
- **AND** Agent Server 调用后端 API 创建票据
- **AND** 创建成功后跳转到票据详情页面

#### Scenario: 表单验证
- **WHEN** 用户未填写必填项
- **THEN** 创建按钮保持禁用状态
- **AND** 显示验证提示

### Requirement: 票据编辑页面
系统 SHALL 提供票据编辑表单，支持修改标题、描述、优先级和状态。

#### Scenario: 表单预填
- **WHEN** 用户访问编辑页面
- **THEN** 表单预填当前票据的值

#### Scenario: 编辑提交
- **WHEN** 用户修改表单并点击保存按钮
- **THEN** 触发 update_ticket action
- **AND** Agent Server 调用后端 API 更新票据
- **AND** 更新成功后跳转到票据详情页面

### Requirement: 状态徽章组件
系统 SHALL 提供状态徽章组件，使用不同颜色区分状态。

#### Scenario: 状态颜色映射
- **WHEN** 渲染状态徽章
- **THEN** 待处理(open) 显示蓝色背景
- **AND** 处理中(in_progress) 显示黄色背景
- **AND** 已完成(completed) 显示绿色背景
- **AND** 已取消(cancelled) 显示灰色背景

### Requirement: 优先级徽章组件
系统 SHALL 提供优先级徽章组件，使用不同颜色区分优先级。

#### Scenario: 优先级颜色映射
- **WHEN** 渲染优先级徽章
- **THEN** 低(low) 显示灰色
- **AND** 中(medium) 显示蓝色
- **AND** 高(high) 显示橙色
- **AND** 紧急(urgent) 显示红色
