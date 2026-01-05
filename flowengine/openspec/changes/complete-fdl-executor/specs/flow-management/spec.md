# Flow Management Capability - Spec

## ADDED Requirements

### Requirement: 流程注册表

系统 SHALL 提供统一的流程注册表，使用稳定的 UUID 标识每个流程。

#### Scenario: 创建新流程
- **GIVEN** 用户点击"新建流程"按钮
- **AND** 输入流程名称和描述
- **WHEN** 用户确认创建
- **THEN** 生成新的 UUID 作为 flowId
- **AND** 创建流程注册项
- **AND** 跳转到流程编辑页面

#### Scenario: 流程重命名不影响 ID
- **GIVEN** 已存在流程 "订单处理" (id: abc-123)
- **WHEN** 用户将流程重命名为 "订单管理"
- **THEN** flowId 保持 abc-123 不变
- **AND** 版本历史保持关联

#### Scenario: 流程元数据更新
- **GIVEN** 已存在的流程
- **WHEN** 用户修改描述或标签
- **THEN** 更新 updatedAt 时间戳
- **AND** 不创建新版本

### Requirement: 流程列表页面

系统 SHALL 提供流程列表页面，展示所有已创建的流程。

#### Scenario: 查看流程列表
- **GIVEN** 用户已创建 5 个流程
- **WHEN** 用户访问流程列表页面
- **THEN** 以卡片形式展示所有流程
- **AND** 显示流程名称、描述、版本数、最后修改时间
- **AND** 按最后修改时间倒序排列

#### Scenario: 搜索流程
- **GIVEN** 流程列表包含"订单处理"、"用户注册"、"库存管理"
- **WHEN** 用户在搜索框输入"订单"
- **THEN** 只显示匹配的流程"订单处理"
- **AND** 搜索支持名称和描述匹配

#### Scenario: 筛选流程
- **GIVEN** 流程带有标签 "production"、"development"
- **WHEN** 用户选择筛选标签 "production"
- **THEN** 只显示带有该标签的流程

#### Scenario: 空状态显示
- **GIVEN** 用户没有创建任何流程
- **WHEN** 访问流程列表页面
- **THEN** 显示引导创建流程的空状态
- **AND** 提供"创建第一个流程"按钮

### Requirement: 流程 CRUD 操作

系统 SHALL 支持流程的创建、读取、更新、删除操作。

#### Scenario: 复制流程
- **GIVEN** 已存在流程 "订单处理"
- **WHEN** 用户点击"复制"操作
- **THEN** 创建新流程 "订单处理 (副本)"
- **AND** 复制最新版本的流程内容
- **AND** 生成新的 flowId

#### Scenario: 删除流程
- **GIVEN** 已存在流程 "测试流程"
- **WHEN** 用户点击"删除"操作
- **AND** 确认删除
- **THEN** 删除流程及其所有版本
- **AND** 从列表中移除

#### Scenario: 删除确认
- **GIVEN** 用户点击删除流程
- **WHEN** 流程有 3 个版本
- **THEN** 显示确认对话框
- **AND** 提示将删除流程及 3 个版本

### Requirement: 流程版本管理

系统 SHALL 为每个流程维护独立的版本历史。

#### Scenario: 保存新版本
- **GIVEN** 用户编辑流程并点击保存
- **WHEN** 流程内容与最新版本不同
- **THEN** 创建新的版本记录
- **AND** 版本号递增
- **AND** 更新流程的 latestVersion

#### Scenario: 自动保存版本
- **GIVEN** 用户编辑流程超过 30 秒未保存
- **WHEN** 触发自动保存
- **THEN** 保存为自动保存版本
- **AND** 标记 isAutoSave: true

#### Scenario: 查看版本历史
- **GIVEN** 流程有 5 个版本
- **WHEN** 用户打开版本面板
- **THEN** 按时间倒序显示所有版本
- **AND** 标识当前版本和自动保存版本

#### Scenario: 恢复历史版本
- **GIVEN** 流程当前为版本 5
- **AND** 用户选择恢复版本 3
- **WHEN** 用户确认恢复
- **THEN** 创建版本 6，内容与版本 3 相同
- **AND** 保留版本 3、4、5 的历史

#### Scenario: 查看历史版本（只读）
- **GIVEN** 流程当前为版本 5
- **WHEN** 用户点击查看版本 3
- **THEN** 以只读模式显示版本 3 的内容
- **AND** 显示"只读模式"提示
- **AND** 提供"恢复此版本"按钮

### Requirement: 存储抽象层

系统 SHALL 提供统一的存储接口，支持多种存储后端。

#### Scenario: 本地存储模式
- **GIVEN** 用户未配置后端服务
- **WHEN** 用户操作流程
- **THEN** 数据存储在浏览器 IndexedDB
- **AND** 功能完全可用

#### Scenario: 后端存储模式
- **GIVEN** 用户已配置后端服务地址
- **AND** 连接正常
- **WHEN** 用户操作流程
- **THEN** 数据通过 API 存储到后端
- **AND** 支持跨设备访问

#### Scenario: 存储模式切换
- **GIVEN** 用户当前使用本地存储
- **WHEN** 用户配置后端服务并切换
- **THEN** 提示可选迁移本地数据
- **AND** 后续操作使用后端存储

#### Scenario: 离线回退
- **GIVEN** 用户使用后端存储模式
- **WHEN** 网络断开
- **THEN** 显示离线提示
- **AND** 允许切换到本地模式继续工作

