# 多语言 UDF 运行时规范

## ADDED Requirements

### Requirement: 统一 UDF 执行器

系统 SHALL 提供统一的 UDF 执行入口支持多种语言。

#### Scenario: 语言检测和路由
- **WHEN** 执行 UDF 时
- **THEN** 根据 UDF 定义的 language 字段
- **THEN** 路由到对应的语言运行时
- **THEN** 支持 sql、javascript、python、wasm 四种语言

#### Scenario: 统一输入输出格式
- **WHEN** 调用任何语言的 UDF
- **THEN** 输入参数统一为 JSON 格式
- **THEN** 输出结果统一转换为 JSON 格式
- **THEN** 类型转换错误返回明确错误信息

#### Scenario: 超时控制
- **WHEN** UDF 执行时间超过配置的 timeout_ms
- **THEN** 强制终止执行
- **THEN** 释放占用的资源
- **THEN** 返回超时错误

#### Scenario: 内存限制
- **WHEN** UDF 内存使用超过 memory_limit_mb
- **THEN** 触发内存超限错误
- **THEN** 终止执行并释放资源

### Requirement: SQL UDF 运行时

系统 SHALL 支持 SQL 语言的 UDF。

#### Scenario: SQL UDF 执行
- **WHEN** 执行 SQL 类型的 UDF
- **THEN** 将输入数据加载到临时表
- **THEN** 执行 UDF 中定义的 SQL 语句
- **THEN** 返回查询结果

#### Scenario: DuckDB 引擎
- **WHEN** SQL UDF 使用 DuckDB 引擎
- **THEN** 支持完整的 SQL 分析函数
- **THEN** 支持 JSON 处理函数
- **THEN** 支持数组和结构体类型

#### Scenario: 多表输入
- **WHEN** UDF 定义了多个输入参数
- **THEN** 每个参数创建独立的临时表
- **THEN** SQL 中可 JOIN 这些表

#### Scenario: 聚合函数
- **WHEN** SQL 包含聚合函数（SUM、AVG、COUNT 等）
- **THEN** 正确执行聚合计算
- **THEN** 支持 GROUP BY 分组聚合

### Requirement: JavaScript UDF 运行时

系统 SHALL 支持 JavaScript 语言的 UDF。

#### Scenario: QuickJS 执行
- **WHEN** 执行 JavaScript UDF
- **WHEN** 配置使用 QuickJS 引擎
- **THEN** 在轻量级沙箱中执行
- **THEN** 启动快速，资源占用低
- **THEN** 不支持异步操作

#### Scenario: Deno 执行
- **WHEN** 执行 JavaScript UDF
- **WHEN** 配置使用 Deno 引擎
- **THEN** 支持完整的 ES2022+ 语法
- **THEN** 支持 async/await
- **THEN** 支持 TypeScript

#### Scenario: 依赖管理
- **WHEN** JavaScript UDF 声明了依赖
- **THEN** 首次执行时安装依赖
- **THEN** 缓存依赖供后续使用
- **THEN** 支持 npm 包格式

#### Scenario: 标准库访问
- **WHEN** JavaScript UDF 需要使用标准库
- **THEN** 提供 lodash、dayjs 等常用库
- **THEN** 可按需启用/禁用标准库

### Requirement: Python UDF 运行时

系统 SHALL 支持 Python 语言的 UDF。

#### Scenario: RustPython 执行
- **WHEN** 执行轻量级 Python UDF
- **WHEN** 不需要 C 扩展库
- **THEN** 使用 RustPython 解释器
- **THEN** 完全沙箱隔离
- **THEN** 启动速度快

#### Scenario: PyO3 执行
- **WHEN** 执行需要 NumPy/Pandas 的 UDF
- **THEN** 使用 PyO3 调用 CPython
- **THEN** 支持完整的 Python 生态
- **THEN** 需要预装 Python 环境

#### Scenario: 虚拟环境管理
- **WHEN** Python UDF 声明了依赖
- **THEN** 为每个 UDF 创建独立虚拟环境
- **THEN** 安装声明的依赖包
- **THEN** 缓存虚拟环境

#### Scenario: 数据科学库支持
- **WHEN** UDF 需要数据处理
- **THEN** 支持 numpy、pandas、scipy
- **THEN** 输入数据可转换为 DataFrame
- **THEN** 输出结果从 DataFrame 转换

#### Scenario: AI/ML 库支持
- **WHEN** UDF 需要机器学习能力
- **THEN** 支持 scikit-learn、pytorch
- **THEN** 支持加载预训练模型
- **THEN** 支持模型推理

### Requirement: WASM UDF 运行时

系统 SHALL 支持 WebAssembly 的 UDF。

#### Scenario: WASM 模块加载
- **WHEN** 执行 WASM UDF
- **THEN** 加载编译好的 .wasm 文件
- **THEN** 验证模块安全性
- **THEN** 缓存编译后的模块

#### Scenario: 跨语言编译
- **WHEN** 开发者使用 Rust/Go/C++ 编写 UDF
- **THEN** 编译为 WASM 模块
- **THEN** 可在运行时执行
- **THEN** 获得接近原生的性能

