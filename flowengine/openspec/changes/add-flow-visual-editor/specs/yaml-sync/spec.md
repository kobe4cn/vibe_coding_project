# YAML Sync 能力规格

## ADDED Requirements

### Requirement: 双向实时同步

系统 SHALL 实现 YAML 文本与可视化画布之间的实时双向同步。

#### Scenario: YAML 到可视化同步
- **GIVEN** 用户在 YAML 编辑器中修改了节点名称
- **WHEN** 编辑完成后等待 300ms（防抖）
- **THEN** 可视化画布中对应节点的标题自动更新
- **AND** 节点位置保持不变

#### Scenario: 可视化到 YAML 同步
- **GIVEN** 用户在可视化画布中拖动节点位置
- **WHEN** 拖动结束
- **THEN** YAML 文本中该节点的顺序可能调整（保持可读性）
- **AND** 节点内容不变

#### Scenario: 添加节点同步
- **GIVEN** 用户在可视化画布中拖拽创建新节点
- **WHEN** 节点创建完成
- **THEN** YAML 编辑器自动在 flow.node 块末尾添加新节点定义
- **AND** 新节点使用合理的默认值

#### Scenario: 删除节点同步
- **GIVEN** 用户在可视化画布中删除节点
- **WHEN** 删除确认后
- **THEN** YAML 编辑器自动移除对应节点定义
- **AND** 引用该节点的 next/then/else/fail 被清除

#### Scenario: 连接线同步
- **GIVEN** 用户在可视化画布中创建节点连接
- **WHEN** 连接建立
- **THEN** YAML 中源节点的 next 属性更新
- **AND** 若是条件分支，更新对应的 then/else

### Requirement: 同步冲突处理

系统 SHALL 处理同步过程中的冲突和错误。

#### Scenario: YAML 语法错误
- **GIVEN** 用户在 YAML 编辑器中输入了语法错误
- **WHEN** 尝试同步到可视化
- **THEN** 可视化画布保持上一有效状态
- **AND** YAML 编辑器中显示错误位置和信息
- **AND** 显示顶部警告条"YAML 语法错误，可视化未更新"

#### Scenario: 语义错误
- **GIVEN** YAML 语法正确但 FDL 语义错误（如节点 next 指向不存在的 ID）
- **WHEN** 尝试同步
- **THEN** 可视化画布尽可能渲染有效部分
- **AND** 错误的引用显示为断开的虚线
- **AND** 属性面板显示错误详情

#### Scenario: 并发编辑冲突
- **GIVEN** 用户同时在 YAML 编辑器和可视化画布中编辑
- **WHEN** 两边都有未同步的更改
- **THEN** 后发起的编辑操作覆盖先前的
- **AND** 被覆盖的操作可通过撤销恢复

### Requirement: 同步状态指示

系统 SHALL 提供同步状态的可视化反馈。

#### Scenario: 同步进行中
- **GIVEN** 用户进行了编辑操作
- **WHEN** 同步正在进行
- **THEN** 工具栏显示同步图标旋转动画
- **AND** 状态文字显示"正在同步..."

#### Scenario: 同步完成
- **GIVEN** 同步操作完成
- **WHEN** 无错误发生
- **THEN** 同步图标显示为绿色对勾
- **AND** 状态文字显示"已同步"并在 2 秒后淡出

#### Scenario: 同步失败
- **GIVEN** 同步操作失败
- **WHEN** 发生错误
- **THEN** 同步图标显示为红色感叹号
- **AND** 状态文字显示"同步失败"
- **AND** 点击可查看详细错误信息

### Requirement: 手动同步控制

系统 SHALL 提供手动控制同步的选项。

#### Scenario: 暂停同步
- **GIVEN** 用户需要进行大量编辑
- **WHEN** 点击"暂停同步"按钮
- **THEN** 实时同步暂停
- **AND** 编辑不会立即反映到另一视图
- **AND** 按钮变为"恢复同步"

#### Scenario: 强制同步
- **GIVEN** 同步处于暂停状态或存在未同步更改
- **WHEN** 用户点击"立即同步"按钮
- **THEN** 立即执行同步操作
- **AND** 忽略防抖延迟

#### Scenario: 重置到 YAML
- **GIVEN** 可视化和 YAML 存在差异
- **WHEN** 用户选择"以 YAML 为准重置"
- **THEN** 可视化画布完全根据当前 YAML 重新渲染
- **AND** 放弃所有仅在可视化中的更改

#### Scenario: 重置到可视化
- **GIVEN** 可视化和 YAML 存在差异
- **WHEN** 用户选择"以可视化为准重置"
- **THEN** YAML 完全根据当前可视化状态重新生成
- **AND** 放弃所有仅在 YAML 中的更改

### Requirement: 视图切换

系统 SHALL 支持 YAML 编辑器和可视化画布的视图切换。

#### Scenario: 双栏视图
- **GIVEN** 默认布局
- **WHEN** 两个视图都可见
- **THEN** 左侧显示可视化画布
- **AND** 右侧显示 YAML 编辑器
- **AND** 可拖动分隔条调整比例

#### Scenario: 仅可视化视图
- **GIVEN** 用户点击"仅画布"视图模式
- **WHEN** 切换完成
- **THEN** 可视化画布占据全部宽度
- **AND** YAML 编辑器隐藏但保持同步

#### Scenario: 仅 YAML 视图
- **GIVEN** 用户点击"仅代码"视图模式
- **WHEN** 切换完成
- **THEN** YAML 编辑器占据全部宽度
- **AND** 可视化画布隐藏但保持同步

### Requirement: 位置同步

系统 SHALL 支持编辑焦点的位置同步。

#### Scenario: YAML 到可视化焦点同步
- **GIVEN** 用户在 YAML 编辑器中光标位于某节点定义内
- **WHEN** 按下 Ctrl+Shift+L 或点击"定位到画布"
- **THEN** 可视化画布将对应节点居中显示
- **AND** 该节点被选中

#### Scenario: 可视化到 YAML 焦点同步
- **GIVEN** 用户在可视化画布中选中某节点
- **WHEN** 按下 Ctrl+Shift+Y 或点击"定位到代码"
- **THEN** YAML 编辑器滚动到该节点定义位置
- **AND** 光标定位到节点 ID 行
