# FDL语言规格说明

## 1. 快速上手

FDL（Flow Definition Language）是一种面向业务流程编排的领域特定语言（DSL），
基于 YAML 语法设计，旨在以极简语法高效描述复杂业务流程。其核心特性包括：

- **隐式并行**：自动并行执行无依赖关系的节点。
- **显式依赖**：通过 `next` 属性声明后继节点，明确执行顺序。
- **变量绑定**: 节点的执行结果自动绑定至与其 `id` 同名的上下文变量，供后续节点引用。

以下是一个完整的 FDL 流程示例：

```yaml
flow:
    name: 客户视图构建流程
    desp: 根据客户标识、订单起始时间，获取指定客户的姓名和订单数量。
    args:
        in:
            customerId: string    # 客户标识（必填）
            from: DATE('-3M')     # 订单起始时间（可选），默认为最近3个月

        out:
            id: string            # 客户标识
            name: string          # 客户姓名
            orders: int           # 订单数量
    node:
        customer:
            name: 获取客户基本信息
            exec: api://crm-service/customer
            next: merge

        orderCount:
            name: 获取客户订单数量
            exec: db://ec.mysql.order/count
            args: exps = `customerId = ${customerId} && time > '${from}'`
            next: merge

        merge:
            name: 合并客户视图
            with: |
                ...customer            # 展开客户信息
                orders = orderCount    # 订单数量
```

> **格式约定**：FDL 使用标准 YAML 语法，所有层级缩进统一采用 **4 个空格**，以确保结构清晰和可读性。

#### 参数说明

- `name` 流程名称
- `desp` 流程描述信息（可选），用于说明流程功能
- `args` 流程参数定义（可选）
- `vars` 全局变量定义（可选）
- `node` 流程节点定义

#### 示例说明

- **输入参数**：
    - `customerId` 为必填项，用于查询指定客户；
    - `from` 为可选参数，默认值为当前时间前推三个月（`DATE('-3M')`）。

- **节点行为**：
    - `customer` 节点调用 CRM 系统 API，获取客户基础信息；
    - `orderCount` 节点查询 MySQL 数据库，统计满足条件的订单数量；
    - `merge` 节点使用 `GML` 合并上游两个节点的结果，生成最终输出。

- **执行模型**：
    - `customer` 与 `orderCount` 无依赖关系，并行执行；
    - 两者完成后，`merge` 节点聚合结果，生成完整的客户视图。

- **特殊节点**：
    - **起始节点**（未被任何 `next`/`then`/`else` 指向）在流程启动时并行执行；
    - **终止节点**（没有定义 `next`/`then`/`else` 参数）执行完毕即视为该路径完成；
    - **流程结束** 流程在所有可达的终止节点均完成后结束。

> ### 附：关于 GML 语言
>
> FDL 中的 `vars`（全局变量）、`args`（节点入参）、`with`（结果转换）和 `sets`（变量更新）等字段，均使用 **GML** 作为其内部表达式语言。
>
> GML 支持两种书写模式：
> - **单行模式**：使用普通字符串，多个赋值语句以英文逗号 `,` 分隔，适用于简单场景。
> - **多行模式**：使用 YAML 多行字符串（`|`），每条赋值语句独占一行，清晰易读；
>
> FDL 中使用 GML 时，在参数数量小写5个，且使用单行简写模式后，表达式长度小于80字符时，**应当优先使用单行简写的方式编写**。
> 
> 更多 GML 语法细节，请参见《GML语言规格说明》。

## 2. 参数定义

流程的输入与输出通过 `args` 节点进行声明。
该机制支持类型安全、默认值、可空性、数组及结构化对象复用，
是构建可维护、可复用业务流程的核心能力。

### 2.1 基本结构

- **输入参数**：通过 `args.in` 定义，用于接收调用方传入的数据。
- **输出参数**：通过 `args.out` 定义，用于向调用方返回结果。
- **复杂类型**: 通过 `args.defs` ，预定义结构化类型（如 `Order`、`Item`），供 `in` 或 `out` 引用。

