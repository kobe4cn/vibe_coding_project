# Flow Runtime Capability - Delta Spec

## MODIFIED Requirements

### Requirement: GML 表达式求值

系统 SHALL 提供完整的 GML 表达式求值器，用于计算节点的 args、with、only、sets 等表达式。

#### Scenario: 基础表达式求值
- **GIVEN** GML 表达式 `price * quantity`
- **AND** 上下文变量 price=100, quantity=5
- **WHEN** 求值器计算表达式
- **THEN** 返回结果 500

#### Scenario: 字符串模板求值
- **GIVEN** GML 表达式 `` `订单${orderId}已创建` ``
- **AND** 上下文变量 orderId="ORD001"
- **WHEN** 求值器计算表达式
- **THEN** 返回结果 "订单ORD001已创建"

#### Scenario: CASE 表达式求值
- **GIVEN** GML 表达式包含 CASE WHEN ... THEN ... ELSE ... END
- **WHEN** 求值器计算表达式
- **THEN** 按顺序匹配 WHEN 条件
- **AND** 返回首个匹配的 THEN 值

#### Scenario: 数组原型方法求值
- **GIVEN** GML 表达式 `orders.filter(o => o.amount > 100).sum('amount')`
- **AND** 上下文变量 orders 为订单数组
- **WHEN** 求值器计算表达式
- **THEN** 正确执行 filter 和 sum 方法链

#### Scenario: 空值安全求值
- **GIVEN** GML 表达式引用了 null 值的属性
- **WHEN** 求值器计算表达式
- **THEN** 不抛出异常
- **AND** 返回 null

#### Scenario: 内置数学函数
- **GIVEN** GML 表达式 `SUM(items.map(i => i.price))`
- **AND** items 数组包含 3 个元素，price 分别为 10, 20, 30
- **WHEN** 求值器计算表达式
- **THEN** 返回结果 60

#### Scenario: 内置字符串函数
- **GIVEN** GML 表达式 `UPPER(name) + '_' + LOWER(code)`
- **AND** name="hello", code="WORLD"
- **WHEN** 求值器计算表达式
- **THEN** 返回结果 "HELLO_world"

#### Scenario: 内置日期函数
- **GIVEN** GML 表达式 `FORMAT_DATE(NOW(), 'YYYY-MM-DD')`
- **WHEN** 求值器计算表达式
- **THEN** 返回当前日期的格式化字符串

## ADDED Requirements

### Requirement: 隐式并行执行调度

系统 SHALL 自动识别无依赖关系的节点并并行执行，提高流程执行效率。

#### Scenario: 起始节点并行执行
- **GIVEN** 流程有 3 个起始节点（A、B、C），均无入边
- **WHEN** 流程开始执行
- **THEN** A、B、C 三个节点同时开始执行
- **AND** 三个节点的执行互不阻塞

#### Scenario: 同级节点并行执行
- **GIVEN** 节点 A 的 next 同时指向 B 和 C
- **AND** B 和 C 之间无依赖关系
- **WHEN** 节点 A 执行完成
- **THEN** B 和 C 同时开始执行

#### Scenario: 汇聚节点等待
- **GIVEN** 节点 A 和 B 的 next 都指向 C
- **AND** A 先完成，B 尚未完成
- **WHEN** A 完成执行
- **THEN** C 等待 B 完成后才开始执行

#### Scenario: 依赖图构建
- **GIVEN** 流程包含多个节点和边
- **WHEN** 执行引擎初始化
- **THEN** 构建节点依赖图
- **AND** 计算每个节点的入度

### Requirement: 子流程递归执行

系统 SHALL 支持 each/loop 节点内嵌子流程的递归执行。

#### Scenario: each 节点子流程执行
- **GIVEN** each 节点配置为 `items => item, index`
- **AND** items 数组有 3 个元素
- **AND** 子流程包含 2 个节点
- **WHEN** each 节点执行
- **THEN** 子流程执行 3 次
- **AND** 每次迭代中 item 和 index 绑定为当前值
- **AND** 按顺序执行（前一次完成后才开始下一次）

#### Scenario: loop 节点子流程执行
- **GIVEN** loop 节点配置 vars='count=0' when='count < 3'
- **AND** 子流程中包含 sets='count = count + 1'
- **WHEN** loop 节点执行
- **THEN** 子流程执行 3 次
- **AND** 第 4 次检查 when 条件为 false，退出循环

#### Scenario: 子流程变量作用域
- **GIVEN** 子流程内定义了局部变量
- **WHEN** 子流程执行完成
- **THEN** 局部变量在子流程外不可见
- **AND** 父流程变量在子流程内可访问

#### Scenario: 子流程嵌套执行
- **GIVEN** each 节点的子流程中包含另一个 loop 节点
- **WHEN** each 节点执行
- **THEN** 嵌套的 loop 节点正确递归执行
- **AND** 各层作用域隔离

