# 执行器优化规范

## ADDED Requirements

### Requirement: 并行执行调度

系统 SHALL 实现无依赖节点的并行执行能力。

#### Scenario: 识别无依赖节点
- **WHEN** 流程开始执行
- **THEN** 系统通过拓扑排序分析节点依赖关系
- **THEN** 识别所有入度为 0 的节点（起始节点）

#### Scenario: 并行执行起始节点
- **WHEN** 多个起始节点无相互依赖
- **THEN** 系统并行调度这些节点执行
- **THEN** 不等待其中任何一个完成

#### Scenario: 依赖节点等待
- **WHEN** 节点 C 依赖节点 A 和 B
- **WHEN** A 和 B 并行执行
- **THEN** C 等待 A 和 B 都完成后才开始执行

#### Scenario: 并行度限制
- **WHEN** 可并行节点数超过配置的最大并行数
- **THEN** 系统使用信号量控制并发
- **THEN** 多余的节点排队等待

### Requirement: 并行度配置

系统 SHALL 支持配置并行执行的最大并发数。

#### Scenario: 默认并行度
- **WHEN** 未配置并行度
- **THEN** 系统使用 CPU 核心数作为默认值

#### Scenario: 自定义并行度
- **WHEN** 用户配置 max_parallelism = 4
- **THEN** 最多同时执行 4 个节点

#### Scenario: 租户级别配额
- **WHEN** 租户配置了资源配额
- **THEN** 并行度不超过租户配额限制

### Requirement: 子流程执行

系统 SHALL 完整实现 each 和 loop 节点的子流程执行。

#### Scenario: each 节点迭代
- **WHEN** each 节点配置为 `ids => id`
- **WHEN** ids 数组包含 3 个元素
- **THEN** 子流程执行 3 次迭代
- **THEN** 每次迭代中 id 变量绑定为当前元素

#### Scenario: each 节点顺序执行
- **WHEN** each 节点开始执行
- **THEN** 各次迭代按顺序执行
- **THEN** 前一次迭代完成后才开始下一次

#### Scenario: loop 节点条件循环
- **WHEN** loop 节点配置 `when: count < 10`
- **THEN** 每次迭代前检查条件
- **THEN** 条件为 false 时终止循环

#### Scenario: 子流程变量作用域
- **WHEN** 子流程执行时
- **THEN** 可读取父流程的所有变量
- **THEN** 可通过 sets 更新父流程变量
- **THEN** 子流程内部变量对父流程不可见

### Requirement: 状态持久化

系统 SHALL 支持执行状态的持久化和恢复。

#### Scenario: 执行快照保存
- **WHEN** 流程执行过程中
- **THEN** 系统定期保存执行快照到数据库
- **THEN** 快照包含：已完成节点、当前节点、上下文变量

#### Scenario: 断点恢复
- **WHEN** 服务重启后
- **WHEN** 存在未完成的执行快照
- **THEN** 系统自动恢复执行
- **THEN** 从中断点继续执行后续节点

#### Scenario: 手动恢复
- **WHEN** 用户选择一个失败的执行
- **WHEN** 点击"从断点恢复"
- **THEN** 系统加载最近的有效快照
- **THEN** 重新执行失败的节点及后续节点

### Requirement: 执行历史查询

系统 SHALL 支持执行历史的查询和分析。

#### Scenario: 执行列表查询
- **WHEN** 用户查询流程执行历史
- **THEN** 返回执行记录列表
- **THEN** 包含：执行 ID、状态、开始时间、结束时间、耗时

#### Scenario: 执行详情查询
- **WHEN** 用户查看单次执行详情
- **THEN** 显示每个节点的执行状态
- **THEN** 显示输入参数和输出结果
- **THEN** 显示执行轨迹和耗时分布

#### Scenario: 节点执行日志
- **WHEN** 用户查看节点执行详情
- **THEN** 显示节点的输入输出
- **THEN** 显示工具调用的请求响应
- **THEN** 显示错误信息（如有）

### Requirement: GML 求值缓存

系统 SHALL 实现 GML 解析结果的缓存优化。