#### Scenario: WASM 沙箱
- **WHEN** WASM UDF 执行时
- **THEN** 完全在沙箱中运行
- **THEN** 无法直接访问系统资源
- **THEN** 通过显式 API 访问外部能力

#### Scenario: 内存管理
- **WHEN** WASM UDF 分配内存
- **THEN** 限制在配置的内存上限内
- **THEN** 执行结束后自动释放
- **THEN** 支持内存使用监控

### Requirement: UDF 安全沙箱

系统 SHALL 实现完善的 UDF 安全沙箱。

#### Scenario: 资源限制
- **WHEN** UDF 执行时
- **THEN** 限制 CPU 时间
- **THEN** 限制内存使用
- **THEN** 限制执行时长

#### Scenario: 网络访问控制
- **WHEN** UDF 未声明网络权限
- **THEN** 阻止所有网络请求
- **WHEN** UDF 声明了网络权限
- **THEN** 仅允许访问白名单域名

#### Scenario: 文件系统隔离
- **WHEN** UDF 未声明文件权限
- **THEN** 阻止所有文件操作
- **WHEN** UDF 声明了临时文件权限
- **THEN** 仅允许访问临时目录

#### Scenario: 系统调用限制
- **WHEN** UDF 尝试危险系统调用
- **THEN** 阻止调用并记录告警
- **THEN** 终止 UDF 执行

### Requirement: UDF 定义和管理

系统 SHALL 提供完整的 UDF 定义和管理功能。

#### Scenario: UDF 创建
- **WHEN** 用户创建新 UDF
- **THEN** 选择语言类型
- **THEN** 定义输入输出签名
- **THEN** 编写 UDF 代码

#### Scenario: 签名验证
- **WHEN** 保存 UDF 定义
- **THEN** 验证签名完整性
- **THEN** 检查类型定义合法性
- **THEN** 不合法时阻止保存

#### Scenario: UDF 版本管理
- **WHEN** 修改已有 UDF
- **THEN** 创建新版本
- **THEN** 保留历史版本
- **THEN** 支持版本回滚

#### Scenario: UDF 依赖声明
- **WHEN** UDF 需要外部依赖
- **THEN** 在 dependencies 中声明
- **THEN** 支持版本约束
- **THEN** 安装时解析依赖

### Requirement: UDF 测试和调试

系统 SHALL 提供 UDF 测试和调试能力。

#### Scenario: 在线测试
- **WHEN** 用户点击测试按钮
- **THEN** 显示参数输入表单
- **WHEN** 填写参数并执行
- **THEN** 显示执行结果
- **THEN** 显示执行时间和资源消耗

#### Scenario: 测试用例管理
- **WHEN** 用户保存测试用例
- **THEN** 记录输入参数和期望输出
- **THEN** 支持批量运行测试用例
- **THEN** 显示测试报告

#### Scenario: 调试日志
- **WHEN** UDF 代码包含日志输出
- **THEN** 收集日志信息
- **THEN** 在测试结果中显示
- **THEN** 生产环境可配置日志级别

#### Scenario: 性能分析
- **WHEN** 用户启用性能分析
- **THEN** 记录详细执行耗时
- **THEN** 显示热点代码
- **THEN** 提供优化建议

### Requirement: UDF 在流程中的使用

系统 SHALL 支持在流程中便捷使用 UDF。

#### Scenario: UDF 节点
- **WHEN** 用户添加 UDF 节点
- **THEN** 显示可用 UDF 列表
- **WHEN** 选择 UDF
- **THEN** 自动生成参数映射模板

#### Scenario: GML 中调用 UDF
- **WHEN** 在 GML 表达式中
- **THEN** 支持 `udf.函数名(参数)` 语法
- **THEN** 自动补全可用的 UDF
- **THEN** 显示 UDF 签名提示

#### Scenario: UDF 结果缓存
- **WHEN** UDF 配置了缓存策略
- **WHEN** 相同参数多次调用
- **THEN** 返回缓存结果
- **THEN** 缓存过期后重新执行

#### Scenario: UDF 错误处理
- **WHEN** UDF 执行失败
- **THEN** 返回详细错误信息
- **THEN** 根据节点 fail 配置决定后续行为
- **THEN** 记录错误日志

### Requirement: UDF 监控和审计

系统 SHALL 提供 UDF 监控和审计能力。

#### Scenario: 执行统计
- **WHEN** UDF 被调用
- **THEN** 记录调用次数
- **THEN** 记录平均执行时间
- **THEN** 记录错误率

#### Scenario: 资源使用监控
- **WHEN** 查看 UDF 监控面板
- **THEN** 显示 CPU 使用趋势
- **THEN** 显示内存使用趋势
- **THEN** 显示执行时长分布

#### Scenario: 调用审计
- **WHEN** UDF 被调用
- **THEN** 记录调用者信息
- **THEN** 记录输入参数（可配置脱敏）
- **THEN** 支持审计日志查询

#### Scenario: 异常告警
- **WHEN** UDF 错误率超过阈值
- **THEN** 发送告警通知
- **WHEN** UDF 执行时间异常
- **THEN** 发送性能告警