### Requirement: Rust 后端运行时

系统 SHALL 提供 Rust 后端运行时，支持生产级流程执行。

#### Scenario: 后端服务启动
- **GIVEN** fdl-runtime 服务配置正确
- **WHEN** 服务启动
- **THEN** HTTP API 在配置端口监听
- **AND** WebSocket 端点可用
- **AND** 健康检查端点返回正常状态

#### Scenario: 流程执行 API
- **GIVEN** POST 请求到 `/api/v1/flows/{flowId}/execute`
- **AND** 请求体包含输入参数
- **WHEN** 服务接收请求
- **THEN** 创建新的执行实例
- **AND** 返回执行 ID
- **AND** 开始异步执行流程

#### Scenario: WebSocket 执行事件
- **GIVEN** 客户端通过 WebSocket 连接
- **AND** 订阅流程执行事件
- **WHEN** 流程执行过程中节点状态变化
- **THEN** 通过 WebSocket 推送事件
- **AND** 事件包含节点 ID、状态、时间戳

#### Scenario: 执行状态查询
- **GIVEN** GET 请求到 `/api/v1/executions/{executionId}`
- **WHEN** 服务接收请求
- **THEN** 返回执行状态
- **AND** 包含已执行节点列表
- **AND** 包含当前上下文变量

### Requirement: 真实工具调用

系统 SHALL 支持真实的工具调用，包括 API、数据库和 MCP 服务。

#### Scenario: HTTP API 调用
- **GIVEN** exec 节点配置为 `api://service/endpoint`
- **AND** 配置了 HTTP 方法和参数
- **WHEN** 节点执行
- **THEN** 发送真实 HTTP 请求
- **AND** 返回实际响应数据
- **AND** 超时后触发错误处理

#### Scenario: 数据库查询调用
- **GIVEN** exec 节点配置为 `db://datasource/query`
- **AND** 配置了 SQL 查询和参数
- **WHEN** 节点执行
- **THEN** 执行真实数据库查询
- **AND** 返回查询结果
- **AND** 支持参数化查询防止注入

#### Scenario: MCP 服务调用
- **GIVEN** mcp 节点配置了服务器和工具
- **AND** 配置了认证信息
- **WHEN** 节点执行
- **THEN** 连接 MCP 服务器
- **AND** 调用指定工具
- **AND** 返回工具执行结果

#### Scenario: 工具调用超时
- **GIVEN** 工具调用配置了 30 秒超时
- **WHEN** 工具调用超过 30 秒未响应
- **THEN** 取消调用
- **AND** 触发超时错误
- **AND** 若配置了 fail 边，执行错误处理流程

### Requirement: 前后端执行模式切换

系统 SHALL 支持前端模拟执行和连接后端真实执行两种模式。

#### Scenario: 模拟执行模式
- **GIVEN** 编辑器未连接后端服务
- **WHEN** 用户点击运行按钮
- **THEN** 使用前端 Mock 执行
- **AND** 工具调用返回模拟数据
- **AND** 执行状态在本地管理

#### Scenario: 真实执行模式
- **GIVEN** 编辑器已连接后端服务
- **WHEN** 用户点击运行按钮
- **THEN** 通过 WebSocket 发送执行请求
- **AND** 工具调用由后端执行
- **AND** 执行事件通过 WebSocket 接收

#### Scenario: 模式切换
- **GIVEN** 编辑器处于模拟执行模式
- **AND** 用户配置后端服务地址
- **WHEN** 用户选择切换到真实执行模式
- **THEN** 建立 WebSocket 连接
- **AND** 后续执行使用后端服务

#### Scenario: 连接断开恢复
- **GIVEN** 编辑器处于真实执行模式
- **WHEN** WebSocket 连接断开
- **THEN** 尝试自动重连
- **AND** 重连失败后提示用户
- **AND** 允许切换回模拟执行模式

### Requirement: 执行状态持久化

系统 SHALL 支持长时间运行流程的状态持久化，确保服务重启后可恢复执行。

#### Scenario: 执行快照保存
- **GIVEN** 流程正在执行中
- **WHEN** 节点执行完成
- **THEN** 自动保存执行快照到数据库
- **AND** 快照包含当前节点状态、上下文变量、执行历史

#### Scenario: 执行状态恢复
- **GIVEN** 服务意外重启
- **AND** 存在未完成的执行快照
- **WHEN** 服务启动完成
- **THEN** 自动从快照恢复执行
- **AND** 从中断点继续执行后续节点

#### Scenario: 执行历史查询
- **GIVEN** GET 请求到 `/api/v1/executions`
- **AND** 请求包含筛选条件（状态、时间范围、流程 ID）
- **WHEN** 服务处理请求
- **THEN** 返回匹配的执行历史列表
- **AND** 支持分页