#### Scenario: 解析结果缓存
- **WHEN** 同一 GML 表达式多次执行
- **THEN** 系统复用之前的 AST 解析结果
- **THEN** 仅执行求值步骤

#### Scenario: 缓存失效
- **WHEN** 流程定义更新
- **THEN** 相关的 GML 缓存失效
- **THEN** 下次执行时重新解析

### Requirement: 执行超时控制

系统 SHALL 支持多层级的执行超时控制。

#### Scenario: 节点级超时
- **WHEN** 节点配置了 timeout 选项
- **THEN** 节点执行超过指定时间后中断
- **THEN** 触发错误处理流程

#### Scenario: 流程级超时
- **WHEN** 流程配置了总体超时时间
- **THEN** 整个流程执行超过限制后终止
- **THEN** 返回超时错误

#### Scenario: 工具调用超时
- **WHEN** 工具服务配置了 timeout_ms
- **THEN** 工具调用超时后返回错误
- **THEN** 根据 fail 配置决定后续行为

### Requirement: 执行指标收集

系统 SHALL 收集流程执行的性能指标。

#### Scenario: 节点执行耗时
- **WHEN** 节点执行完成
- **THEN** 记录节点执行耗时
- **THEN** 可用于性能分析和优化

#### Scenario: 工具调用统计
- **WHEN** 工具调用完成
- **THEN** 记录调用耗时、状态码、数据量
- **THEN** 支持聚合统计分析

#### Scenario: 资源使用统计
- **WHEN** 流程执行过程中
- **THEN** 记录 CPU、内存使用情况
- **THEN** 支持资源配额监控告警

### Requirement: 工具服务调用优化

系统 SHALL 优化不同类型工具服务的调用性能。

#### Scenario: HTTP 连接池管理
- **WHEN** API 工具服务频繁调用同一主机
- **THEN** 系统维护连接池复用 TCP 连接
- **THEN** 连接池大小可配置（默认 100 per host）
- **THEN** 空闲连接超时回收（默认 90s）

#### Scenario: 数据库连接池管理
- **WHEN** DB 工具服务执行数据库操作
- **THEN** 系统使用连接池管理数据库连接
- **THEN** 支持配置最小/最大连接数
- **THEN** 支持配置连接超时和空闲超时

#### Scenario: MCP 长连接管理
- **WHEN** MCP 工具服务建立连接
- **THEN** 系统维护 WebSocket/SSE 长连接
- **THEN** 支持自动重连和心跳保活
- **THEN** 连接异常时自动切换备用节点

#### Scenario: 工具调用结果缓存
- **WHEN** 工具配置启用缓存（cache_ttl > 0）
- **WHEN** 相同参数多次调用
- **THEN** 系统返回缓存结果
- **THEN** 缓存过期后重新调用

### Requirement: 批量执行优化

系统 SHALL 支持批量操作的执行优化。

#### Scenario: 批量 API 调用
- **WHEN** each 节点遍历大量数据调用 API
- **WHEN** API 支持批量接口
- **THEN** 系统自动聚合为批量请求
- **THEN** 响应解构后分发给各次迭代

#### Scenario: 批量数据库操作
- **WHEN** each 节点遍历数据执行 INSERT
- **THEN** 系统自动聚合为批量 INSERT
- **THEN** 使用 db://datasource/table?bulk 操作
- **THEN** 返回各行影响结果

#### Scenario: 并行迭代执行
- **WHEN** each 节点配置 parallel = true
- **THEN** 迭代并行执行而非顺序执行
- **THEN** 并行度受全局 max_parallelism 限制
- **THEN** 结果按原顺序聚合

### Requirement: 异常处理和重试

系统 SHALL 实现完善的异常处理和重试机制。

#### Scenario: 工具调用失败重试
- **WHEN** 工具调用返回可重试错误（5xx、超时）
- **WHEN** 工具配置了 retry 选项
- **THEN** 系统按配置的策略重试
- **THEN** 支持指数退避和最大重试次数

