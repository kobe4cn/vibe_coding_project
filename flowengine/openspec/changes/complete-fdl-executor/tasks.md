# Implementation Tasks

## Phase 1: Frontend Flow Management

### 1. Storage Abstraction Layer

- [x] 1.1 创建 `flow-editor/src/lib/storage/types.ts` - 类型定义
  - [x] 1.1.1 FlowEntry 接口
  - [x] 1.1.2 FlowVersion 接口
  - [x] 1.1.3 StorageProvider 接口
  - [x] 1.1.4 ListOptions 接口
- [x] 1.2 创建 `flow-editor/src/lib/storage/indexeddb-provider.ts`
  - [x] 1.2.1 listFlows 实现
  - [x] 1.2.2 getFlow/createFlow/updateFlow/deleteFlow 实现
  - [x] 1.2.3 listVersions/getVersion/saveVersion/deleteVersion 实现
- [x] 1.3 创建 `flow-editor/src/lib/storage/context.tsx` - React Context
  - [x] 1.3.1 StorageContext 和 StorageProvider 组件
  - [x] 1.3.2 useStorage hook
- [x] 1.4 编写存储层单元测试

### 2. Data Migration

- [x] 2.1 创建 `flow-editor/src/lib/storage/migration.ts`
  - [x] 2.1.1 检测旧版数据
  - [x] 2.1.2 迁移流程元数据
  - [x] 2.1.3 迁移版本数据
  - [x] 2.1.4 清理旧数据
- [x] 2.2 创建迁移 UI 组件
  - [x] 2.2.1 MigrationDialog 组件
  - [x] 2.2.2 迁移进度显示
  - [x] 2.2.3 迁移结果反馈
- [x] 2.3 编写迁移测试

### 3. Flow List Page

- [x] 3.1 添加 React Router 依赖
  - [x] 3.1.1 `npm install react-router-dom`
  - [x] 3.1.2 更新 tsconfig 配置
- [x] 3.2 创建 `flow-editor/src/pages/FlowListPage.tsx`
  - [x] 3.2.1 页面布局（Header + Grid）
  - [x] 3.2.2 搜索框组件
  - [x] 3.2.3 排序/筛选控件
  - [x] 3.2.4 空状态显示
- [x] 3.3 创建 `flow-editor/src/components/flows/FlowCard.tsx`
  - [x] 3.3.1 卡片布局
  - [x] 3.3.2 缩略图显示
  - [x] 3.3.3 元信息显示（名称、版本数、时间）
  - [x] 3.3.4 快捷操作按钮
- [x] 3.4 创建 `flow-editor/src/components/flows/CreateFlowDialog.tsx`
  - [x] 3.4.1 创建表单（名称、描述）
  - [x] 3.4.2 从模板创建选项
- [x] 3.5 创建 `flow-editor/src/components/flows/FlowActions.tsx`
  - [x] 3.5.1 复制流程功能
  - [x] 3.5.2 导出流程功能
  - [x] 3.5.3 删除流程确认
- [ ] 3.6 编写页面组件测试 (nice-to-have, 留待后续)

### 4. Router Setup

- [x] 4.1 重构 `flow-editor/src/App.tsx`
  - [x] 4.1.1 添加 BrowserRouter
  - [x] 4.1.2 定义路由结构
  - [x] 4.1.3 添加 404 页面
- [x] 4.2 创建 `flow-editor/src/pages/FlowEditorPage.tsx`
  - [x] 4.2.1 加载流程数据
  - [x] 4.2.2 集成现有 FlowCanvas
  - [x] 4.2.3 处理 isNew 和 readOnly 模式
- [x] 4.3 更新导航
  - [x] 4.3.1 Header 添加返回列表链接
  - [x] 4.3.2 面包屑导航
- [x] 4.4 处理路由参数
  - [x] 4.4.1 flowId 参数解析
  - [x] 4.4.2 versionId 参数解析（查看历史版本）

### 5. Version Panel Integration

