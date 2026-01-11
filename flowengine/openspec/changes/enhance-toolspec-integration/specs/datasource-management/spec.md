# 数据源管理与数据库操作规范

## ADDED Requirements

### Requirement: 数据库工具服务 (db://)

系统 SHALL 完整实现 tool-service.md 定义的 13 种数据库操作方法。

#### Scenario: 数据库 URI 格式
- **WHEN** 系统解析数据库工具 URI `db://crm.mongo.customer/page`
- **THEN** 解析出 tool-service-id 为 `crm.mongo.customer`（数据表全局标识）
- **THEN** 解析出 tool-id 为 `page`（操作方法）
- **THEN** 从数据源配置中获取连接信息

---

### Requirement: 表结构管理操作

系统 SHALL 支持数据库表的结构管理操作。

#### Scenario: init() - 初始化表结构
- **WHEN** 执行 `db://crm.mongo.customer/init`
- **THEN** 系统根据配置创建物理表结构
- **THEN** 创建必要的索引
- **THEN** 返回初始化结果（成功/已存在/失败）

#### Scenario: drop() - 删除表
- **WHEN** 执行 `db://crm.mongo.customer/drop`
- **THEN** 系统删除物理表及其所有数据
- **THEN** 返回删除结果
- **THEN** 该操作需要特殊权限验证

---

### Requirement: 单记录查询操作

系统 SHALL 支持基于主键的单记录查询。

#### Scenario: take(id) - 主键查询
- **WHEN** 执行 `db://crm.mongo.customer/take`
- **WHEN** 参数包含 `{id: "C001"}`
- **THEN** 系统根据主键查询指定记录
- **THEN** 返回完整的记录对象
- **THEN** 记录不存在时返回 null

#### Scenario: take 支持复合主键
- **WHEN** 表配置为复合主键 `[tenantId, id]`
- **WHEN** 参数包含 `{tenantId: "T001", id: "C001"}`
- **THEN** 系统使用复合主键查询记录

---

### Requirement: 列表查询操作

系统 SHALL 支持基于 CQL 表达式的列表查询。

#### Scenario: list(exps, proj, size, sort) - 列表查询
- **WHEN** 执行 `db://ec.mysql.order/list`
- **WHEN** 参数包含：
  ```
  exps = "status = 'active' && amount > 100"
  proj = "id, customerId, amount, time"
  size = 50
  sort = "time DESC"
  ```
- **THEN** 系统将 CQL 表达式转换为数据库原生查询
- **THEN** 仅返回指定的字段（投影）
- **THEN** 最多返回 50 条记录
- **THEN** 按 time 降序排列

#### Scenario: list 默认参数
- **WHEN** 仅提供 exps 参数
- **THEN** proj 默认返回所有字段
- **THEN** size 默认为 100
- **THEN** sort 默认按主键升序

#### Scenario: list 空结果
- **WHEN** CQL 表达式无匹配记录
- **THEN** 返回空数组 `[]`

---

### Requirement: 分页查询操作

系统 SHALL 支持分页查询能力。

#### Scenario: page(exps, proj, page, size, sort) - 分页查询
- **WHEN** 执行 `db://ec.mysql.order/page`
- **WHEN** 参数包含：
  ```
  exps = "customerId = 'C001'"
  proj = "id, amount, time"
  page = 0
  size = 20
  sort = "time DESC"
  ```
- **THEN** 系统执行分页查询
- **THEN** 返回结构化分页结果

#### Scenario: page 返回结构
- **WHEN** 分页查询执行成功
- **THEN** 返回对象包含：
  ```json
  {
    "content": [...],      // 当前页数据
    "page": 0,             // 当前页码（从 0 开始）
    "size": 20,            // 每页大小
    "totalElements": 156,  // 总记录数
    "totalPages": 8,       // 总页数
    "first": true,         // 是否第一页
    "last": false          // 是否最后一页
  }
  ```