#### Scenario: 节点执行失败处理
- **WHEN** 节点执行失败
- **WHEN** 节点配置了 fail = "continue"
- **THEN** 系统继续执行后续节点
- **THEN** 失败节点的输出设为 null 或默认值

#### Scenario: 流程级错误处理
- **WHEN** 流程配置了 on_error 处理器
- **WHEN** 任意节点发生未捕获错误
- **THEN** 系统跳转到错误处理分支
- **THEN** 错误处理器可访问错误详情

#### Scenario: 补偿事务执行
- **WHEN** 流程配置了 compensate 分支
- **WHEN** 流程执行失败需要回滚
- **THEN** 系统按相反顺序执行补偿操作
- **THEN** 已完成节点的 compensate 分支执行

### Requirement: 分布式执行支持

系统 SHALL 支持流程的分布式执行。

#### Scenario: 长流程拆分
- **WHEN** 流程包含长时间运行的节点
- **THEN** 系统支持将流程拆分为多个执行段
- **THEN** 每段执行结果持久化
- **THEN** 下一段从持久化状态恢复

#### Scenario: 异步节点执行
- **WHEN** 节点配置为 async 模式
- **THEN** 节点提交后立即返回 job_id
- **THEN** 后续节点可通过 job_id 轮询或回调获取结果
- **THEN** 支持 webhook 回调通知

#### Scenario: 跨服务流程编排
- **WHEN** 流程调用 flow://other_flow 子流程
- **WHEN** 子流程部署在不同服务实例
- **THEN** 系统通过消息队列或 HTTP 调用子流程
- **THEN** 子流程结果异步返回

### Requirement: 执行上下文管理

系统 SHALL 提供完善的执行上下文管理。

#### Scenario: 变量作用域隔离
- **WHEN** 进入子流程或 each/loop 节点
- **THEN** 系统创建新的变量作用域
- **THEN** 子作用域继承父作用域的只读视图
- **THEN** 子作用域修改不影响父作用域（除非 sets）

#### Scenario: 上下文变量注入
- **WHEN** 流程开始执行
- **THEN** 系统自动注入标准上下文变量：
  - `$flow_id`: 流程定义 ID
  - `$execution_id`: 执行实例 ID
  - `$tenant_id`: 租户 ID
  - `$bu_code`: 业务单元代码
  - `$user_id`: 触发用户 ID
  - `$timestamp`: 执行开始时间

#### Scenario: 敏感变量保护
- **WHEN** 变量标记为 sensitive（如密码、Token）
- **THEN** 执行日志中显示为 "***"
- **THEN** 快照持久化时加密存储
- **THEN** API 返回时脱敏处理

### Requirement: 流程调试支持

系统 SHALL 提供流程调试能力。

#### Scenario: 断点调试
- **WHEN** 用户在节点上设置断点
- **WHEN** 执行到达断点节点
- **THEN** 系统暂停执行
- **THEN** 用户可查看当前上下文变量
- **THEN** 用户可选择继续、单步或中止

#### Scenario: 变量监视
- **WHEN** 用户配置变量监视列表
- **THEN** 每个节点执行后更新监视变量值
- **THEN** 前端实时显示变量变化

#### Scenario: 执行轨迹记录
- **WHEN** 流程执行完成
- **THEN** 系统记录完整执行轨迹：
  - 节点执行顺序和耗时
  - 每个节点的输入输出
  - 条件分支的判断结果
  - 循环的迭代次数

### Requirement: 执行性能监控

系统 SHALL 提供执行性能监控能力。

#### Scenario: 实时执行监控
- **WHEN** 流程正在执行
- **THEN** 前端可实时查看执行进度
- **THEN** 显示当前执行的节点
- **THEN** 显示已完成节点的状态

#### Scenario: 性能瓶颈识别
- **WHEN** 用户查看执行详情
- **THEN** 系统高亮显示耗时最长的节点
- **THEN** 显示各节点耗时占比
- **THEN** 提供优化建议（如批量化、并行化）

#### Scenario: 执行告警
- **WHEN** 节点执行时间超过阈值
- **THEN** 系统发送告警通知
- **WHEN** 流程失败率超过阈值
- **THEN** 系统发送告警通知