> - 若流程无需输入或输出，可省略对应的 `in` 或 `out` 。
> - `in` 和 `out` 中定义的字段名称必须为英文、数值、或分隔线，且内部的多层嵌套及复杂对象必须通过 `defs` 定义。
> - 单一基元类型或数组的输出可简写为 `out: string` 或 `out: Order[]`。
> - 清晰的流程参数定义，有利于`其它流程`或`智能体`更好的调用和集成。

#### 示例 1：完整参数定义

```yaml
flow:
    name: 客户订单查询
    desp: 根据客户标识与订单起始时间，获取客户基本信息及其订单列表。
    args:
        defs:
            Order:                # 订单对象
                id: string        # 订单ID
                items: Item[]     # 订单明细列表
                quantity: int     # 商品总数量
                amount: decimal   # 订单总金额
            Item:                 # 订单明细对象
                sku: string       # SKU编码
                quantity: int     # 购买数量
        in:
            customerId: string    # 客户ID（必填）
            from: date?           # 订单起始时间（可选）
        out:
            id: string            # 客户ID
            name: string          # 客户姓名
            regTime: date         # 注册时间
            orders: Order[]       # 订单列表
```

> 注释格式：为保证良好的可读性，注释应使用 `#` 符号，并与所属的字段定义右对齐，且注释文本前至少保留四个空格的缩进。

#### 示例 2：简单输出定义

```yaml
flow:
    name: 会员问候语生成
    desp: 根据客户是否为会员，返回相应的个性化问候语。
    args:
        in:
            isMember: bool?    # 是否为会员（可选）
        out: string            # 问候语文本
```

### 2.2 支持的数据类型

FDL 内置以下基本（primitive）数据类型：

| 类型        | 说明                                                            |
|-----------|---------------------------------------------------------------|
| `bool`    | 布尔值（`true` / `false`）                                         |
| `int`     | 32 位整数                                                        |
| `long`    | 64 位整数                                                        |
| `double`  | 双精度浮点数                                                        |
| `decimal` | 高精度十进制数，适用于金额等场景                                              |
| `string`  | 字符串                                                           |
| `date`    | 日期时间，采用 ISO 8601 格式字符串表示（如 `'2025-12-01T10:30:00.000+08:00'`） |

> **注**：`date` 类型虽以字符串形式书写，但在运行时被解析为平台标准时间对象。

此外，FDL 还支持以下复合类型：

| 类型       | 说明                                                                            |
|----------|-------------------------------------------------------------------------------|
| `map<T>` | 键值对集合，其中键为字符串类型，值为泛型类型 `T`（例如 `map<string>`、`map<Order>`）。适用于动态结构或非固定字段的对象表示。 |
| `any`    | 任意类型。用于无法预知具体类型的场景。作为入参时，不会进行类型校验；作为出参时，不会进行自动裁剪。                             |

### 2.3 可空性与数组

- 在任意类型后添加 `?` 表示该参数可为空（nullable），例如 `string?`、`Order?`。
- 使用 `TypeName[]` 表示一维数组，如 `Item[]`；可空数组写作 `Order[]?`。

### 2.4 默认值支持

`args.in` 中的参数可指定默认值，默认值在调用方未提供对应参数时自动生效。来源包括：

- 字面量常量（如字符串、数字、布尔值）
- 用户自定义函数（UDF，如 `DATE()`）

#### 示例 3：带默认值的输入

```yaml
flow:
    name: 销售数据筛选
    desp: 根据渠道、支付状态、金额阈值及时间范围筛选销售记录。
    args:
        in:
            channel: string = 'pos'      # 渠道，默认为 'pos'
            minAmount: int = 100         # 最低金额，默认为 100
            paid: bool = true            # 是否已支付，默认为 true
            from: date = DATE('-30d')    # 起始日期，默认为30天前
            to: date = DATE()            # 截止日期，默认为当前日期
```

### 2.5 内置输入参数

FDL原生支持在多租户环境中运行，其 `args.in` 在运行时会自动注入以下2个标准参数，**无需显式定义**，即可在流程中直接引用：

- `tenantId: string`： 当前租户的唯一标识；
- `buCode: string`：当前业务单元的编码。

## 3. 流程节点

FDL 通过声明一系列**流程节点**（node）来编排业务逻辑。每个节点代表一个可执行单元，其行为由类型、输入、输出及依赖关系共同决定。

