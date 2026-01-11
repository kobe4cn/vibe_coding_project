# 图形化 GML 编辑器规范

## ADDED Requirements

### Requirement: 双模式编辑器

系统 SHALL 提供文本和可视化双模式的 GML 编辑器。

#### Scenario: 文本模式编辑
- **WHEN** 用户选择文本模式
- **THEN** 显示 Monaco 代码编辑器
- **THEN** 提供 GML 语法高亮
- **THEN** 提供自动补全和错误提示

#### Scenario: 可视化模式编辑
- **WHEN** 用户选择可视化模式
- **THEN** 显示块状拖拽编辑器
- **THEN** 显示块库面板
- **THEN** 支持拖拽组合表达式

#### Scenario: 模式切换
- **WHEN** 用户切换编辑模式
- **THEN** 内容实时同步到另一模式
- **THEN** 切换过程无数据丢失
- **THEN** 保持光标/选择位置（尽可能）

#### Scenario: 双模式并排显示
- **WHEN** 用户选择并排模式
- **THEN** 同时显示文本和可视化编辑器
- **THEN** 编辑任一侧实时同步到另一侧
- **THEN** 高亮显示当前编辑位置的对应元素

### Requirement: 文本编辑器增强

系统 SHALL 增强文本模式的 GML 编辑体验。

#### Scenario: 语法高亮
- **WHEN** 编辑 GML 表达式
- **THEN** 关键字（CASE/WHEN/THEN/ELSE/END）高亮
- **THEN** 字符串、数字、布尔值不同颜色
- **THEN** 变量引用和字段访问有区分

#### Scenario: 智能自动补全
- **WHEN** 用户输入变量名
- **THEN** 显示当前作用域内可用变量
- **WHEN** 用户输入点号 (.)
- **THEN** 根据前置对象类型显示可用方法和字段
- **THEN** 数组类型显示数组原型方法

#### Scenario: 内联错误提示
- **WHEN** GML 表达式存在语法错误
- **THEN** 错误位置显示红色波浪线
- **THEN** 鼠标悬停显示错误详情
- **THEN** 提供可能的修复建议

#### Scenario: 代码格式化
- **WHEN** 用户触发格式化命令
- **THEN** 自动调整缩进和空格
- **THEN** 长表达式适当换行
- **THEN** 保持语义不变

#### Scenario: 表达式预览
- **WHEN** 用户编辑表达式
- **THEN** 实时显示表达式求值结果（使用示例数据）
- **THEN** 错误时显示错误信息

### Requirement: 可视化块系统

系统 SHALL 实现完整的可视化块编辑系统。

#### Scenario: 块类型定义
- **WHEN** 初始化可视化编辑器
- **THEN** 加载所有预定义块类型
- **THEN** 每个块类型有唯一的视觉样式
- **THEN** 块类型包括：值、变量、运算符、方法调用、控制结构

#### Scenario: 块拖拽操作
- **WHEN** 用户从块库拖拽块到画布
- **THEN** 块跟随鼠标移动
- **THEN** 显示可放置位置的高亮
- **THEN** 释放时块添加到对应位置

#### Scenario: 块连接
- **WHEN** 用户将一个块拖到另一个块的输入插槽
- **THEN** 检查类型兼容性
- **WHEN** 类型兼容
- **THEN** 块自动吸附连接
- **WHEN** 类型不兼容
- **THEN** 显示警告但仍允许连接

#### Scenario: 块嵌套
- **WHEN** 块有嵌套输入（如 map 的回调）
- **THEN** 显示展开的嵌套区域
- **THEN** 允许在嵌套区域内构建子表达式
- **THEN** 嵌套区域可折叠

#### Scenario: 块删除
- **WHEN** 用户选中块并按删除键
- **THEN** 删除该块及其所有子块
- **WHEN** 块有父块连接
- **THEN** 断开连接，父块输入变为空

### Requirement: 块库面板

系统 SHALL 提供分类的块库面板。

#### Scenario: 块库分类显示
- **WHEN** 打开块库面板
- **THEN** 显示分类列表：变量和值、运算符、数组方法、字符串方法、控制结构
- **THEN** 每个分类可展开/折叠
- **THEN** 显示每个块的图标和名称

#### Scenario: 块搜索
- **WHEN** 用户在搜索框输入
- **THEN** 实时过滤匹配的块
- **THEN** 支持中英文搜索
- **THEN** 高亮匹配的关键词

#### Scenario: 块预览
- **WHEN** 用户悬停在块上
- **THEN** 显示块的详细说明
- **THEN** 显示使用示例
- **THEN** 显示生成的 GML 代码预览

#### Scenario: 快捷插入
- **WHEN** 用户双击块
- **THEN** 块添加到当前选中位置
- **WHEN** 无选中位置
- **THEN** 块添加到表达式末尾

### Requirement: AST 同步机制

