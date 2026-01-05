# Flow Canvas 能力规格

## ADDED Requirements

### Requirement: 流程画布渲染

系统 SHALL 提供基于 React Flow 的可视化流程画布，支持节点和连接线的渲染展示。

#### Scenario: 空白画布初始化
- **GIVEN** 用户打开流程编辑器
- **WHEN** 没有加载任何流程数据
- **THEN** 显示带有网格背景的空白画布
- **AND** 画布中心显示"拖拽节点到此处开始创建流程"提示

#### Scenario: 流程数据渲染
- **GIVEN** 存在一个包含 3 个节点的 FDL 流程定义
- **WHEN** 流程数据加载到画布
- **THEN** 所有节点按照其类型正确渲染
- **AND** 节点间的连接线根据 next/then/else/fail 关系正确绘制

#### Scenario: 大规模流程渲染
- **GIVEN** 一个包含 100+ 节点的复杂流程
- **WHEN** 流程加载到画布
- **THEN** 画布 SHALL 在 2 秒内完成首次渲染
- **AND** 交互操作（拖拽、缩放）保持流畅（>30fps）

### Requirement: 画布交互操作

系统 SHALL 支持标准的画布交互操作，包括平移、缩放和选择。

#### Scenario: 画布平移
- **GIVEN** 用户在画布空白区域
- **WHEN** 用户按住鼠标左键拖动
- **THEN** 画布视口随鼠标移动平移

#### Scenario: 画布缩放
- **GIVEN** 用户在画布上
- **WHEN** 用户滚动鼠标滚轮
- **THEN** 画布以鼠标位置为中心进行缩放
- **AND** 缩放范围限制在 25% - 200%

#### Scenario: 框选多个节点
- **GIVEN** 画布上有多个节点
- **WHEN** 用户按住 Shift 并拖动鼠标绘制选择框
- **THEN** 选择框内的所有节点被选中
- **AND** 选中节点显示高亮边框

### Requirement: 画布工具栏

系统 SHALL 提供画布工具栏，用于常用操作的快捷访问。

#### Scenario: 缩放控制
- **GIVEN** 画布工具栏可见
- **WHEN** 用户点击放大/缩小按钮
- **THEN** 画布按 10% 步进缩放

#### Scenario: 适应视口
- **GIVEN** 画布上有节点
- **WHEN** 用户点击"适应视口"按钮
- **THEN** 画布自动缩放和平移，使所有节点在视口中可见
- **AND** 节点周围保留适当边距

#### Scenario: 网格显示切换
- **GIVEN** 画布显示网格背景
- **WHEN** 用户点击"切换网格"按钮
- **THEN** 网格背景隐藏/显示切换

### Requirement: 画布小地图

系统 SHALL 提供画布小地图，用于大型流程的导航。

#### Scenario: 小地图显示
- **GIVEN** 画布右下角区域
- **WHEN** 流程节点数量超过 10 个
- **THEN** 显示可交互的小地图
- **AND** 小地图显示所有节点的缩略位置

#### Scenario: 小地图导航
- **GIVEN** 小地图可见
- **WHEN** 用户在小地图上点击某位置
- **THEN** 主画布视口移动到对应位置

### Requirement: 自动布局

系统 SHALL 提供自动布局功能，优化节点排列。

#### Scenario: 水平布局
- **GIVEN** 画布上有未布局的节点
- **WHEN** 用户点击"自动布局"按钮
- **THEN** 节点按照流程执行顺序从上到下排列
- **AND** 同层级节点水平对齐
- **AND** 连接线无交叉或交叉最少

#### Scenario: 保持子流程边界
- **GIVEN** 流程包含 each/loop 子流程
- **WHEN** 执行自动布局
- **THEN** 子流程内部节点保持在容器内
- **AND** 子流程容器大小自适应内部内容

### Requirement: 撤销重做

系统 SHALL 支持撤销和重做操作。

#### Scenario: 撤销节点创建
- **GIVEN** 用户刚创建了一个新节点
- **WHEN** 用户按 Ctrl+Z 或点击撤销按钮
- **THEN** 新创建的节点被移除
- **AND** 画布恢复到创建前的状态

#### Scenario: 重做撤销的操作
- **GIVEN** 用户刚执行了撤销操作
- **WHEN** 用户按 Ctrl+Shift+Z 或点击重做按钮
- **THEN** 撤销的操作被恢复

#### Scenario: 撤销历史限制
- **GIVEN** 撤销历史记录
- **THEN** 系统 SHALL 保留最近 50 次操作的历史