### 通用规则

- 所有节点在 `flow.node` 下定义，**节点 `id` 必须在流程内全局唯一**。
- 节点执行结果，自动绑定至与其 `id` 同名的`上下文变量`，供后续节点引用。
- 节点可以在其参数定义中，引用`args.in`及由其它节点输出的`上下文变量`。
- 节点无需显式声明类型，FDL 解析器会根据节点参数定义，自动推断出其类型。
- 节点可通过 `next` 声明一个或多个后继节点（多个 'id' 以逗号分隔），显式控制执行顺序。
- 节点 `next` 所指向的后续节点，应当在当前节点之后声明，以使脚本保持更好的可读性，但流程需要跳转到前序节点时除外。


### 子流程说明

`each` 和 `loop` 节点内部的 `node` 块构成一个**子流程**，遵循以下规则：

1. **变量可见性**  
   子流程节点可读取或更新，所有同级或父级上下文变量（包括流程输入、上游节点输出及当前控制变量）；

2. **执行模型**  
   完整支持 FDL 语义：隐式并行、显式依赖、条件跳转，起始与终止规则与主流程一致。

3. **跳转限制**  
   所有 `next`/`then`/`else` 等跳转目标**必须是同级 `node` 块内的节点 ID**，禁止跨层级跳转。

4. **生命周期**  
   外层流程等待子流程完全结束后继续执行； 

### 3.1 工具调用节点

工具调用节点是 FDL 中用于集成外部能力的核心执行单元，
支持调用 RESTful API、数据库操作、其它流程、AI 智能体、消息服务（如短信、邮件）等各类已注册工具。FDL
执行引擎通过内置的**工具注册表**与**数据库元信息注册表**，在运行时解析 `exec` 目标并自动校验参数合法性。

#### 节点参数

| 参数名    | 说明                                                                             |
|--------|--------------------------------------------------------------------------------|
| `exec` | 必填。指定要调用的工具目标，格式为 URI（如 `api://...` 或 `db://...`），详见下文。                        |
| `args` | 可选。以 GML 语法构造传递给工具的输入参数，可引用流程入参（如 `customerId`）或上游节点输出的上下文变量（如 `customer.id`）。 |
| `with` | 可选。工具调用成功后，使用 GML 对返回结果进行转换，生成当前节点的最终输出值；若未指定，则直接使用原始返回值。                      |
| `only` | 可选。布尔表达式，控制节点是否执行：仅当表达式求值为 `true` 时触发调用，否则跳过该节点（不影响流程继续执行）。                    |
| `next` | 可选。显式声明一个或多个后继节点 `id`（逗号分隔），用于构建执行依赖；若省略，则该节点为终止节点。                            |
| `fail` | 可选。指定当工具调用发生异常（如超时、网络错误等）时跳转的目标节点 `id`。未配置时，流程将立即终止，并返回错误信息。                   |

> **注意**：所有表达式字段（`args`、`with`、`only`）均使用 **GML 语言**编写，支持单行或多行模式。

#### 1. `exec` 参数详解

`exec` 字段采用标准 URI 格式定义调用目标：

```yaml
exec: <tool-type>://<tool-code>?[options]
```

- **`tool-type`**：工具类别，平台预定义以下类型：
    - `api`：调用已注册的 RESTful API；
    - `mcp`：调用已注册的 MCP 服务方法；
    - `db`：执行数据库操作（需通过 `type` 选项指定语义）；
    - `flow`：调用其它流程（需通过 `flow-id` 选项指定目标流程`id`）；
    - `agent`：调用已注册的 AI 智能体。

  其他类型（如 `oss`、`sms`）可通过插件机制扩展。

- **`tool-code`**：注册表中工具的唯一标识，例如：
    - `crm/customer`（CRM 系统中的客户查询接口）；
    - `ec.mysql.order/page`（对电商 MySQL 订单表进行分页查询）。

- **`options`**（可选）：以查询字符串形式提供调用选项，常用项包括：
    - `timeout=5000`：超时时间（毫秒）；
    - `max-attempts=3`：最大重试次数；

---

#### 2. `db` 类型操作说明

