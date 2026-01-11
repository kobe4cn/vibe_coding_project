# 自定义节点开发框架规范

## ADDED Requirements

### Requirement: 插件系统基础架构

系统 SHALL 提供完整的插件系统支持自定义节点开发。

#### Scenario: 插件发现
- **WHEN** 系统启动时
- **THEN** 扫描配置的插件目录
- **THEN** 读取每个插件的 manifest 文件
- **THEN** 验证插件签名和版本兼容性

#### Scenario: 插件加载
- **WHEN** 发现有效插件
- **THEN** 加载插件的运行时代码
- **THEN** 初始化插件沙箱环境
- **THEN** 注册插件提供的节点类型

#### Scenario: 插件热加载
- **WHEN** 插件文件发生变更
- **WHEN** 系统配置启用热加载
- **THEN** 自动重新加载插件
- **THEN** 不影响正在执行的流程
- **THEN** 新执行使用更新后的插件

#### Scenario: 插件禁用
- **WHEN** 管理员禁用某个插件
- **THEN** 插件提供的节点类型不再可用
- **THEN** 已有流程中使用该节点的显示警告
- **THEN** 执行时跳过或报错（可配置）

### Requirement: 自定义节点定义

系统 SHALL 支持通过清单文件定义自定义节点。

#### Scenario: 节点清单解析
- **WHEN** 加载插件时
- **THEN** 解析 node-manifest.yaml 文件
- **THEN** 验证节点 ID 唯一性
- **THEN** 验证配置 schema 合法性

#### Scenario: 节点配置 Schema
- **WHEN** 节点定义了配置 schema
- **THEN** 前端根据 schema 生成配置表单
- **THEN** 保存时验证配置符合 schema
- **THEN** 不合法的配置阻止保存

#### Scenario: 节点输入输出端口
- **WHEN** 节点定义了 inputs 和 outputs
- **THEN** 画布上显示对应的连接点
- **THEN** 连接时验证类型兼容性
- **THEN** 类型不兼容时显示警告

#### Scenario: 节点分类
- **WHEN** 节点定义了 category
- **THEN** 节点面板中按分类显示
- **THEN** 支持搜索节点名称和关键词

### Requirement: 节点运行时执行

系统 SHALL 支持多种运行时环境执行自定义节点。

#### Scenario: WASM 运行时执行
- **WHEN** 节点配置为 wasm 运行时
- **THEN** 加载 WASM 模块到沙箱
- **THEN** 执行节点时调用 WASM 导出函数
- **THEN** 沙箱限制内存和 CPU 使用

#### Scenario: Deno 运行时执行
- **WHEN** 节点配置为 deno 运行时
- **THEN** 在 Deno 隔离环境中执行 TypeScript/JavaScript
- **THEN** 根据 permissions 配置授权
- **THEN** 支持异步操作和 Promise

#### Scenario: Native 运行时执行
- **WHEN** 节点配置为 native 运行时
- **THEN** 直接调用 Rust 编写的节点实现
- **THEN** 无沙箱限制，完全访问系统资源
- **THEN** 仅限受信任的内部插件使用

#### Scenario: 执行超时控制
- **WHEN** 节点执行超过配置的超时时间
- **THEN** 强制终止执行
- **THEN** 返回超时错误
- **THEN** 释放占用的资源

### Requirement: 插件权限管理

系统 SHALL 实现细粒度的插件权限控制。

#### Scenario: 网络访问权限
- **WHEN** 插件声明 net:fetch 权限
- **THEN** 允许插件发起 HTTP 请求
- **WHEN** 未声明网络权限
- **THEN** 网络请求被沙箱阻止

#### Scenario: 文件系统权限
- **WHEN** 插件声明 fs:read 权限
- **THEN** 允许读取指定目录的文件
- **WHEN** 未声明文件权限
- **THEN** 文件操作被沙箱阻止

#### Scenario: 环境变量权限
- **WHEN** 插件声明 env:read 权限
- **THEN** 允许读取指定的环境变量
- **WHEN** 未声明环境变量权限
- **THEN** 环境变量访问被阻止