- [x] 5.1 重构 `flow-editor/src/components/panels/VersionPanel.tsx`
  - [x] 5.1.1 使用 StorageProvider
  - [x] 5.1.2 移除直接 IndexedDB 访问
- [x] 5.2 更新 `flow-editor/src/lib/versionHistory.ts`
  - [x] 5.2.1 集成 StorageProvider
  - [x] 5.2.2 保持 API 兼容
- [x] 5.3 添加版本预览功能
  - [x] 5.3.1 点击版本进入只读预览
  - [ ] 5.3.2 版本对比视图

### 6. Flow Store Enhancement

- [x] 6.1 更新 `flow-editor/src/stores/flowStore.ts`
  - [x] 6.1.1 添加 flowId 状态
  - [x] 6.1.2 添加 isReadOnly 状态
  - [x] 6.1.3 添加 loadFlow/saveFlow actions
  - [x] 6.1.4 添加 setIsDirty action
- [x] 6.2 创建 `flow-editor/src/stores/flowListStore.ts`
  - [x] 6.2.1 流程列表状态
  - [x] 6.2.2 搜索/筛选状态
  - [x] 6.2.3 分页状态
- [x] 6.3 编写 store 测试

### 7. Import/Export

- [x] 7.1 创建 `flow-editor/src/lib/flowExport.ts`
  - [x] 7.1.1 导出单个流程（含版本历史）
  - [x] 7.1.2 导出多个流程
  - [x] 7.1.3 JSON/ZIP 格式
- [x] 7.2 创建 `flow-editor/src/lib/flowImport.ts`
  - [x] 7.2.1 导入单个流程
  - [x] 7.2.2 导入多个流程
  - [x] 7.2.3 冲突处理（重命名/覆盖）
- [x] 7.3 创建导入/导出 UI
  - [x] 7.3.1 导出对话框
  - [x] 7.3.2 导入对话框
  - [x] 7.3.3 进度显示

### 8. Flow Thumbnail Generation

- [x] 8.1 创建缩略图生成服务
  - [x] 8.1.1 使用 React Flow 导出 SVG
  - [x] 8.1.2 转换为 Base64 PNG
  - [x] 8.1.3 压缩和尺寸限制
- [ ] 8.2 集成到保存流程
  - [ ] 8.2.1 保存时自动生成缩略图
  - [ ] 8.2.2 更新流程元数据

---

## Phase 2: Rust Backend Core

### 9. Rust Workspace Setup

- [x] 9.1 创建 `packages/fdl-rust/Cargo.toml` workspace
- [x] 9.2 创建 `fdl-executor` crate 结构
- [x] 9.3 创建 `fdl-gml` crate 结构
- [x] 9.4 创建 `fdl-auth` crate 结构
- [x] 9.5 创建 `fdl-tools` crate 结构
- [x] 9.6 创建 `fdl-runtime` crate 结构
- [x] 9.7 配置 workspace 依赖和 Rust 2024 edition

### 10. GML Expression Engine (TypeScript)

- [x] 10.1 创建 `packages/fdl-parser/src/gml/types.ts` - GML 类型定义 (已存在于 fdl-parser)
- [x] 10.2 创建 `packages/fdl-parser/src/gml/parser.ts` - 词法分析器和语法解析器 (已存在于 fdl-parser)
- [x] 10.3 创建 `packages/fdl-parser/src/gml/evaluator.ts` - 表达式求值器 (已存在于 fdl-parser)
- [x] 10.4 内置函数库 (DATE, TIME, NOW, COUNT, SUM, AVG, MIN, MAX 等)
- [x] 10.5 实现字符串模板插值 `` `${var}` ``
- [x] 10.6 实现 CASE WHEN 表达式
- [x] 10.7 实现数组原型方法 (filter, map, reduce, sum, group, distinct 等)
- [x] 10.8 实现空值安全访问 (`?.`)
- [x] 10.9 编写 GML 引擎单元测试 (111 tests in gml.test.ts)