- `db` 类型用于操作关系型数据库（如 MySQL、PostgreSQL）、文档库（如 MongoDB）或搜索引擎（如 Elasticsearch）。
- `tool-code` 格式为 `<数据表>.<操作>`，例如 `ec.mysql.order/page`，其中 `ec.mysql.order` 为目标表，`page` 为操作类型。

支持的操作类型如下定义：

| 方法签名                                 | 说明                                                                                                                                                                                    |
|--------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `init()`                             | 初始化物理表结构（如创建表、索引等），通常用于部署或迁移阶段。                                                                                                                                                       |
| `drop()`                             | 删除对应物理表及其数据，谨慎使用。                                                                                                                                                                     |
| `take(id)`                           | 根据主键查询指定记录。                                                                                                                                                                           |
| `list(exps, proj, size, sort)`       | 查询记录列表：<br>• `exps`：CQL查询表达式，如 `status = 'active' && age > 18`；<br>• `proj`：返回字段列表，多个字段用逗号分隔，如 `'name, email, age'`；<br>• `size`：最多返回记录数（非分页）；<br>• `sort`：排序规则，如 `age DESC, id ASC`。 |
| `page(exps, proj, page, size, sort)` | 分页查询：<br>• `page`：页码（从 0 开始）；<br>• 其余参数同 `list`。                                                                                                                                      |
| `stream(exps, proj, sort)`           | 获取数据流，可使用`数据遍历节点`进行遍历处理。                                                                                                                                                              |
| `count(exps)`                        | 统计满足 CQL 条件的记录总数。                                                                                                                                                                     |
| `create(data)`                       | 插入单条记录，`data` 为对象字面量（如 `{name: "Alice", email: "a@example.com"}`）。                                                                                                                    |
| `modify(data)`                       | 更新已有记录，`data` 必须包含主键（如 `id`），仅更新非空字段。                                                                                                                                                 |
| `delete(id)`                         | 根据主键 `id` 删除单条记录。                                                                                                                                                                     |
| `save(data)`                         | 保存记录：若主键存在则更新，否则插入（即“upsert”）。                                                                                                                                                        |
| `bulk(dataList)`                     | 批量保存多条记录，`dataList` 为对象数组，每项执行 `save` 语义。                                                                                                                                             |
| `native(query)`                      | 执行原生查询语句，具体语法取决于底层数据库（如 SQL、MongoDB 聚合管道、ES DSL）。**注意：此方法绕过 CQL 安全校验，需严格管控权限。**                                                                                                       |

> **CQL 表达式说明**：CQL 是一种统一查询语言，语法接近自然条件表达式，支持 `=`, `!=`, `>`, `<`, `IN`, `LIKE`
> 等操作符，并自动转义为对应数据库的安全查询语句。

#### 3. `exec` 执行结果说明

- 工具调用 `exec` 执行完成后，其返回值会立即绑定为一个上下文变量，变量名等于当前节点的 `id`。
- 在工具调用的 `with`或 `sets`参数中，**必须通过当前节点的 `id` 来引用本次调用的输出结果**。例如：

```yaml
user:
    exec: api://crm-service/user
    with: name = user.name   # ✅ 正确：使用节点 id 访问自身结果
```

> **注意**：FDL 不提供 `response`、`output` 等隐式全局变量，请勿使用此类非标准写法。

---

#### 示例：客户通知发送流程

```yaml
flow:
    name: 客户通知发送流程
    desp: 根据客户标识查询其沟通偏好，并按偏好发送短信或邮件通知。
    args:
        in:
            customerId: string    # 客户唯一标识（必填）
    node:
        customer:
            name: 查询客户基本信息
            exec: db://crm.mongo.customer/take
            args: id = customerId, proj = 'preference, mobile, email'
            with: |
                preference = customer.preference || 'sms'
                mobile     = customer.mobile
                email      = customer.email
            next: sms, email

        sms:
            name: 发送短信通知
            exec: api://sms/send
            args: to = customer.mobile, content = '您的订单已发货'
            only: customer.preference == 'sms'

        email:
            name: 发送邮件通知
            exec: api://email/send
            args: to = customer.email, subject = '订单发货通知', body = '您的订单已发货'
            only: customer.preference == 'email'
```

在此流程中：

