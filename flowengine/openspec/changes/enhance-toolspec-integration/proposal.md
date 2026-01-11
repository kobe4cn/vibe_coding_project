# Change: 基于 ToolSpec 规范的全栈工具集成能力增强

## Why

当前 FlowEngine 系统在工具管理和流程执行方面存在以下核心问题：

### 1. ToolSpec 规范与实现的差距

新的 `ToolSpec.java` 定义了完整的工具规格，包括：
- **结构化参数定义** (`ToolArgs`): 包含 `defs`（类型定义）、`in`（输入参数）、`out`（输出参数）
- **工具元数据**: `type`、`code`、`name`、`desp`
- **扩展配置** (`ConfigOptions`): 支持主机、路径等自定义配置

但现有系统：
- **后端** (`fdl-tools`): 工具配置采用扁平化结构，缺乏 `args.defs` 类型定义能力
- **前端** (`ToolsPage`): 仅支持基础字段编辑，无法配置复杂参数模式
- **FDL 解析器**: 未完整解析工具调用时的参数类型校验

### 2. FDL/GML 规范与实现的差距

**FDL 方面**:
- `args.defs` 类型定义在画布编辑中无可视化支持
- 节点的 `only` 条件执行支持不完整
- `fail` 错误跳转节点未实现
- `sets` 全局变量更新功能缺失

**GML 方面**:
- 原型方法（如 `proj`、`group`、`collap`）实现不完整
- 时间原型方法 `offset()` 未实现
- CASE 表达式求值器缺失
- 字符串原型方法部分缺失

### 3. 前后端工具管理能力不统一

- **前端 ToolsPage**: 三个 Tab（API 服务、数据源、UDF）的编辑能力有限
- **后端 fdl-tools**:
  - `ApiServiceConfig` 缺少端点定义能力
  - `DatasourceConfig` 缺少表结构元数据
  - `UdfConfig` 缺少参数签名定义
- **工具发现**: 无法从已配置的工具生成 AI Agent 可用的工具列表

### 4. 流程节点能力缺口

基于 `tool-service.md` 定义的工具服务类型：

| 类型 | 规范定义 | 当前状态 |
|------|----------|----------|
| `mcp://` | MCP 服务调用 | MCPNode 存在但集成不完整 |
| `svc://` | 微服务调用 | 未实现 |
| `api://` | HTTP API 调用 | ExecNode 支持但无 endpoint 管理 |
| `oss://` | 对象存储 | 未实现 |
| `mq://` | 消息队列 | 未实现 |
| `mail://` | 电子邮件 | 未实现 |
| `sms://` | 短信服务 | 未实现 |
| `flow://` | 子流程调用 | ExecNode 支持但无选择器 |
| `agent://` | Agent 调用 | AgentNode 存在但配置能力弱 |
| `db://` | 数据库操作 | ExecNode 支持但无表结构感知 |

### 5. 执行器优化空间

- **并行执行**: 当前顺序执行，未实现无依赖节点并行
- **GML 求值**: `applyWithTransform()` 返回原值，表达式求值不完整
- **子流程**: each/loop 内部 node 块执行缺失
- **状态持久化**: 执行快照和断点恢复未完成

## What Changes

### Phase 1: ToolSpec 规范对齐

#### 1.1 工具参数模型统一
- **后端**: 扩展 `ToolConfig` 支持完整的 `ToolArgs` 结构
- **前端**: 增强 ToolsPage 的参数定义编辑能力
- **数据库**: 添加 `tool_args` 表存储参数定义

#### 1.2 工具发现与注册
- 实现工具自动发现机制
- 支持从 OpenAPI/Swagger 导入工具定义
- 生成 AI Agent 可调用的工具列表（符合 function calling 规范）

### Phase 2: FDL/GML 规范完善

#### 2.1 FDL 增强
- 画布支持 `args.defs` 类型定义的可视化编辑
- 实现节点 `only` 条件执行
- 实现 `fail` 错误跳转节点
- 实现 `sets` 全局变量更新
- 支持 `args.in` 默认值和内置参数（`tenantId`、`buCode`）

