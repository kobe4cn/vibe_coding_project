# 工具管理能力规范

## ADDED Requirements

### Requirement: 工具服务统一 URI 规范

系统 SHALL 严格遵循 `tool-type://tool-service-id/tool-id?[options]` 的 URI 格式进行工具调用。

#### Scenario: URI 解析成功
- **WHEN** 系统接收到工具调用 URI `api://crm-service/customer_list?timeout=5000`
- **THEN** 系统解析出 tool-type 为 `api`
- **THEN** 系统解析出 tool-service-id 为 `crm-service`
- **THEN** 系统解析出 tool-id 为 `customer_list`
- **THEN** 系统解析出 options 包含 `timeout=5000`

#### Scenario: URI 格式错误
- **WHEN** 系统接收到格式错误的 URI `invalid-uri`
- **THEN** 系统返回解析错误，包含错误原因
- **THEN** 流程执行终止或跳转到 fail 节点

#### Scenario: 工具类型不支持
- **WHEN** 系统接收到未知类型的 URI `unknown://service/tool`
- **THEN** 系统返回 ToolNotFound 错误
- **THEN** 错误信息包含不支持的工具类型名称

---

### Requirement: MCP 服务 (mcp://)

系统 SHALL 完整实现 Model Context Protocol 服务调用能力。

#### Scenario: MCP 服务器连接
- **WHEN** 系统首次调用 MCP 服务 `mcp://baidu_map/map_ip_location`
- **THEN** 系统建立与 MCP 服务器的连接
- **THEN** 支持 stdio、SSE、WebSocket 三种传输方式
- **THEN** 连接成功后缓存连接以复用

#### Scenario: MCP 工具发现
- **WHEN** MCP 服务器连接成功
- **THEN** 系统调用 `tools/list` 获取可用工具列表
- **THEN** 缓存工具元数据（名称、描述、参数 schema）
- **THEN** 工具列表可供前端选择器使用

#### Scenario: MCP 工具调用
- **WHEN** 执行 `mcp://loyalty/customer_take` 并传入参数 `{id: "C001"}`
- **THEN** 系统构建 MCP 请求（method: tools/call）
- **THEN** 发送请求到 MCP 服务器
- **THEN** 解析响应并返回工具执行结果

#### Scenario: MCP 服务器断开重连
- **WHEN** MCP 连接断开且有新的调用请求
- **THEN** 系统自动尝试重新连接
- **THEN** 重连成功后继续执行调用
- **THEN** 重连失败后返回连接错误

#### Scenario: MCP 认证支持
- **WHEN** MCP 服务器要求认证
- **THEN** 系统支持 API Key 认证方式
- **THEN** 认证信息从服务配置中获取

---

### Requirement: 微服务调用 (svc://)

系统 SHALL 实现内部微服务调用能力，支持 gRPC 和 HTTP 协议。

#### Scenario: gRPC 服务调用
- **WHEN** 执行 `svc://loyalty/customers_list` 且服务配置为 gRPC
- **THEN** 系统从服务注册中心获取服务地址
- **THEN** 通过 gRPC 协议调用指定方法
- **THEN** 返回 protobuf 解码后的响应

#### Scenario: HTTP 微服务调用
- **WHEN** 执行 `svc://loyalty/customers_create` 且服务配置为 HTTP
- **THEN** 系统构建 HTTP 请求（基于服务配置）
- **THEN** 添加服务间认证头（如 JWT、mTLS）
- **THEN** 返回 JSON 解析后的响应

#### Scenario: 服务发现
- **WHEN** 系统首次调用微服务
- **THEN** 从注册中心（Consul/Nacos/K8s）查询服务实例
- **THEN** 支持负载均衡策略（轮询、随机、权重）
- **THEN** 缓存服务地址并定期刷新

#### Scenario: 服务熔断
- **WHEN** 微服务连续失败超过阈值
- **THEN** 系统触发熔断器打开
- **THEN** 后续调用快速失败返回降级响应
- **THEN** 熔断器半开状态尝试恢复

---

### Requirement: HTTP API 调用 (api://)

系统 SHALL 提供完整的外部 HTTP API 调用能力。

#### Scenario: GET 请求
- **WHEN** 执行 `api://user-service/get_profile?method=GET`
- **WHEN** 参数包含 `{userId: "U001"}`
- **THEN** 系统构建 GET 请求，参数作为 query string
- **THEN** 发送请求到配置的 base_url + endpoint
- **THEN** 返回 JSON 解析后的响应

#### Scenario: POST 请求
- **WHEN** 执行 `api://oms-service/sync_order?method=POST`
- **WHEN** 参数包含订单数据对象
- **THEN** 系统构建 POST 请求，参数作为 JSON body
- **THEN** 设置 Content-Type: application/json
- **THEN** 返回响应数据

#### Scenario: API Key 认证
- **WHEN** API 服务配置 auth_type 为 apikey
- **WHEN** auth_config 包含 `{header: "X-API-Key", value: "secret"}`
- **THEN** 系统在请求头中添加 `X-API-Key: secret`