#### Scenario: 权限审计
- **WHEN** 插件请求任何受限资源
- **THEN** 记录访问日志
- **THEN** 支持按插件查询权限使用情况

### Requirement: 前端节点 UI 扩展

系统 SHALL 支持自定义节点的前端 UI 扩展。

#### Scenario: 自定义节点渲染
- **WHEN** 画布上显示自定义节点
- **THEN** 使用插件提供的 NodeComponent 渲染
- **THEN** 支持自定义图标、颜色、形状

#### Scenario: 自定义属性面板
- **WHEN** 选中自定义节点
- **THEN** 使用插件提供的 PropertiesPanel 渲染
- **THEN** 支持复杂的交互式配置界面

#### Scenario: 节点主题配置
- **WHEN** 插件定义了 theme 配置
- **THEN** 节点使用自定义的颜色方案
- **THEN** 与系统主题保持协调

#### Scenario: 节点搜索支持
- **WHEN** 用户在节点面板搜索
- **THEN** 匹配插件定义的 searchKeywords
- **THEN** 显示匹配的自定义节点

### Requirement: 插件分发和安装

系统 SHALL 支持插件的分发和安装。

#### Scenario: 本地安装
- **WHEN** 管理员上传插件包
- **THEN** 验证插件包完整性
- **THEN** 解压到插件目录
- **THEN** 触发插件加载

#### Scenario: 远程仓库安装
- **WHEN** 管理员从仓库安装插件
- **THEN** 从配置的仓库下载插件包
- **THEN** 验证签名和版本
- **THEN** 自动安装依赖插件

#### Scenario: 插件更新
- **WHEN** 检测到插件有新版本
- **THEN** 通知管理员
- **WHEN** 管理员确认更新
- **THEN** 下载新版本并替换
- **THEN** 保留插件配置数据

#### Scenario: 插件卸载
- **WHEN** 管理员卸载插件
- **THEN** 检查是否有流程使用该插件的节点
- **THEN** 显示影响范围
- **WHEN** 确认卸载
- **THEN** 移除插件文件和注册信息

### Requirement: 插件开发工具

系统 SHALL 提供插件开发支持工具。

#### Scenario: 插件脚手架
- **WHEN** 开发者执行 create-plugin 命令
- **THEN** 生成插件项目模板
- **THEN** 包含示例节点实现
- **THEN** 包含构建和测试配置

#### Scenario: 本地调试
- **WHEN** 开发者启动调试模式
- **THEN** 自动加载开发中的插件
- **THEN** 支持断点和日志
- **THEN** 代码修改后自动重载

#### Scenario: 插件打包
- **WHEN** 开发者执行 build 命令
- **THEN** 编译插件代码
- **THEN** 生成插件包（含签名）
- **THEN** 验证插件包可正常加载

#### Scenario: 插件测试
- **WHEN** 开发者执行测试命令
- **THEN** 运行单元测试
- **THEN** 运行集成测试（模拟执行环境）
- **THEN** 生成测试报告

### Requirement: 插件安全审计

系统 SHALL 实现插件安全审计机制。

#### Scenario: 代码扫描
- **WHEN** 安装插件时
- **THEN** 扫描插件代码是否包含恶意模式
- **THEN** 检测危险 API 调用
- **THEN** 高风险插件需要管理员确认

#### Scenario: 签名验证
- **WHEN** 加载插件时
- **THEN** 验证插件签名有效性
- **THEN** 验证签名者身份
- **THEN** 无效签名的插件拒绝加载（可配置）

#### Scenario: 运行时监控
- **WHEN** 插件运行时
- **THEN** 监控资源使用情况
- **THEN** 检测异常行为模式
- **THEN** 超限时自动熔断

#### Scenario: 安全报告
- **WHEN** 管理员查看插件安全报告
- **THEN** 显示权限使用统计
- **THEN** 显示资源消耗趋势
- **THEN** 显示安全告警记录