- `customer` 节点并行触发 `sms` 与 `email`；
- 两个通知节点通过 `only` 条件互斥执行；
- 所有节点均可安全引用 `customer` 输出的上下文变量。

#### 参数自动绑定

工具调用节点支持**参数自动绑定**：当工具声明了入参（如 `tenantId`、`buCode`、`channel`），
执行引擎会自动从以下来源匹配同名变量并注入：

- 流程输入参数（`args.in`）
- 上游节点输出的上下文变量（与节点 `id` 同名）

若所有入参均可自动匹配，`args` 可省略；若仅部分缺失或需覆盖（如仅 `channel` 未定义），
则 `args` 中只需显式指定缺失项，其余由引擎自动绑定。

#### 异常处理机制

- **默认行为**：若工具调用节点未配置 `fail` 参数，当发生异常（如超时、网络错误或服务返回错误）时，流程将立即终止，并返回相应的错误信息。
- **错误跳转**：若配置了 `fail` 参数，异常发生时流程不会终止，而是跳转至 `fail` 指定的节点，继续执行后续逻辑（通常用于错误处理或降级策略）。
- **错误信息注入**：当节点发生异常时，系统会自动将其上下文变量（以节点 `id` 为名）设为包含错误详情的对象。例如：
  ```json
  {
    "error": {
      "code": "0401",
      "message": "权限验证错误。"
    }
  }
  ```
- **错误信息访问**：下游节点可通过 `<节点id>.error`（如 `auth.error`）引用该异常信息，用于日志记录、条件判断或用户提示等场景。

#### 全局变量更新

- **工具调用节点**和**数据映射节点** 都提供了`sets` 参数，并在`with`参数前执行。
- `sets` 参数支持使用 GML 赋值语句，对任意同级或父级上下文变量（上游节点输出及当前控制变量）进行更新。

### 3.2 数据映射节点

数据映射节点用于在流程内部对已有数据进行结构重组、字段提取或简单计算，不触发任何外部调用。

#### 参数说明

| 参数 | 说明                                          |
|------|---------------------------------------------|
| `with` | **必填**。使用 GML 定义输出值，可引用流程输入或上游节点的上下文变量。     |
| `only` | 可选。布尔表达式，仅当结果为 `true` 时执行节点；否则跳过（无输出，流程继续）。 |
| `next` | 可选。指定后继节点 `id`（逗号分隔），省略则为终止节点。              |

> 不支持 `exec`、`args` 等字段。需外部调用时，请使用工具调用节点。

#### 示例

```yaml
mapping:
    name: 合并客户视图
    with: |
        ...customer                 # 展开对象语法 
        points = points.usable || 0 # 示例：为空时，给默认值
        orders
```

### 3.3 条件跳转

当一个节点同时包含 `when`、`then` 参数时，该节点被识别为**条件跳转节点**。

- `when`：定义判断条件（通常为布尔表达式）；
- `then`：指定条件成立（值为 `true`）时跳转的目标节点；
- `else`：指定条件不成立（值为 `false` 或 `null`）时跳转的目标节点。

> `else`为选填参数，若`when`条件不成立，且未定义 `else`，该流程分支将终止。

#### 示例：根据会员身份返回不同问候语

```yaml
flow:
    name: 问候语流程
    desp: 使用 if-else 节点，根据客户是否会员，返回不同的问候语。
    args:
        in:
            isMember: bool?   # 是否会员（可选）
        out: string?          # 问候语
    node:
        judge:
            name: 是否会员
            when: isMember == true
            then: greet_member
            else: greet_default

        greet_member:
            name: 会员问候
            with: '你好，尊敬的会员。'

        greet_default:
            name: 默认问候
            with: '你好，尊敬的用户。'
```


### 3.4 多分支跳转

当一个节点包含`case`参数时，被判定为多分支跳转节点。
适用于多分支场景，通过 `case` 列表依次匹配条件，命中则跳转至对应节点；
若无匹配，则跳转至 `else` 指定的默认节点。

> `else`为选填参数，若所有`when`条件都不成立，且未定义 `else`，该流程分支将终止。

#### 示例：根据客户性别返回不同问候语