系统 SHALL 实现文本和可视化的双向同步。

#### Scenario: 文本到可视化同步
- **WHEN** 用户在文本模式编辑
- **THEN** 实时解析 GML 为 AST
- **WHEN** 解析成功
- **THEN** 更新可视化编辑器显示
- **WHEN** 解析失败
- **THEN** 保持可视化编辑器上次有效状态

#### Scenario: 可视化到文本同步
- **WHEN** 用户在可视化模式编辑
- **THEN** 从块结构生成 AST
- **THEN** 从 AST 生成格式化的 GML 文本
- **THEN** 更新文本编辑器内容

#### Scenario: 增量同步
- **WHEN** 小范围编辑变更
- **THEN** 仅更新受影响的部分
- **THEN** 不重新渲染整个结构
- **THEN** 保持编辑流畅性

#### Scenario: 冲突处理
- **WHEN** 两个模式几乎同时编辑
- **THEN** 使用最后编辑的模式为准
- **THEN** 提示用户可能的内容差异

### Requirement: 变量上下文感知

系统 SHALL 在编辑器中提供变量上下文感知。

#### Scenario: 可用变量提示
- **WHEN** 用户创建变量引用块
- **THEN** 显示当前流程中所有可用变量
- **THEN** 显示变量的推断类型
- **THEN** 显示变量来源（输入参数、上游节点输出等）

#### Scenario: 类型推断
- **WHEN** 构建表达式时
- **THEN** 实时推断中间结果类型
- **THEN** 根据类型过滤可用的后续操作
- **THEN** 类型不匹配时显示警告

#### Scenario: 字段导航
- **WHEN** 变量是对象类型
- **THEN** 显示可用的字段列表
- **WHEN** 选择字段
- **THEN** 自动添加字段访问块

#### Scenario: 数组元素类型
- **WHEN** 变量是数组类型
- **THEN** 在 map/filter 等方法中
- **THEN** 正确推断迭代变量的类型

### Requirement: 复杂表达式支持

系统 SHALL 支持复杂 GML 表达式的可视化编辑。

#### Scenario: CASE-WHEN 表达式
- **WHEN** 添加 CASE-WHEN 块
- **THEN** 显示条件分支结构
- **THEN** 支持添加多个 WHEN 分支
- **THEN** 支持 ELSE 默认分支
- **THEN** 可视化显示分支关系

#### Scenario: 对象构造
- **WHEN** 添加对象块
- **THEN** 显示键值对编辑区域
- **THEN** 支持添加多个属性
- **THEN** 支持 spread 操作符块

#### Scenario: 数组构造
- **WHEN** 添加数组块
- **THEN** 显示元素列表
- **THEN** 支持拖拽调整顺序
- **THEN** 支持添加任意数量元素

#### Scenario: 链式调用
- **WHEN** 构建链式方法调用
- **THEN** 清晰显示调用链
- **THEN** 每个调用步骤可独立编辑
- **THEN** 支持在链中插入新调用

### Requirement: 编辑器交互优化

系统 SHALL 优化编辑器的交互体验。

#### Scenario: 撤销/重做
- **WHEN** 用户按 Ctrl+Z
- **THEN** 撤销上一步操作
- **WHEN** 用户按 Ctrl+Y
- **THEN** 重做已撤销的操作
- **THEN** 两种模式共享撤销栈

#### Scenario: 复制/粘贴
- **WHEN** 用户复制可视化块
- **THEN** 复制块结构到剪贴板
- **WHEN** 粘贴时
- **THEN** 在当前位置创建块副本
- **THEN** 支持跨编辑器粘贴

#### Scenario: 键盘导航
- **WHEN** 在可视化模式使用方向键
- **THEN** 在块之间导航
- **THEN** Tab 键进入嵌套块
- **THEN** Escape 键退出当前块

#### Scenario: 缩放和平移
- **WHEN** 表达式复杂时
- **THEN** 支持画布缩放
- **THEN** 支持画布平移
- **THEN** 提供小地图导航

### Requirement: 表达式模板

系统 SHALL 提供常用表达式模板。

#### Scenario: 模板库
- **WHEN** 用户打开模板库
- **THEN** 显示常用表达式模板列表
- **THEN** 按场景分类（数据转换、条件判断、聚合计算等）

#### Scenario: 应用模板
- **WHEN** 用户选择模板
- **THEN** 预览模板结构
- **THEN** 插入模板到编辑器
- **THEN** 高亮需要填充的占位符

#### Scenario: 保存为模板
- **WHEN** 用户保存当前表达式为模板
- **THEN** 提取变量为占位符
- **THEN** 保存到个人模板库
- **THEN** 支持分享模板

#### Scenario: 智能推荐
- **WHEN** 用户开始编辑表达式
- **THEN** 根据上下文推荐相关模板
- **THEN** 根据历史使用推荐常用模板