#### Scenario: 手动恢复执行
- **GIVEN** 执行处于暂停或错误状态
- **AND** 存在有效快照
- **WHEN** POST 请求到 `/api/v1/executions/{id}/resume`
- **THEN** 从快照恢复执行
- **AND** 继续执行后续节点

#### Scenario: 快照清理
- **GIVEN** 执行已完成或已取消
- **WHEN** 配置的保留期到期
- **THEN** 自动清理过期快照
- **AND** 保留执行历史记录

### Requirement: JWT 认证鉴权

系统 SHALL 使用 JWT 进行用户认证和 API 授权。

#### Scenario: 用户登录
- **GIVEN** POST 请求到 `/api/v1/auth/login`
- **AND** 请求体包含有效凭据
- **WHEN** 服务验证凭据成功
- **THEN** 返回 JWT access token
- **AND** 返回 refresh token
- **AND** Token 包含用户 ID、租户 ID、角色信息

#### Scenario: Token 验证
- **GIVEN** 请求包含 Authorization: Bearer {token}
- **WHEN** 服务验证 Token
- **THEN** 解析 Token 获取用户信息
- **AND** 将用户信息注入请求上下文

#### Scenario: Token 过期
- **GIVEN** 请求包含过期的 JWT Token
- **WHEN** 服务验证 Token
- **THEN** 返回 401 Unauthorized
- **AND** 响应包含 token_expired 错误码

#### Scenario: Token 刷新
- **GIVEN** POST 请求到 `/api/v1/auth/refresh`
- **AND** 请求体包含有效的 refresh token
- **WHEN** 服务验证 refresh token
- **THEN** 返回新的 access token
- **AND** 原 refresh token 失效

#### Scenario: 权限检查
- **GIVEN** 用户角色为 Viewer
- **WHEN** 用户尝试执行流程
- **THEN** 返回 403 Forbidden
- **AND** 响应包含 permission_denied 错误

#### Scenario: WebSocket 认证
- **GIVEN** 客户端连接 WebSocket
- **AND** 连接请求包含有效 JWT Token
- **WHEN** 服务验证 Token
- **THEN** 建立 WebSocket 连接
- **AND** 后续消息使用验证后的用户上下文

### Requirement: 多租户数据隔离

系统 SHALL 支持多租户模式，确保租户间数据完全隔离。

#### Scenario: 租户数据隔离
- **GIVEN** 租户 A 创建了流程 Flow-1
- **WHEN** 租户 B 查询流程列表
- **THEN** 结果不包含 Flow-1
- **AND** 租户 B 无法访问 Flow-1

#### Scenario: 租户上下文注入
- **GIVEN** 请求包含有效 JWT Token
- **AND** Token 包含 tenant_id 声明
- **WHEN** 服务处理请求
- **THEN** 自动将 tenant_id 注入到所有数据库查询
- **AND** 确保只返回当前租户的数据

#### Scenario: 跨租户访问阻止
- **GIVEN** 租户 A 尝试访问租户 B 的执行记录
- **WHEN** 服务处理请求
- **THEN** 返回 404 Not Found
- **AND** 记录安全审计日志

#### Scenario: 租户资源配额
- **GIVEN** 租户配置了最大并发执行数为 10
- **AND** 当前已有 10 个执行正在运行
- **WHEN** 租户发起新的执行请求
- **THEN** 返回 429 Too Many Requests
- **AND** 响应包含 quota_exceeded 错误

#### Scenario: 租户配置管理
- **GIVEN** 管理员 POST 请求到 `/api/v1/admin/tenants/{id}/config`
- **AND** 请求体包含新的配额配置
- **WHEN** 服务处理请求
- **THEN** 更新租户配置
- **AND** 新配置立即生效

### Requirement: 角色权限控制

系统 SHALL 提供基于角色的访问控制 (RBAC)。

#### Scenario: 角色定义
- **GIVEN** 系统预定义角色：Viewer、Editor、Operator、Admin
- **WHEN** 查询角色权限
- **THEN** Viewer 可查看流程和执行
- **AND** Editor 可创建和修改流程
- **AND** Operator 可执行和控制流程
- **AND** Admin 拥有全部权限

#### Scenario: 权限继承
- **GIVEN** 用户拥有 Operator 角色
- **WHEN** 用户查看流程列表
- **THEN** 请求成功
- **AND** Operator 继承 Viewer 和 Editor 的权限

#### Scenario: 权限检查失败
- **GIVEN** 用户角色为 Editor
- **WHEN** 用户尝试停止正在运行的执行
- **THEN** 返回 403 Forbidden
- **AND** 提示需要 Operator 或 Admin 角色