```yaml
flow:
    name: 问候语流程
    desp: 使用 case 节点，根据客户性别，返回更适合的问候语。
    args:
        in:
            gender: string?   # 性别(可选)
        out: string           # 问候语
    node:
        judge:
            name: 性别判断
            case:
                -   when: gender == '男'
                    then: greet_male
                -   when: gender == '女'
                    then: greet_female
            else: greet_default

        greet_male:
            name: 男性问候
            with: '你好，先生。'

        greet_female:
            name: 女性问候
            with: '你好，女士。'

        greet_default:
            name: 默认问候
            with: '你好。'
```

### 3.5 延迟执行节点

延迟执行节点用于在流程中插入一个时间延迟。
当流程执行到该节点时，当前执行路径将被**挂起**，并在指定的等待时间结束后，自动恢复并继续执行 `next` 所指向的后续节点。

#### 参数说明

| 参数     | 说明                                                                                                      |
|--------|---------------------------------------------------------------------------------------------------------|
| `wait` | 等待时长。支持以下格式：<br>• **整数**：单位为毫秒，如 `5000` 表示等待 5 秒；<br>• **时间字符串**：如 '10s'（10 秒）、'20m'（20 分钟）、'1h'（1 小时）； |
| `only` | 可选。布尔表达式，仅当结果为 `true` 时执行延迟操作，否则直接结束延迟。                                                                 |
| `next` | 延迟结束后跳转的目标节点 `id`，多个 `id` 以英文逗号分隔。                                                                      |

#### 示例：固定等待 3 秒后发送通知

```yaml
flow:
    name: 延迟通知流程
    args:
        in:
            userId: string
    node:
        user:
            name: 读取客户信息
            exec: db://crm.user.profile/take
            args: id = userId, proj = 'mobile'
            next: delay

        delay:
            name: 等待3秒
            wait: '3s'
            next: sms

        sms:
            name: 发送欢迎消息
            exec: api://sms/send_welcome
            args: to = user.mobile, content = '欢迎加入'
            only: user.mobile != null
```
### 3.6 集合遍历节点

数据遍历节点用于对集合型数据（如列表、分组结果）进行逐项处理，为每个元素依次执行一个子流程。适用于批量通知、顺序校验、分片处理等场景。

#### 参数说明

| 参数     | 说明                                                                                                |
|--------|---------------------------------------------------------------------------------------------------|
| `each` | **必填**。格式为 `源变量 => 元素别名, 索引别名`。`源变量` 必须是已完成节点输出的数组或分组结构；`元素别名` 在子流程中代表当前项；`索引别名`（可选）为从 0 开始的整数索引。 |
| `vars` | **选填**。用 GML 赋值语句定义遍历前的初始变量，可在遍历节点及其子节点中直接引用或通过 `sets` 更新，无需通过遍历节点的 `id` 前缀访问                     |
| `node` | **必填**。定义子流程的节点结构，其内部可使用 `元素别名` 和 `索引别名` 引用当前迭代上下文。                                               |
| `with` | **选填**。指定遍历结束后对外输出的值（通常为累积结果，如`vars`中声明的变量）。若省略，则遍历节点无输出。                                         |

#### 执行行为

- 若源数据为空、非数组或未生成，子流程不执行；
- 各次迭代按元素顺序执行：前一次迭代完全结束后，才启动下一次；
- 每次迭代内的节点遵循 FDL 通用执行模型：无依赖则并行，有 `next` 则串行。
- 遍历结束后，流程继续执行后续节点（如有），并可将 `with` 指定的值绑定为上下文变量。

#### 示例：批量获取用户邮件列表

```yaml
flow:
    name: 批量获取用户信息
    desp: 根据用户标识列表，批量获取用户邮件列表。
    args:
        in:
            ids: string[]    # 用户标识列表（必填）
        out: string[]        # 用户邮件列表
    node:
        proc:
            name: 遍历获取用户邮件
            each: ids => id
            vars: mails = []
            node:
                user:
                    name: 获取用户信息
                    desp: 获取用户信息，并将邮件添加mails列表中。
                    exec: api://crm-service/user
                    args: userId = id
                    sets: mails = mails.add(user.mail)
            with: mails
```

#### 示例：按应用分组发送日志告警邮件

