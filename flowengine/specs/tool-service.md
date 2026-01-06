# ToolService设计说明

工具集模块，核心领域对象包含：`ToolService`(工具服务)和`Tool`（工具）。

## 1. 工具服务调用规范

所有工具服务调用必须遵循统一 URI 格式：  
**`tool-type://<tool-service-id>/<tool-id>?[options]`**

- **`tool-type`**：工具服务类型，用于区分调用类型（如 `mcp://`、`svc://` 等）；
- **`tool-service-id`**：工具服务的全局唯一标识，通常为服务名（如 `loyalty-portal`、`oms-service`）；
- **`tool-id`**：服务内部的具体工具或操作标识。
- **`options`**（可选）：以查询字符串形式提供调用选项，常用项包括：
    - `timeout=5000`：超时时间（毫秒）；
    - `max-attempts=3`：最大重试次数；
    - 对 `db` 类型，**必须**指定 `type`，取值为下述数据库操作方法之一。

## 2. 工具服务类型

ai-module工具集模块，可以通过管理界面对以下类型的`ToolService`和`Tool`进行管理和维护。

| 类型      | 服务     | 示例                                                                      |
|---------|--------|-------------------------------------------------------------------------|
| mcp://  | MCP    | `mcp://baidu_map/map_ip_location`<br>`mcp://loyalty/customer_take`      |
| svc://  | 微服务调用  | `svc://loyalty/customers_list`<br>`svc://loyalty/customers_create`      |
| api://  | Http调用 | `api://oms-service/sync_order`<br>`api://user-service/get_profile`      |
| oss://  | 对象存储   | `oss://sample-bucket/load`<br>`oss://sample-bucket/save`                |
| mq://   | 消息队列   | `mq://common-rabbit/cache_expire`<br>`mq://order-service/order_created` |
| mail:// | 电子邮件   | `mail://marketing/welcome`<br>`mail://it-service/notify`                |
| sms://  | 短信服务   | `sms://crm-sms/welcome`<br>`sms://crm-sms/verification_code`            |

- MCP服务支持标准 MCP主机，并支持使用微服务协议的 MCP主机接入
- 部分工具服务，在创建服务时，将自动创建其工具，如：对象存储。
- 工具服务基于SPI进行扩展。

## 3. 内置工具服务

ai-module同时内置了以下工具服务，可以供智能体和工作流进行调用。  
- 其中工作流、智能体工具服务的`tool-service-id`，默认为具体工作流、智能体的全局标识。
- 数据库工具服务的`tool-service-id`，默认为具体数据表的全局标识，`<tool-id>`用于标识所要执行的操作。

| 类型       | 服务  | 示例                             |
|----------|-----|--------------------------------|
| flow://  | 工作流 | `flow://sample-flow`           |
| agent:// | 智能体 | `agent://sample-agent`         |
| db://    | 数据库 | `db://crm.mongo.customer/page` |

- 数据库工具服务，`<tool-id>`可以指定的操作方法如下定义：

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