#### Scenario: page 越界处理
- **WHEN** 请求的页码超出范围
- **THEN** 返回空 content 数组
- **THEN** 保留正确的 totalElements 和 totalPages

---

### Requirement: 数据流查询操作

系统 SHALL 支持流式数据查询，用于大数据量处理。

#### Scenario: stream(exps, proj, sort) - 流式查询
- **WHEN** 执行 `db://platform.es.logs/stream`
- **WHEN** 参数包含 `{exps: "level = 'error'", proj: "time, message", sort: "time ASC"}`
- **THEN** 系统返回数据流对象
- **THEN** 可与 `each` 节点配合进行遍历处理

#### Scenario: stream 配合 each 节点
- **WHEN** 流程中 logs 节点使用 stream 查询
- **WHEN** proc 节点配置 `each: logs => log`
- **THEN** each 节点按批次迭代处理流数据
- **THEN** 每批次处理完成后获取下一批
- **THEN** 流结束时完成遍历

#### Scenario: stream 批次大小
- **WHEN** 配置 `batchSize=100`
- **THEN** 每次从数据库获取 100 条记录
- **THEN** 平衡内存使用和查询效率

---

### Requirement: 统计查询操作

系统 SHALL 支持记录数统计。

#### Scenario: count(exps) - 统计记录数
- **WHEN** 执行 `db://crm.mongo.customer/count`
- **WHEN** 参数包含 `{exps: "status = 'active' && age >= 18"}`
- **THEN** 系统返回满足条件的记录总数
- **THEN** 返回整数值

#### Scenario: count 无条件统计
- **WHEN** exps 为空或 `"1=1"`
- **THEN** 返回表中所有记录的总数

---

### Requirement: 单记录写入操作

系统 SHALL 支持单记录的增删改操作。

#### Scenario: create(data) - 插入记录
- **WHEN** 执行 `db://crm.mongo.customer/create`
- **WHEN** 参数包含 `{data: {name: "Alice", email: "alice@example.com", age: 25}}`
- **THEN** 系统插入新记录
- **THEN** 自动生成主键（如未提供）
- **THEN** 返回插入的完整记录（含主键）

#### Scenario: create 主键冲突
- **WHEN** 插入的记录主键已存在
- **THEN** 返回主键冲突错误
- **THEN** 不覆盖已有记录

#### Scenario: modify(data) - 更新记录
- **WHEN** 执行 `db://crm.mongo.customer/modify`
- **WHEN** 参数包含 `{data: {id: "C001", email: "new@example.com"}}`
- **THEN** 系统根据主键更新记录
- **THEN** 仅更新非 null 字段
- **THEN** 返回更新后的完整记录

#### Scenario: modify 记录不存在
- **WHEN** 更新的记录主键不存在
- **THEN** 返回记录不存在错误
- **THEN** 不自动创建新记录

#### Scenario: delete(id) - 删除记录
- **WHEN** 执行 `db://crm.mongo.customer/delete`
- **WHEN** 参数包含 `{id: "C001"}`
- **THEN** 系统根据主键删除记录
- **THEN** 返回删除成功/失败状态

#### Scenario: delete 记录不存在
- **WHEN** 删除的记录不存在
- **THEN** 返回成功（幂等操作）

---

### Requirement: Upsert 操作

系统 SHALL 支持"存在则更新，不存在则插入"的操作。

#### Scenario: save(data) - Upsert 操作
- **WHEN** 执行 `db://crm.mongo.customer/save`
- **WHEN** 参数包含 `{data: {id: "C001", name: "Alice", email: "alice@example.com"}}`
- **WHEN** id="C001" 的记录已存在
- **THEN** 系统更新该记录

#### Scenario: save 记录不存在
- **WHEN** 执行 `db://crm.mongo.customer/save`
- **WHEN** id="C002" 的记录不存在
- **THEN** 系统插入新记录

---

