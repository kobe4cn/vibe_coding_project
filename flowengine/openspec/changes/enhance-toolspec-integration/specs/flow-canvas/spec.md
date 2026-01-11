# 流程画布与前端工具管理增强规范

## ADDED Requirements

### Requirement: 工具选择器组件

系统 SHALL 提供统一的工具选择器组件，用于 ExecNode 和其他工具调用节点。

#### Scenario: 工具选择器结构
- **WHEN** 用户编辑 ExecNode 的 exec 属性
- **THEN** 显示工具选择器组件
- **THEN** 选择器包含三级结构：
  - 第一级：工具类型（api/db/mcp/flow/agent/oss/mq/mail/sms/svc）
  - 第二级：服务列表（已配置的工具服务）
  - 第三级：工具列表（服务下的可用工具）

#### Scenario: 工具类型过滤
- **WHEN** 用户选择工具类型为 `db`
- **THEN** 第二级仅显示数据源类型的服务
- **THEN** 第三级显示标准操作（take/list/page/count/create/modify/delete/save/bulk）

#### Scenario: 工具搜索
- **WHEN** 用户在工具选择器中输入搜索关键词
- **THEN** 系统在工具名称、描述中搜索
- **THEN** 实时过滤并高亮匹配项

#### Scenario: 工具详情预览
- **WHEN** 用户悬停在某个工具选项上
- **THEN** 显示工具详情 tooltip
- **THEN** 包含：描述、参数列表、返回类型

#### Scenario: 选择工具后自动填充
- **WHEN** 用户从选择器中选择一个工具
- **THEN** exec 字段自动填充为对应 URI（如 `api://crm-service/customer_list`）
- **THEN** args 字段自动生成参数模板（基于工具的 args.in 定义）

#### Scenario: 手动输入 URI
- **WHEN** 用户选择"手动输入"模式
- **THEN** 显示文本输入框
- **THEN** 支持直接输入完整 URI
- **THEN** 提供 URI 格式校验

---

### Requirement: 工具参数编辑器

系统 SHALL 提供智能的工具参数编辑器。

#### Scenario: 参数表单模式
- **WHEN** 选择工具后且工具有参数定义
- **THEN** 显示参数表单编辑器
- **THEN** 每个参数显示：名称、类型、是否必填、描述

#### Scenario: 参数值输入
- **WHEN** 用户编辑参数值
- **THEN** 支持直接输入值
- **THEN** 支持输入 GML 表达式
- **THEN** 支持从变量列表选择

#### Scenario: 参数自动补全
- **WHEN** 用户输入参数表达式
- **THEN** 自动补全上下文中可用的变量
- **THEN** 显示变量的类型信息

#### Scenario: GML 表达式模式
- **WHEN** 用户切换到"表达式模式"
- **THEN** 显示多行文本编辑器
- **THEN** 支持完整的 GML 语法
- **THEN** 提供语法高亮

---

### Requirement: 工具管理页面重构

系统 SHALL 重构 ToolsPage 为模块化结构。

#### Scenario: 服务管理模块
- **WHEN** 用户进入工具管理页面
- **THEN** 显示服务管理 Tab
- **THEN** 左侧显示服务列表（按类型分组）
- **THEN** 右侧显示选中服务的详情

#### Scenario: 服务创建向导
- **WHEN** 用户点击"创建服务"
- **THEN** 显示服务类型选择
- **THEN** 根据类型显示对应的配置表单
- **THEN** API 类型：base_url、认证配置
- **THEN** MCP 类型：服务器地址、传输方式
- **THEN** 数据源类型：连接字符串、数据库类型

#### Scenario: 服务工具列表
- **WHEN** 用户选中某个服务
- **THEN** 显示该服务下的所有工具
- **THEN** 工具列表可搜索、排序
- **THEN** 显示工具的使用统计（调用次数、成功率）

#### Scenario: 工具定义编辑
- **WHEN** 用户编辑工具定义
- **THEN** 可编辑工具的 code、name、description
- **THEN** 可编辑参数定义（args.defs、args.in、args.out）
- **THEN** 可配置扩展选项（opts）

---

### Requirement: API 端点管理

系统 SHALL 支持 API 服务的端点定义和管理。

#### Scenario: 添加 API 端点
- **WHEN** 用户在 API 服务下添加端点
- **THEN** 配置端点路径（如 `/users/{userId}`）
- **THEN** 配置 HTTP 方法（GET/POST/PUT/DELETE）
- **THEN** 配置请求参数（path/query/body）
- **THEN** 配置响应映射

#### Scenario: 路径参数定义
- **WHEN** 端点路径包含参数占位符 `{userId}`
- **THEN** 自动添加到参数定义
- **THEN** 标记为必填路径参数