### Requirement: 数据迁移

系统 SHALL 支持从旧版本数据格式迁移到新格式。

#### Scenario: 检测旧版数据
- **GIVEN** 浏览器存在旧版 flow-versions-db 数据
- **WHEN** 应用启动
- **THEN** 检测到需要迁移的数据
- **AND** 显示迁移提示对话框

#### Scenario: 执行数据迁移
- **GIVEN** 用户确认执行迁移
- **AND** 存在 10 个旧版本记录
- **WHEN** 执行迁移
- **THEN** 为每个唯一流程创建 FlowEntry
- **AND** 迁移所有版本到新格式
- **AND** 显示迁移进度

#### Scenario: 迁移完成
- **GIVEN** 迁移成功完成
- **WHEN** 显示结果
- **THEN** 显示迁移统计（流程数、版本数）
- **AND** 提供清理旧数据选项

#### Scenario: 迁移失败回滚
- **GIVEN** 迁移过程中发生错误
- **WHEN** 迁移失败
- **THEN** 回滚已迁移的数据
- **AND** 保留原始数据不变
- **AND** 显示错误详情

### Requirement: 路由结构

系统 SHALL 使用路由区分流程列表和流程编辑页面。

#### Scenario: 访问流程列表
- **GIVEN** 用户访问应用根路径
- **WHEN** 路由为 `/` 或 `/flows`
- **THEN** 显示流程列表页面

#### Scenario: 访问流程编辑器
- **GIVEN** 用户点击流程卡片的"编辑"
- **WHEN** 路由变为 `/flows/{flowId}`
- **THEN** 加载对应流程数据
- **AND** 显示流程编辑器

#### Scenario: 查看历史版本
- **GIVEN** 用户选择查看历史版本
- **WHEN** 路由变为 `/flows/{flowId}/versions/{versionId}`
- **THEN** 以只读模式显示该版本
- **AND** URL 可分享和收藏

#### Scenario: 创建新流程
- **GIVEN** 用户点击"新建流程"
- **WHEN** 创建成功
- **THEN** 路由跳转到 `/flows/{newFlowId}`
- **AND** 进入编辑模式

#### Scenario: 无效路由处理
- **GIVEN** 用户访问不存在的流程 ID
- **WHEN** 路由为 `/flows/invalid-id`
- **THEN** 显示 404 页面
- **AND** 提供返回列表的链接

### Requirement: 导入导出

系统 SHALL 支持流程的导入和导出功能。

#### Scenario: 导出单个流程
- **GIVEN** 用户选择导出流程 "订单处理"
- **WHEN** 点击导出按钮
- **THEN** 下载包含流程数据的 JSON 文件
- **AND** 文件名为 "订单处理.flow.json"
- **AND** 包含元数据和所有版本

#### Scenario: 导出多个流程
- **GIVEN** 用户选中 3 个流程
- **WHEN** 点击批量导出
- **THEN** 下载 ZIP 文件
- **AND** 包含 3 个流程的 JSON 文件

#### Scenario: 导入流程
- **GIVEN** 用户选择导入 .flow.json 文件
- **WHEN** 文件格式有效
- **THEN** 创建新流程
- **AND** 导入所有版本历史
- **AND** 生成新的 flowId

#### Scenario: 导入冲突处理
- **GIVEN** 导入的流程名称与现有流程相同
- **WHEN** 检测到冲突
- **THEN** 提供选项：重命名、覆盖、跳过
- **AND** 用户选择后继续导入

### Requirement: 后端 API

系统 SHALL 提供 RESTful API 支持流程管理。

#### Scenario: 获取流程列表
- **GIVEN** GET 请求到 `/api/v1/flows`
- **AND** 请求包含有效 JWT Token
- **WHEN** 服务处理请求
- **THEN** 返回当前租户的流程列表
- **AND** 支持分页、搜索、排序参数

#### Scenario: 创建流程
- **GIVEN** POST 请求到 `/api/v1/flows`
- **AND** 请求体包含 name 和 description
- **WHEN** 服务处理请求
- **THEN** 创建新流程
- **AND** 返回完整的流程数据

#### Scenario: 更新流程
- **GIVEN** PUT 请求到 `/api/v1/flows/{flowId}`
- **AND** 请求体包含更新的字段
- **WHEN** 服务处理请求
- **THEN** 更新流程元数据
- **AND** 返回更新后的数据

#### Scenario: 删除流程
- **GIVEN** DELETE 请求到 `/api/v1/flows/{flowId}`
- **WHEN** 服务处理请求
- **THEN** 删除流程及其所有版本
- **AND** 返回 204 No Content

#### Scenario: 获取流程版本列表
- **GIVEN** GET 请求到 `/api/v1/flows/{flowId}/versions`
- **WHEN** 服务处理请求
- **THEN** 返回该流程的所有版本
- **AND** 按版本号倒序排列

#### Scenario: 保存新版本
- **GIVEN** POST 请求到 `/api/v1/flows/{flowId}/versions`
- **AND** 请求体包含完整流程数据
- **WHEN** 服务处理请求
- **THEN** 创建新版本
- **AND** 更新流程的 latestVersion
- **AND** 返回版本数据

#### Scenario: 获取特定版本
- **GIVEN** GET 请求到 `/api/v1/flows/{flowId}/versions/{versionId}`
- **WHEN** 服务处理请求
- **THEN** 返回该版本的完整数据
- **AND** 包含流程定义