### Requirement: 批量写入操作

系统 SHALL 支持批量数据写入。

#### Scenario: bulk(dataList) - 批量保存
- **WHEN** 执行 `db://crm.mongo.customer/bulk`
- **WHEN** 参数包含：
  ```json
  {
    "dataList": [
      {"id": "C001", "name": "Alice"},
      {"id": "C002", "name": "Bob"},
      {"name": "Charlie"}  // 无主键，将自动生成
    ]
  }
  ```
- **THEN** 系统对每条记录执行 save 语义
- **THEN** 返回处理结果数组（成功/失败）

#### Scenario: bulk 部分失败
- **WHEN** 批量操作中部分记录失败
- **THEN** 成功的记录正常保存
- **THEN** 返回详细的成功/失败状态列表
- **THEN** 不进行整体回滚（非事务）

#### Scenario: bulk 事务模式
- **WHEN** 配置 `transactional=true`
- **THEN** 所有记录在同一事务中执行
- **THEN** 任一失败则全部回滚

---

### Requirement: 原生查询操作

系统 SHALL 支持绕过 CQL 的原生查询。

#### Scenario: native(query) - SQL 原生查询
- **WHEN** 执行 `db://ec.mysql.order/native`
- **WHEN** 数据源类型为 MySQL
- **WHEN** 参数包含 `{query: "SELECT * FROM orders WHERE JSON_EXTRACT(meta, '$.vip') = true"}`
- **THEN** 系统直接执行 SQL 语句
- **THEN** 返回查询结果

#### Scenario: native - MongoDB 聚合管道
- **WHEN** 执行 `db://crm.mongo.customer/native`
- **WHEN** 数据源类型为 MongoDB
- **WHEN** 参数包含 MongoDB 聚合管道 JSON
- **THEN** 系统执行聚合管道查询
- **THEN** 返回聚合结果

#### Scenario: native - Elasticsearch DSL
- **WHEN** 执行 `db://platform.es.logs/native`
- **WHEN** 数据源类型为 Elasticsearch
- **WHEN** 参数包含 ES DSL 查询
- **THEN** 系统执行 DSL 查询
- **THEN** 返回搜索结果

#### Scenario: native 权限控制
- **WHEN** 用户尝试执行 native 查询
- **THEN** 系统验证用户具有 native 执行权限
- **THEN** 无权限时返回权限拒绝错误

---

### Requirement: CQL 查询表达式

系统 SHALL 实现 CQL（Common Query Language）统一查询语法解析。

#### Scenario: CQL 比较操作符
- **WHEN** CQL 表达式包含比较操作符
- **THEN** 系统支持：`=`, `!=`, `>`, `<`, `>=`, `<=`
- **THEN** 正确转换为对应数据库语法

#### Scenario: CQL 逻辑操作符
- **WHEN** CQL 表达式包含逻辑操作符
- **THEN** 系统支持：`&&`（AND）, `||`（OR）, `!`（NOT）
- **THEN** 正确处理操作符优先级

#### Scenario: CQL IN 操作符
- **WHEN** CQL 表达式为 `status IN ('active', 'pending')`
- **THEN** 转换为 SQL: `status IN ('active', 'pending')`
- **THEN** 转换为 MongoDB: `{status: {$in: ['active', 'pending']}}`

#### Scenario: CQL LIKE 操作符
- **WHEN** CQL 表达式为 `name LIKE '%Alice%'`
- **THEN** 转换为 SQL: `name LIKE '%Alice%'`
- **THEN** 转换为 MongoDB: `{name: {$regex: 'Alice'}}`

#### Scenario: CQL 字段路径
- **WHEN** CQL 表达式为 `address.city = 'Beijing'`
- **THEN** 系统支持点语法访问嵌套字段
- **THEN** SQL 根据数据库 JSON 函数转换
- **THEN** MongoDB 直接使用点语法