### 11. Parallel Execution Scheduler (TypeScript)

- [x] 11.1 创建 `packages/fdl-runtime/src/scheduler.ts` - 并行调度器
- [x] 11.2 实现依赖图构建和拓扑排序 (Kahn's algorithm)
- [x] 11.3 实现无依赖节点并行执行 (getReadyNodes, executeParallel)
- [x] 11.4 实现汇聚节点等待机制 (findConvergencePoints)
- [x] 11.5 更新 `executor.ts` 集成 GML 引擎
- [x] 11.6 编写调度器单元测试 (26 tests in scheduler.test.ts)

### 12. Sub-flow Execution (TypeScript)

- [x] 12.1 实现 `executeEachNode` 子流程递归执行 (支持并行/顺序执行)
- [x] 12.2 实现 `executeLoopNode` 子流程递归执行 (支持 break/continue)
- [x] 12.3 实现子流程变量作用域隔离
- [x] 12.4 实现子流程执行状态事件 (迭代索引上下文)
- [x] 12.5 编写子流程执行测试 (27 tests in executor.test.ts)

### 13. Rust GML Engine (fdl-gml)

- [x] 13.1 实现 `lexer.rs` - 词法分析
- [x] 13.2 实现 `parser.rs` - 语法解析 (AST)
- [x] 13.3 实现 `evaluator.rs` - AST 求值
- [x] 13.4 实现 `functions.rs` - 内置函数
  - [x] 13.4.1 数学函数: SUM, AVG, MIN, MAX, ROUND, FLOOR, CEIL, ABS
  - [x] 13.4.2 字符串函数: CONCAT, UPPER, LOWER, TRIM, LENGTH, SUBSTRING, REPLACE, SPLIT
  - [x] 13.4.3 日期函数: DATE, NOW, TIME, FORMAT_DATE
  - [x] 13.4.4 数组函数: COUNT, FIRST, LAST (方法链: filter, map, reduce 在 evaluator 中实现)
- [x] 13.5 编写 GML 引擎测试 (35 tests passing)

### 14. Rust Core Executor (fdl-executor)

- [x] 14.1 定义 `types.rs` - 节点、边、上下文类型
- [x] 14.2 实现 `context.rs` - 执行上下文管理
- [x] 14.3 实现 `scheduler.rs` - Tokio 并行调度
- [x] 14.4 实现节点执行器:
  - [x] 14.4.1 `nodes/exec.rs` - 工具调用节点
  - [x] 14.4.2 `nodes/mapping.rs` - 数据映射节点
  - [x] 14.4.3 `nodes/condition.rs` - 条件跳转节点
  - [x] 14.4.4 `nodes/switch.rs` - 多分支节点
  - [x] 14.4.5 `nodes/delay.rs` - 延迟节点
  - [x] 14.4.6 `nodes/each.rs` - 集合遍历节点
  - [x] 14.4.7 `nodes/loop.rs` - 条件循环节点
  - [x] 14.4.8 `nodes/agent.rs` - AI Agent 节点
  - [x] 14.4.9 `nodes/mcp.rs` - MCP 调用节点
- [x] 14.5 实现 `error.rs` - 错误处理 (thiserror)
- [x] 14.6 编写执行器集成测试 (46 tests passing)

### 15. Rust Tool Handlers (fdl-tools)

- [x] 15.1 定义 `ToolHandler` trait (registry.rs)
- [x] 15.2 实现 `api.rs` - HTTP API 调用 (reqwest)
- [x] 15.3 实现 `database.rs` - 数据库查询 (基础结构)
- [x] 15.4 实现 `mcp.rs` - MCP 服务调用 (基础结构)
- [x] 15.5 实现工具注册和发现机制 (registry.rs)
- [x] 15.6 编写工具调用测试 (21 tests passing)

### 16. Rust Authentication (fdl-auth)

- [x] 16.1 实现 `jwt.rs` - JWT 生成和验证
  - [x] 16.1.1 Claims 结构定义
  - [x] 16.1.2 Token 生成 (jsonwebtoken)
  - [x] 16.1.3 Token 验证和解析
  - [x] 16.1.4 Token 刷新机制 (generate_refresh_token)
- [x] 16.2 实现 `middleware.rs` - Axum 认证中间件
  - [x] 16.2.1 Bearer Token 提取 (extract_bearer_token)
  - [x] 16.2.2 Claims 注入到请求扩展 (AuthLayer)
  - [x] 16.2.3 可选认证中间件（开发环境）- dev_mode support
- [x] 16.3 实现 `rbac.rs` - 角色权限控制
  - [x] 16.3.1 Permission 枚举定义
  - [x] 16.3.2 Role 枚举和权限映射
  - [x] 16.3.3 权限检查函数 (has_permission, require_permission)
- [x] 16.4 实现 `tenant.rs` - 多租户支持
  - [x] 16.4.1 TenantContext 结构
  - [x] 16.4.2 TenantConfig 配置
  - [x] 16.4.3 TenantQuota 和 TenantUsage 结构
- [x] 16.5 编写认证模块测试 (54 tests passing)

### 17. Rust State Persistence (fdl-executor)

- [x] 17.1 创建数据库迁移脚本
  - [x] 17.1.1 execution_snapshots 表
  - [x] 17.1.2 execution_history 表
  - [x] 17.1.3 tenants 表
  - [x] 17.1.4 索引和约束
- [x] 17.2 实现 `persistence.rs` - 状态持久化
  - [x] 17.2.1 ExecutionSnapshot 结构
  - [x] 17.2.2 PersistenceBackend trait
  - [x] 17.2.3 InMemoryPersistence 实现
  - [x] 17.2.4 PersistenceManager 管理器
- [x] 17.3 实现快照策略
  - [x] 17.3.1 节点完成时自动快照 (persist_on_node_complete)
  - [x] 17.3.2 可配置快照间隔 (snapshot_interval)
  - [x] 17.3.3 异步写入优化 (async_write flag)
- [x] 17.4 实现执行恢复
  - [x] 17.4.1 RecoveryService 恢复服务
  - [x] 17.4.2 list_recoverable 查询未完成执行
- [x] 17.5 编写持久化测试 (11 tests)

### 18. Rust Multi-tenancy (fdl-auth)

- [x] 18.1 实现租户管理 (repository.rs)
  - [x] 18.1.1 TenantEntity 结构
  - [x] 18.1.2 TenantRepository trait (CRUD)
  - [x] 18.1.3 InMemoryTenantRepository 实现
- [x] 18.2 实现资源配额 (在 tenant.rs 中)
  - [x] 18.2.1 TenantQuota 结构
  - [x] 18.2.2 配额检查逻辑 (check_quota 方法)
  - [x] 18.2.3 使用量统计 (TenantUsage 结构)
- [x] 18.3 实现数据隔离 (repository.rs)
  - [x] 18.3.1 TenantAwareRepository trait
  - [x] 18.3.2 TenantOwned trait
  - [x] 18.3.3 TenantQueryBuilder 帮助类
  - [x] 18.3.4 PostgreSQL RLS 策略 (在迁移脚本中实现)
- [x] 18.4 实现审计日志 (audit.rs)
  - [x] 18.4.1 AuditEntry/AuditEventType/AuditSeverity 结构
  - [x] 18.4.2 AuditLogger trait
  - [x] 18.4.3 InMemoryAuditLogger 实现
  - [x] 18.4.4 log_cross_tenant_access 告警函数
- [x] 18.5 编写多租户测试 (34 tests in repository/audit/tenant)

---

## Phase 3: Full Stack Integration

### 19. Rust Runtime Service (fdl-runtime)

- [x] 19.1 实现 `main.rs` - Axum 服务入口
- [x] 19.2 实现 `state.rs` - 应用状态 (DashMap)
- [x] 19.3 实现 `routes/auth.rs` - 认证路由
  - [x] 19.3.1 登录 API
  - [x] 19.3.2 Token 刷新 API
  - [x] 19.3.3 用户信息 API
- [x] 19.4 实现 `routes/execute.rs` - 执行 API
- [x] 19.5 实现 `routes/health.rs` - 健康检查
- [x] 19.6 实现 `ws.rs` - WebSocket 处理
- [x] 19.7 实现 JSON-RPC 2.0 协议
- [x] 19.8 添加 OpenAPI 文档 (utoipa)
- [x] 19.9 编写 API 集成测试 (15 tests)

### 20. Rust Flow Management API

- [x] 20.1 创建 `fdl-runtime/src/routes/flows.rs`
  - [x] 20.1.1 list_flows 接口
  - [x] 20.1.2 get_flow 接口
  - [x] 20.1.3 create_flow 接口
  - [x] 20.1.4 update_flow 接口
  - [x] 20.1.5 delete_flow 接口
- [x] 20.2 Versions API (集成在 flows.rs)
  - [x] 20.2.1 list_versions 接口
  - [x] 20.2.2 get_version 接口
  - [x] 20.2.3 save_version 接口
  - [x] 20.2.4 delete_version 接口
- [x] 20.3 创建数据库迁移
  - [x] 20.3.1 flows 表
  - [x] 20.3.2 flow_versions 表
  - [x] 20.3.3 索引
- [x] 20.4 添加 OpenAPI 文档 (utoipa)
- [x] 20.5 编写 API 集成测试

### 21. Backend Provider (Frontend)

- [x] 21.1 创建 `flow-editor/src/lib/storage/backend-provider.ts`
  - [x] 21.1.1 HTTP 客户端封装
  - [x] 21.1.2 JWT Token 管理
  - [x] 21.1.3 实现 StorageProvider 接口
- [x] 21.2 创建存储模式切换 UI
  - [x] 21.2.1 设置页面 (StorageSettings, SettingsDialog)
  - [x] 21.2.2 后端地址配置
  - [x] 21.2.3 连接状态显示
- [x] 21.3 实现离线/在线同步
  - [x] 21.3.1 离线检测 (useOnlineStatus hook)
  - [x] 21.3.2 本地缓存 (SyncService + IndexedDB queue)
  - [x] 21.3.3 同步冲突处理 (ConflictStrategy)

### 22. Frontend WebSocket Client

- [x] 22.1 创建 `flow-editor/src/lib/ws/client.ts`
- [x] 22.2 实现 WebSocket 连接管理 (reconnect, heartbeat)
- [x] 22.3 实现 JSON-RPC 请求/响应处理
- [x] 22.4 实现执行事件订阅 (subscribe/unsubscribe)
- [x] 22.5 实现 JWT Token 传递
- [x] 22.6 创建 React hooks (useWsClient, useExecutionEvents, useExecutionProgress)
- [x] 22.7 编写 WebSocket 客户端测试

### 23. Integration & Testing

- [x] 23.1 端到端执行测试 (171 Rust tests + 273 TS tests passing)
- [x] 23.2 认证和授权测试 (54 auth tests)
- [x] 23.3 多租户隔离测试 (34 tenant/audit tests)
- [x] 23.4 状态持久化和恢复测试 (11 persistence tests)
- [x] 23.5 流程管理测试
  - [x] 23.5.1 创建流程测试 (flowListStore tests)
  - [x] 23.5.2 编辑流程测试 (flowStore tests)
  - [x] 23.5.3 版本管理测试 (indexeddb-provider tests)
  - [x] 23.5.4 导入导出测试 (migration tests)
- [x] 23.6 更新 README.md 说明文档
- [x] 23.7 添加 Rust 后端部署指南 (DEPLOYMENT.md)
- [x] 23.8 添加安全配置指南 (SECURITY.md)
- [ ] 23.9 性能基准测试 (留待后续) 