#### Scenario: Bearer Token 认证
- **WHEN** API 服务配置 auth_type 为 bearer
- **WHEN** auth_config 包含 `{token: "jwt_token"}`
- **THEN** 系统在请求头中添加 `Authorization: Bearer jwt_token`

#### Scenario: OAuth2 认证
- **WHEN** API 服务配置 auth_type 为 oauth2
- **WHEN** auth_config 包含 client_id、client_secret、token_url
- **THEN** 系统先获取 access_token
- **THEN** 使用 access_token 进行 API 调用
- **THEN** token 过期时自动刷新

#### Scenario: 路径参数替换
- **WHEN** endpoint 配置为 `/users/{userId}/orders/{orderId}`
- **WHEN** 参数包含 `{userId: "U001", orderId: "O001"}`
- **THEN** 系统替换路径参数生成 `/users/U001/orders/O001`

#### Scenario: 超时和重试
- **WHEN** API 调用配置 `timeout=5000&max-attempts=3`
- **WHEN** 第一次调用超时
- **THEN** 系统自动重试最多 3 次
- **THEN** 每次重试间隔递增（指数退避）
- **THEN** 所有重试失败后返回超时错误

#### Scenario: 响应状态码处理
- **WHEN** API 返回 4xx 或 5xx 状态码
- **THEN** 系统将其视为错误
- **THEN** 错误信息包含状态码和响应体
- **THEN** 触发 fail 节点跳转（如配置）

---

### Requirement: 对象存储 (oss://)

系统 SHALL 实现对象存储操作能力，支持多种云存储服务。

#### Scenario: 上传对象 (save)
- **WHEN** 执行 `oss://sample-bucket/save`
- **WHEN** 参数包含 `{key: "files/doc.pdf", content: <binary>, contentType: "application/pdf"}`
- **THEN** 系统上传内容到指定路径
- **THEN** 返回对象的访问 URL 和元数据

#### Scenario: 下载对象 (load)
- **WHEN** 执行 `oss://sample-bucket/load`
- **WHEN** 参数包含 `{key: "files/doc.pdf"}`
- **THEN** 系统从存储桶下载指定对象
- **THEN** 返回对象内容和元数据

#### Scenario: 列出对象 (list)
- **WHEN** 执行 `oss://sample-bucket/list`
- **WHEN** 参数包含 `{prefix: "files/", maxKeys: 100}`
- **THEN** 系统列出指定前缀下的对象
- **THEN** 返回对象列表（key、size、lastModified）

#### Scenario: 删除对象 (delete)
- **WHEN** 执行 `oss://sample-bucket/delete`
- **WHEN** 参数包含 `{key: "files/doc.pdf"}`
- **THEN** 系统删除指定对象
- **THEN** 返回删除结果

#### Scenario: 生成预签名 URL
- **WHEN** 执行 `oss://sample-bucket/presign`
- **WHEN** 参数包含 `{key: "files/doc.pdf", expires: 3600}`
- **THEN** 系统生成有效期为 1 小时的预签名 URL
- **THEN** 返回可直接访问的 URL

#### Scenario: 支持的存储服务
- **WHEN** 配置 OSS 服务
- **THEN** 系统支持以下存储后端：
  - 阿里云 OSS
  - AWS S3
  - MinIO
  - 腾讯云 COS
  - 华为云 OBS

---

### Requirement: 消息队列 (mq://)

系统 SHALL 实现消息队列操作能力。

#### Scenario: 发布消息 (publish)
- **WHEN** 执行 `mq://order-service/order_created`
- **WHEN** 参数包含 `{message: {orderId: "O001", status: "created"}}`
- **THEN** 系统将消息发布到指定队列/主题
- **THEN** 返回消息 ID

#### Scenario: 发布延迟消息
- **WHEN** 执行 `mq://common-rabbit/cache_expire`
- **WHEN** 参数包含 `{message: {...}, delay: 60000}`
- **THEN** 系统发布延迟 60 秒的消息
- **THEN** 消息在延迟后才可被消费

#### Scenario: 消息订阅触发器
- **WHEN** 流程配置为消息触发类型
- **WHEN** 指定订阅 `mq://order-service/order_created`
- **THEN** 系统监听队列消息
- **THEN** 收到消息时触发流程执行
- **THEN** 消息内容作为流程输入参数

#### Scenario: 支持的消息中间件
- **WHEN** 配置 MQ 服务
- **THEN** 系统支持以下消息中间件：
  - RabbitMQ
  - Apache Kafka
  - RocketMQ
  - Redis Pub/Sub

---

### Requirement: 电子邮件 (mail://)

系统 SHALL 实现邮件发送能力。

#### Scenario: 发送普通邮件
- **WHEN** 执行 `mail://marketing/welcome`
- **WHEN** 参数包含 `{to: "user@example.com", subject: "欢迎", body: "欢迎注册"}`
- **THEN** 系统通过配置的 SMTP 服务器发送邮件
- **THEN** 返回发送状态和消息 ID