#### Scenario: CQL 参数绑定
- **WHEN** CQL 表达式包含变量引用 `${customerId}`
- **THEN** 系统从执行上下文获取变量值
- **THEN** 使用参数化查询防止注入

#### Scenario: CQL 语法错误
- **WHEN** CQL 表达式语法错误
- **THEN** 系统返回解析错误
- **THEN** 错误信息包含错误位置和原因

---

### Requirement: 数据源配置管理

系统 SHALL 提供完整的数据源配置管理能力。

#### Scenario: 创建数据源配置
- **WHEN** 用户创建数据源
- **THEN** 系统保存以下配置：
  - name: 数据源标识（如 `crm.mongo.customer`）
  - display_name: 显示名称
  - db_type: 数据库类型
  - connection_string: 连接字符串
  - schema: 数据库 Schema（可选）
  - table: 默认表名（可选）
  - pool_size: 连接池大小（默认 10）
  - timeout_ms: 超时时间（默认 30000）
  - read_only: 是否只读
  - enabled: 是否启用

#### Scenario: 支持的数据库类型
- **WHEN** 用户选择数据库类型
- **THEN** 系统支持以下类型：
  - MySQL
  - PostgreSQL
  - SQLite
  - MongoDB
  - Redis
  - Elasticsearch
  - ClickHouse

#### Scenario: 连接测试
- **WHEN** 用户点击"测试连接"
- **THEN** 系统尝试建立数据库连接
- **THEN** 返回连接成功或失败信息
- **THEN** 失败时显示具体错误原因

#### Scenario: 只读数据源限制
- **WHEN** 数据源配置为 read_only = true
- **WHEN** 尝试执行 create、modify、delete、save、bulk 操作
- **THEN** 系统返回只读限制错误
- **THEN** 仅允许 take、list、page、count、stream 操作

---

### Requirement: 表结构元数据管理

系统 SHALL 支持表结构元数据的获取和管理。

#### Scenario: 获取表列表
- **WHEN** 用户请求数据源的表列表
- **THEN** 系统查询数据库元数据
- **THEN** 返回表名列表（包含 schema 信息）

#### Scenario: 获取字段定义
- **WHEN** 用户选择某个表
- **THEN** 系统返回字段定义列表：
  - 字段名
  - 数据类型
  - 是否可空
  - 默认值
  - 是否主键
  - 注释/描述

#### Scenario: 同步表结构
- **WHEN** 用户点击"同步结构"
- **THEN** 系统从数据库重新获取最新结构
- **THEN** 更新本地缓存的元数据

#### Scenario: 自动生成 CRUD 工具
- **WHEN** 同步表结构成功
- **THEN** 系统自动为该表生成标准工具：
  - `{datasource}/take` - 主键查询
  - `{datasource}/list` - 列表查询
  - `{datasource}/page` - 分页查询
  - `{datasource}/count` - 计数
  - `{datasource}/create` - 新增
  - `{datasource}/modify` - 更新
  - `{datasource}/delete` - 删除
  - `{datasource}/save` - Upsert
  - `{datasource}/bulk` - 批量保存

---

### Requirement: 多租户数据隔离

系统 SHALL 在数据库操作中支持多租户数据隔离。

#### Scenario: 自动注入租户条件
- **WHEN** 执行数据库查询操作
- **WHEN** 表配置为多租户模式
- **THEN** 系统自动在 CQL 条件中添加 `tenantId = ${tenantId}`
- **THEN** 用户无法查询其他租户的数据

#### Scenario: 自动填充租户字段
- **WHEN** 执行 create 或 save 操作
- **THEN** 系统自动填充 tenantId 字段
- **THEN** 即使用户提供了 tenantId 也使用上下文中的值

#### Scenario: 禁用租户隔离
- **WHEN** 数据源配置 multi_tenant = false
- **THEN** 不自动添加租户条件
- **THEN** 允许跨租户查询（需要特殊权限）