#### Scenario: 请求体 Schema
- **WHEN** 端点方法为 POST/PUT
- **THEN** 支持定义请求体结构
- **THEN** 支持 JSON Schema 格式
- **THEN** 生成对应的 args.in 定义

#### Scenario: 响应映射
- **WHEN** 配置响应映射
- **THEN** 支持提取响应中的特定字段
- **THEN** 支持重命名字段
- **THEN** 生成对应的 args.out 定义

---

### Requirement: OpenAPI 导入

系统 SHALL 支持从 OpenAPI 规范导入工具定义。

#### Scenario: 上传 OpenAPI 文件
- **WHEN** 用户上传 OpenAPI 3.0 或 Swagger 2.0 文件
- **THEN** 系统解析规范文件
- **THEN** 显示可导入的端点列表

#### Scenario: 选择性导入
- **WHEN** 解析完成后
- **THEN** 用户可选择要导入的端点
- **THEN** 可批量选择或逐个选择
- **THEN** 预览将生成的工具定义

#### Scenario: 端点转工具
- **WHEN** 确认导入
- **THEN** 每个端点生成一个工具定义
- **THEN** 路径参数、查询参数转为 args.in
- **THEN** 响应 Schema 转为 args.out
- **THEN** 保留原始描述信息

#### Scenario: URL 导入
- **WHEN** 用户输入 OpenAPI 规范的 URL
- **THEN** 系统从 URL 获取规范内容
- **THEN** 支持带认证的 URL

---

### Requirement: 数据源管理增强

系统 SHALL 增强数据源管理界面能力。

#### Scenario: 数据源连接测试
- **WHEN** 用户点击"测试连接"
- **THEN** 系统尝试建立数据库连接
- **THEN** 显示连接状态（成功/失败）
- **THEN** 失败时显示详细错误信息

#### Scenario: 表结构浏览器
- **WHEN** 用户点击"浏览表结构"
- **THEN** 显示数据库中的所有表/集合
- **THEN** 支持搜索过滤
- **THEN** 点击表名展开字段列表

#### Scenario: 字段详情显示
- **WHEN** 用户展开某个表
- **THEN** 显示字段列表：名称、类型、可空、默认值、注释
- **THEN** 主键字段特殊标识
- **THEN** 支持复制字段名

#### Scenario: 同步表结构
- **WHEN** 用户点击"同步结构"
- **THEN** 系统从数据库获取最新结构
- **THEN** 更新本地元数据缓存
- **THEN** 生成/更新 CRUD 工具定义

#### Scenario: CQL 查询测试
- **WHEN** 用户在数据源详情中输入 CQL 表达式
- **WHEN** 点击"测试查询"
- **THEN** 系统执行查询并显示结果
- **THEN** 显示返回的记录数和耗时
- **THEN** 支持分页浏览结果

---

### Requirement: UDF 管理增强

系统 SHALL 增强 UDF 管理界面能力。

#### Scenario: UDF 代码编辑器
- **WHEN** 用户编辑 UDF 的 handler
- **THEN** 显示 Monaco Editor 代码编辑器
- **THEN** 根据 UDF 类型提供语法高亮（SQL/JavaScript/Python）
- **THEN** 支持代码折叠、搜索替换

#### Scenario: UDF 参数签名
- **WHEN** 用户定义 UDF 参数
- **THEN** 支持定义输入参数列表
- **THEN** 每个参数包含：名称、类型、是否必填、描述
- **THEN** 支持定义返回值类型

#### Scenario: UDF 测试执行
- **WHEN** 用户点击"测试"
- **THEN** 显示参数输入表单
- **WHEN** 填写参数并执行
- **THEN** 显示执行结果或错误信息
- **THEN** 显示执行耗时

#### Scenario: 内置 UDF 查看
- **WHEN** 用户查看内置 UDF
- **THEN** 显示为只读模式
- **THEN** 显示函数签名和使用示例
- **THEN** 不可编辑或删除

---

### Requirement: 工具测试功能

系统 SHALL 提供工具测试调用能力。

#### Scenario: 工具测试入口
- **WHEN** 用户在工具详情页点击"测试"
- **THEN** 显示测试对话框
- **THEN** 根据 args.in 生成参数输入表单

#### Scenario: 参数输入
- **WHEN** 填写测试参数
- **THEN** 支持 JSON 格式输入
- **THEN** 支持表单格式输入
- **THEN** 必填参数校验

#### Scenario: 执行测试
- **WHEN** 点击"执行"
- **THEN** 系统调用实际工具
- **THEN** 显示加载状态

#### Scenario: 测试结果展示
- **WHEN** 工具调用完成
- **THEN** 显示响应数据（JSON 格式化）
- **THEN** 显示状态（成功/失败）
- **THEN** 显示耗时
- **THEN** 失败时显示错误详情

