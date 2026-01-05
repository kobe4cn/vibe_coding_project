# Flow Versioning 能力规格

## ADDED Requirements

### Requirement: 版本自动保存

系统 SHALL 自动保存流程编辑的版本快照。

#### Scenario: 编辑后自动保存
- **GIVEN** 用户正在编辑流程
- **WHEN** 用户停止编辑超过 5 秒（防抖）
- **THEN** 系统自动创建一个版本快照
- **AND** 版本标记为"自动保存"类型
- **AND** 不中断用户的编辑操作

#### Scenario: 首次打开自动保存
- **GIVEN** 用户导入或创建一个新流程
- **WHEN** 流程首次加载完成
- **THEN** 系统自动创建初始版本快照
- **AND** 版本描述为"初始版本"

#### Scenario: 无变更不保存
- **GIVEN** 用户打开流程但未做任何修改
- **WHEN** 等待超过 5 秒
- **THEN** 不创建新的版本快照

### Requirement: 版本手动保存

系统 SHALL 支持用户手动保存带描述的版本。

#### Scenario: 手动保存版本
- **GIVEN** 用户点击"保存版本"按钮
- **WHEN** 弹出保存对话框
- **THEN** 用户可以输入版本描述
- **AND** 确认后创建新版本
- **AND** 版本标记为"手动保存"类型

#### Scenario: 快捷键保存
- **GIVEN** 用户按下 Ctrl+S
- **WHEN** 流程有未保存的更改
- **THEN** 弹出保存版本对话框

### Requirement: 版本历史列表

系统 SHALL 显示流程的版本历史列表。

#### Scenario: 显示版本列表
- **GIVEN** 用户点击"版本历史"按钮
- **WHEN** 版本历史面板打开
- **THEN** 显示按时间倒序排列的版本列表
- **AND** 每个版本显示：版本号、创建时间、描述、保存类型

#### Scenario: 版本数量显示
- **GIVEN** 流程有 25 个历史版本
- **WHEN** 打开版本历史
- **THEN** 显示版本总数"共 25 个版本"
- **AND** 支持滚动加载更多版本

#### Scenario: 版本搜索
- **GIVEN** 版本历史面板打开
- **WHEN** 用户在搜索框输入关键字
- **THEN** 过滤显示描述中包含关键字的版本

### Requirement: 版本对比

系统 SHALL 支持对比两个版本之间的差异。

#### Scenario: 与当前版本对比
- **GIVEN** 版本历史列表中选中一个历史版本
- **WHEN** 点击"与当前对比"按钮
- **THEN** 打开 Diff 视图
- **AND** 左侧显示历史版本 YAML
- **AND** 右侧显示当前版本 YAML
- **AND** 差异部分高亮显示

#### Scenario: 两个历史版本对比
- **GIVEN** 版本历史列表
- **WHEN** 用户选中两个历史版本
- **AND** 点击"对比选中版本"
- **THEN** 打开 Diff 视图显示两个版本的差异

#### Scenario: Diff 视图操作
- **GIVEN** Diff 视图打开
- **THEN** 支持以下操作：
  - 切换并排/内联显示模式
  - 展开/折叠未更改区域
  - 跳转到下一个/上一个差异

### Requirement: 版本回滚

系统 SHALL 支持将流程回滚到指定历史版本。

#### Scenario: 回滚到历史版本
- **GIVEN** 用户在版本历史中选中一个版本
- **WHEN** 点击"回滚到此版本"
- **THEN** 显示确认对话框"确定回滚到版本 X？当前未保存的更改将丢失。"
- **AND** 确认后，流程恢复到该版本状态
- **AND** 自动创建一个新版本，描述为"回滚自版本 X"

#### Scenario: 回滚后编辑
- **GIVEN** 用户刚回滚到历史版本
- **WHEN** 继续编辑流程
- **THEN** 新的编辑基于回滚后的版本
- **AND** 原有的后续版本保留在历史中

### Requirement: 版本导出

系统 SHALL 支持导出指定版本的 YAML 文件。

#### Scenario: 导出单个版本
- **GIVEN** 版本历史中选中一个版本
- **WHEN** 点击"导出"按钮
- **THEN** 下载该版本的 YAML 文件
- **AND** 文件名格式为 `{流程名}-v{版本号}.yaml`

#### Scenario: 导出当前版本
- **GIVEN** 用户在主界面
- **WHEN** 点击"导出"按钮
- **THEN** 下载当前编辑状态的 YAML 文件

### Requirement: 版本存储管理

系统 SHALL 管理版本存储空间。

#### Scenario: 版本数量限制
- **GIVEN** 流程已有 100 个版本
- **WHEN** 创建第 101 个版本
- **THEN** 自动删除最旧的版本
- **AND** 保持版本数量不超过 100

#### Scenario: 存储空间限制
- **GIVEN** 版本存储使用量接近 50MB 上限
- **WHEN** 尝试保存新版本
- **THEN** 先删除最旧的版本释放空间
- **AND** 然后保存新版本

#### Scenario: 存储空间不足警告
- **GIVEN** 版本存储使用量超过 40MB
- **WHEN** 用户打开版本历史
- **THEN** 显示存储空间使用提示
- **AND** 提供"清理旧版本"选项

### Requirement: 存储降级方案

系统 SHALL 在 IndexedDB 不可用时提供降级存储。

#### Scenario: IndexedDB 不可用
- **GIVEN** 浏览器处于隐私模式或不支持 IndexedDB
- **WHEN** 应用初始化
- **THEN** 检测到 IndexedDB 不可用
- **AND** 自动切换到 LocalStorage 存储
- **AND** 显示提示"版本历史功能受限，建议使用标准浏览模式"

#### Scenario: LocalStorage 容量限制
- **GIVEN** 使用 LocalStorage 降级存储
- **THEN** 版本数量限制降为 10 个
- **AND** 仅保存手动保存的版本

### Requirement: 版本预览

系统 SHALL 支持预览历史版本的内容。

#### Scenario: 快速预览
- **GIVEN** 版本历史列表
- **WHEN** 鼠标悬浮在某版本上超过 500ms
- **THEN** 显示该版本的预览缩略图
- **AND** 包含流程名称和节点数量

#### Scenario: 详细预览
- **GIVEN** 版本历史列表
- **WHEN** 点击某版本的"预览"按钮
- **THEN** 在只读模式下显示该版本的完整流程图
- **AND** 显示该版本的 YAML 内容