```yaml
flow:
    name: 发送日志告警邮件
    desp: 每5分钟检测最近5分钟的错误日志，按应用分组发送告警邮件。
    node:
        logs:
            name: 查询并分组错误日志
            exec: db://platform.es.logs/list
            args: exps = 'level = error && time >= TIME(-5m)', size = 1000
            with: logs.group('app_name')
            next: proc

        proc:
            name: 遍历分组发送邮件
            each: logs => item, index
            node:
                sendMail:
                    name: 发送告警邮件
                    exec: tool://mail-service/send
                    args: |
                        to      = `${item.key}-admin@lianwei.com.cn`
                        subject = '系统告警提醒'
                        content = `
                                  尊敬的管理员：
                                     您的应用在过去的5分钟，发生了${COUNT(item.val)}次告警。
                                     请您及时进行处理。
                                  `
```

### 3.7 条件循环节点

循环节点用于在流程中实现**有限次数的迭代逻辑**，典型场景包括分页加载、重试机制或状态轮询。通过初始化变量、条件判断与循环体内的状态更新，可安全地处理未知总量的数据集。

#### 参数说明

| 参数     | 说明                                                                            |
|--------|-------------------------------------------------------------------------------|
| `vars` | **必填**。用 GML 赋值语句定义循环前的初始变量，可在循环节点及其子节点中直接引用或通过 `sets` 更新，无需通过循环节点的 `id` 前缀访问 |
| `when` | **必填**。GML 布尔表达式，作为循环继续执行的条件；每次迭代前求值，为 `false` 时终止循环。                         |
| `node` | **必填**。定义循环体内的节点结构，可包含工具调用、映射、遍历等任意合法节点。                                      |
| `with` | **选填**。指定循环结束后对外输出的值（通常为累积结果，如 `orders`）。若省略，则循环无输出。                          |

> 循环体内节点可通过 `sets` 字段更新 `vars` 中定义的变量，实现状态推进（如 `curPage = curPage + 1`）。

#### 执行行为

- 循环开始前，先执行 `vars` 初始化；
- 每次迭代前检查 `when` 条件，若为 `true`，则启动本次迭代；
- 每次迭代内的节点遵循 FDL 通用执行模型：无依赖则并行，有 `next` 则串行。
- 仅当本次迭代中所有节点（包括其依赖链）全部完成后，才进入下一次迭代判断；
- 循环结束后，流程继续执行后续节点（如有），并可将 `with` 指定的值绑定为上下文变量。

#### 示例 1：分页加载全部订单

```yaml
flow:
    name: 循环节点示例
    desp: 分页读取所有订单，并返回完整订单集合。
    args:
        in:
            pageSize: 50  # 分页大小，可空，默认 50
    node:
        load:
            name: 循环读取订单
            vars: curPage = 0, pageNum = 1, orders = []
            when: curPage < pageNum
            node:
                orderPage:
                    name: 读取指定分页
                    exec: api://ec-service/order_page
                    args: page = curPage, size = pageSize
                    sets: |
                        curPage = curPage + 1
                        pageNum = orderPage.totalPages
                        orders  = orders.addAll(orderPage.content.proj('id, amount, time'))
            with: orders
```

- 初始 `pageNum = 1` 确保至少执行一次；
- 每次获取一页后更新总页数与结果集；
- 最终输出完整订单列表。

#### 示例 2：异步任务执行流程

```yaml
flow:
    name: 异步任务执行流程
    desp: 调用接口创建异步任务，并轮询检测任务执行状态，最多10次，每次间隔5秒。
    args:
        in:
            task: string    # 任务信息（JSON格式）
        out:
            taskId: string
            status: string
    node:
        createTask:
            name: 创建任务
            exec: api://dp-service/create_task
            next: waiting

        waiting:
            name: 轮询任务状态
            vars: count = 0, status = 'processing', taskId = createTask.taskId
            when: count < 10 && status == 'processing'
            node:
                check:
                    name: 检测任务状态
                    exec: api://dp-service/task_status
                    args: id = taskId
                    sets: count = count + 1, status = check.status
                    next: delay

                delay:
                    name: 等待5秒后继续轮询
                    wait: '5s'
                    only: status == 'processing'
            with: taskId, status
```