#### Scenario: 请求日志
- **WHEN** 测试 API 类型工具
- **THEN** 显示实际发送的请求（URL、方法、头、体）
- **THEN** 显示响应详情（状态码、头、体）

---

### Requirement: 节点属性面板增强

系统 SHALL 增强节点属性编辑能力。

#### Scenario: ExecNode 属性编辑
- **WHEN** 用户选中 ExecNode
- **THEN** 属性面板显示：
  - 基本信息（label、description）
  - exec：工具选择器 + 手动输入切换
  - args：参数编辑器（表单/表达式切换）
  - with：结果转换表达式
  - sets：全局变量更新
  - only：条件执行表达式
  - fail：错误跳转节点选择

#### Scenario: 变量自动补全
- **WHEN** 用户编辑 GML 表达式字段
- **THEN** 触发自动补全时显示可用变量
- **THEN** 变量来源：流程输入参数、上游节点输出、vars 定义
- **THEN** 显示变量类型信息

#### Scenario: 表达式验证
- **WHEN** 用户输入 GML 表达式
- **THEN** 实时进行语法检查
- **THEN** 错误时显示红色下划线
- **THEN** 悬停显示错误详情

#### Scenario: fail 节点选择
- **WHEN** 用户编辑 fail 属性
- **THEN** 显示当前流程的节点下拉列表
- **THEN** 排除当前节点和其上游节点
- **THEN** 选择后自动创建错误跳转边

---

### Requirement: 变量面板

系统 SHALL 提供变量可视化面板。

#### Scenario: 变量面板显示
- **WHEN** 用户打开变量面板（或编辑表达式时）
- **THEN** 显示当前可用的所有变量
- **THEN** 按来源分组：输入参数、节点输出、全局变量

#### Scenario: 变量详情
- **WHEN** 用户点击某个变量
- **THEN** 显示变量的类型定义
- **THEN** 对于对象类型，展开显示字段列表
- **THEN** 支持复制变量路径

#### Scenario: 变量类型推导
- **WHEN** 变量来自节点输出
- **THEN** 根据节点的 with 表达式推导类型
- **THEN** 无法推导时显示为 `any`

#### Scenario: 变量插入
- **WHEN** 用户双击变量
- **THEN** 将变量路径插入到当前编辑的表达式中
- **THEN** 插入位置为光标位置

---

### Requirement: 连线类型增强

系统 SHALL 支持更丰富的节点连线类型。

#### Scenario: 正常流转连线
- **WHEN** 节点通过 next 连接
- **THEN** 显示实线箭头
- **THEN** 颜色为灰色

#### Scenario: 条件跳转连线
- **WHEN** 条件节点的 then 连线
- **THEN** 显示绿色实线，标签"是"
- **WHEN** 条件节点的 else 连线
- **THEN** 显示红色实线，标签"否"

#### Scenario: 错误跳转连线
- **WHEN** 节点配置了 fail 属性
- **THEN** 显示红色虚线
- **THEN** 标签显示"失败时"

#### Scenario: 多分支连线标签
- **WHEN** switch 节点的 case 连线
- **THEN** 每条连线显示对应的 when 条件摘要
- **THEN** else 连线显示"其他"

---

### Requirement: 新增节点类型 UI

系统 SHALL 为新增的工具服务节点提供 UI 组件。

#### Scenario: OSSNode 属性
- **WHEN** 用户选中 OSSNode
- **THEN** 属性面板显示：
  - 存储桶选择（从配置的 OSS 服务中）
  - 操作类型（load/save/list/delete/presign）
  - 对象路径（支持表达式）
  - 其他参数（根据操作类型变化）

#### Scenario: MQNode 属性
- **WHEN** 用户选中 MQNode
- **THEN** 属性面板显示：
  - 队列/主题选择
  - 操作类型（publish/subscribe）
  - 消息内容（publish 时）
  - 延迟设置（可选）

#### Scenario: MailNode 属性
- **WHEN** 用户选中 MailNode
- **THEN** 属性面板显示：
  - 邮件服务选择
  - 收件人（支持表达式）
  - 主题
  - 正文（支持 HTML 切换）
  - 附件配置
  - 模板选择（可选）

#### Scenario: SMSNode 属性
- **WHEN** 用户选中 SMSNode
- **THEN** 属性面板显示：
  - 短信服务选择
  - 手机号（支持表达式）
  - 内容或模板选择
  - 模板参数

#### Scenario: 节点面板分类
- **WHEN** 用户查看节点面板
- **THEN** 节点按功能分类显示：
  - 基础节点：Start、Mapping
  - 工具调用：Exec、Service、DB
  - 控制流程：Condition、Switch、Delay、Each、Loop
  - 消息服务：Mail、SMS、MQ
  - 存储服务：OSS
  - AI 能力：Agent、Guard、Approval、MCP、Handoff