#### Scenario: 发送 HTML 邮件
- **WHEN** 参数包含 `{body: "<h1>欢迎</h1>", contentType: "html"}`
- **THEN** 系统设置邮件内容类型为 text/html
- **THEN** 正确渲染 HTML 内容

#### Scenario: 发送带附件邮件
- **WHEN** 参数包含 `{attachments: [{name: "report.pdf", content: <binary>}]}`
- **THEN** 系统构建 multipart 邮件
- **THEN** 附件正确添加到邮件中

#### Scenario: 使用邮件模板
- **WHEN** 执行 `mail://it-service/notify`
- **WHEN** 参数包含 `{template: "alert", variables: {system: "订单系统", error: "超时"}}`
- **THEN** 系统加载指定模板
- **THEN** 使用变量渲染模板内容
- **THEN** 发送渲染后的邮件

#### Scenario: 批量发送
- **WHEN** 参数包含 `{to: ["a@example.com", "b@example.com"]}`
- **THEN** 系统批量发送邮件到所有收件人
- **THEN** 返回每个收件人的发送状态

---

### Requirement: 短信服务 (sms://)

系统 SHALL 实现短信发送能力。

#### Scenario: 发送普通短信
- **WHEN** 执行 `sms://crm-sms/welcome`
- **WHEN** 参数包含 `{to: "13800138000", content: "欢迎注册"}`
- **THEN** 系统通过配置的短信网关发送短信
- **THEN** 返回发送状态和消息 ID

#### Scenario: 发送模板短信
- **WHEN** 执行 `sms://crm-sms/verification_code`
- **WHEN** 参数包含 `{to: "13800138000", template: "SMS_001", params: {code: "123456"}}`
- **THEN** 系统使用指定模板发送短信
- **THEN** 模板参数正确替换

#### Scenario: 支持的短信服务商
- **WHEN** 配置 SMS 服务
- **THEN** 系统支持以下短信服务商：
  - 阿里云短信
  - 腾讯云短信
  - 华为云短信
  - Twilio

---

### Requirement: 工作流调用 (flow://)

系统 SHALL 支持流程间调用能力。

#### Scenario: 同步调用子流程
- **WHEN** 执行 `flow://sample-flow`
- **WHEN** 参数包含子流程所需的输入参数
- **THEN** 系统同步执行子流程
- **THEN** 等待子流程完成并返回结果
- **THEN** 子流程执行失败时传播错误

#### Scenario: 异步调用子流程
- **WHEN** 执行 `flow://sample-flow?async=true`
- **THEN** 系统创建子流程执行任务
- **THEN** 立即返回执行 ID
- **THEN** 不等待子流程完成

#### Scenario: 子流程参数传递
- **WHEN** 父流程调用子流程
- **THEN** 自动传递 tenantId 和 buCode
- **THEN** 显式传递的参数覆盖上下文变量

#### Scenario: 子流程版本选择
- **WHEN** 执行 `flow://sample-flow?version=2`
- **THEN** 系统执行指定版本的流程
- **THEN** 未指定版本时使用最新发布版本

---

### Requirement: 智能体调用 (agent://)

系统 SHALL 支持 AI 智能体调用能力。

#### Scenario: 调用 Agent
- **WHEN** 执行 `agent://sample-agent`
- **WHEN** 参数包含 `{prompt: "分析订单趋势", context: {...}}`
- **THEN** 系统调用配置的 LLM 模型
- **THEN** 返回 Agent 的响应结果

#### Scenario: Agent 工具调用
- **WHEN** Agent 执行过程中需要调用工具
- **THEN** 系统验证工具在 Agent 绑定列表中
- **THEN** 执行工具并将结果返回给 Agent
- **THEN** Agent 继续处理直到完成

#### Scenario: Agent 移交 (Handoff)
- **WHEN** Agent 决定将任务移交给另一个 Agent
- **THEN** 系统保存当前对话上下文
- **THEN** 调用目标 Agent
- **THEN** 传递上下文和移交原因

---

### Requirement: 工具服务配置管理

系统 SHALL 提供工具服务的配置管理能力。

#### Scenario: 创建工具服务
- **WHEN** 用户通过 API 或 UI 创建工具服务
- **THEN** 系统验证配置的完整性
- **THEN** 保存服务配置到数据库
- **THEN** 服务可用于流程调用

#### Scenario: 服务启用/禁用
- **WHEN** 用户禁用某个工具服务
- **THEN** 该服务下的所有工具不可调用
- **THEN** 调用时返回服务禁用错误

#### Scenario: 服务配置更新
- **WHEN** 用户更新服务配置（如 base_url、认证信息）
- **THEN** 系统立即生效新配置
- **THEN** 不影响正在执行的调用

#### Scenario: 服务删除保护
- **WHEN** 用户尝试删除被流程引用的服务
- **THEN** 系统提示存在引用关系
- **THEN** 用户确认后强制删除或取消操作