#### 2.2 GML 求值器完善
- 完整实现数组原型方法（`proj`、`group`、`collap`、`expand` 等）
- 实现 CASE 表达式
- 实现时间原型方法 `offset()`
- 实现字符串原型方法（`toLowerCase`、`toUpperCase`、`length`）
- 支持 `$` 临时变量和 `this` 作用域引用

### Phase 3: 工具管理能力增强

#### 3.1 API 服务管理
- 支持端点（Endpoint）定义和参数配置
- 支持 OpenAPI 规范导入
- 请求/响应映射配置
- 测试调用功能

#### 3.2 数据源管理
- 支持表结构元数据管理
- 支持字段定义和类型映射
- 连接测试和预览功能
- CQL 查询构建器

#### 3.3 UDF 管理
- 支持参数签名定义（输入/输出类型）
- 代码编辑器（SQL/JavaScript/Python）
- UDF 测试和调试

### Phase 4: 流程节点能力扩展

#### 4.1 新增工具服务节点
- **OSSNode**: 对象存储操作（load/save/list/delete）
- **MQNode**: 消息队列操作（publish/subscribe）
- **MailNode**: 邮件发送节点
- **SMSNode**: 短信发送节点
- **ServiceNode**: 微服务调用节点

#### 4.2 现有节点增强
- **ExecNode**: 支持工具选择器（从注册的工具中选择）
- **AgentNode**: 支持工具绑定和 handoff 配置
- **MCPNode**: 完整 MCP 协议集成

### Phase 5: 执行器优化

#### 5.1 并行执行
- 实现拓扑排序识别无依赖节点
- 并行调度无依赖节点执行
- 支持并行度配置

#### 5.2 GML 求值器
- 完整语法解析（基于 PEG/Pest）
- 表达式求值引擎
- 类型推导和校验

#### 5.3 子流程执行
- each 节点的迭代执行
- loop 节点的条件循环
- 变量作用域隔离

#### 5.4 状态持久化
- 执行快照保存
- 断点恢复机制
- 历史记录查询

## Impact

### 受影响的规格文件
- `fdl-spec.md` - 需要对应实现补全
- `gml-spec.md` - 需要对应实现补全
- `tool-service.md` - 需要完整实现

### 受影响的代码

**前端** (`flow-editor/`):
- `src/pages/ToolsPage.tsx` - 重构为完整工具管理
- `src/components/panels/PropertyPanel.tsx` - 扩展节点属性编辑
- `src/components/nodes/` - 新增 OSS/MQ/Mail/SMS/Service 节点
- `src/types/flow.ts` - 扩展类型定义
- `src/lib/storage/` - 工具配置存储

**后端** (`packages/fdl-rust/`):
- `fdl-tools/src/config.rs` - 扩展工具配置结构
- `fdl-tools/src/managed.rs` - 扩展工具注册表
- `fdl-executor/src/` - 并行执行和状态持久化
- `fdl-gml/src/` - GML 求值器完善
- `fdl-runtime/src/routes/tools.rs` - 工具管理 API

**新增模块**:
- `fdl-tools/src/discovery.rs` - 工具发现机制
- `fdl-tools/src/openapi.rs` - OpenAPI 导入
- `fdl-executor/src/parallel.rs` - 并行调度器

### 破坏性变更
- **ToolConfig 结构扩展**: 旧配置需要迁移，但保持向后兼容
- **数据库 Schema**: 需要添加新表，提供迁移脚本

### 新增依赖
- **后端**: `pest` (PEG 解析器), `chrono` (时间处理)
- **前端**: 无新增主要依赖

## 潜在问题与考量

### 1. 兼容性
- 现有流程定义需要平滑迁移
- 工具配置格式变更需要版本控制

### 2. 性能
- 并行执行需要控制并发度，避免资源耗尽
- GML 求值器需要缓存解析结果

### 3. 安全
- 工具调用需要权限控制
- UDF 执行需要沙箱隔离

### 4. 可维护性
- 节点类型过多可能导致复杂度上升
- 建议使用组合而非继承的节点设计

### 5. 测试覆盖
- 每个新节点需要单元测试
- GML 求值器需要完整的测试用例
- 需要端到端集成测试
