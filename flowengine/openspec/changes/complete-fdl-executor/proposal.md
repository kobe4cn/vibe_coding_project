# Change: Complete FDL Executor with Flow Management

## Why

当前流程编辑器存在两类关键问题：

### 执行器不完整
1. **真实执行能力** - 当前是模拟执行，无法连接真实工具（API、数据库、MCP 服务）
2. **GML 表达式完整求值** - `applyWithTransform()` 只返回原输入，内置函数未实现
3. **并行执行** - 规范要求无依赖节点并行执行，但当前是顺序执行
4. **子流程执行** - each/loop 节点的 subFlowNodes 未实现递归执行
5. **后端运行时** - 完全是浏览器端 TypeScript 实现，无生产级后端支持

### 流程管理缺失
1. **无流程列表** - 用户无法查看已创建的所有流程，只能编辑当前打开的流程
2. **flowId 不稳定** - 当前基于流程名称生成 flowId，改名会导致版本历史丢失
3. **仅本地存储** - 使用 IndexedDB 存储在浏览器，数据无法跨设备共享
4. **缺少流程 CRUD** - 没有创建新流程、删除流程、复制流程的功能
5. **无流程级版本管理** - 版本只在单个流程内部管理，缺少全局视角

这些缺失阻止了流程从设计走向生产部署。

## What Changes

### Phase 1: 前端流程管理

#### 流程管理界面
- **FlowListPage** - 流程列表页面（首页）
  - 展示所有流程卡片（名称、描述、版本数、最后修改时间）
  - 支持搜索、排序、筛选
  - 创建新流程、导入流程
- **FlowCard** - 流程卡片组件
  - 显示流程缩略图/预览
  - 快捷操作（编辑、复制、删除、导出）
- **FlowEditor** - 重构为路由页面
  - 从 `/flows/{flowId}` 进入编辑
  - 支持 `/flows/{flowId}/versions/{versionId}` 查看历史版本

#### 存储抽象层
- **StorageProvider 接口** - 统一的存储抽象
- **IndexedDBProvider** - 浏览器本地存储实现
- **数据迁移工具** - 从旧版数据格式迁移

### Phase 2: Rust 后端运行时

#### 核心 Crates
- **fdl-executor crate** - 核心执行引擎
- **fdl-runtime crate** - HTTP/WebSocket API 服务
- **fdl-tools crate** - 工具集成（API、数据库、MCP）
- **fdl-gml crate** - GML 表达式求值器
- **fdl-auth crate** - JWT 认证和多租户支持

#### 前端增强（TypeScript）
- **GML 表达式求值器** - 完整实现 GML 语法解析和求值
- **并行执行调度器** - 实现无依赖节点的并行执行
- **子流程执行** - each/loop 节点递归执行子流程

### Phase 3: 全栈集成

#### 后端存储 Provider
- **BackendProvider** - 连接后端 API 的存储实现
- **WebSocket 客户端** - 连接后端运行时进行真实执行

#### Flows API（后端）
- `GET /api/v1/flows` - 流程列表
- `POST /api/v1/flows` - 创建流程
- `GET /api/v1/flows/{id}` - 获取流程
- `PUT /api/v1/flows/{id}` - 更新流程
- `DELETE /api/v1/flows/{id}` - 删除流程

#### Versions API（后端）
- `GET /api/v1/flows/{id}/versions` - 版本列表
- `POST /api/v1/flows/{id}/versions` - 保存版本
- `GET /api/v1/flows/{id}/versions/{vid}` - 获取版本
- `DELETE /api/v1/flows/{id}/versions/{vid}` - 删除版本

### 状态持久化
- **执行快照** - 定期保存执行状态到数据库
- **断点恢复** - 服务重启后从快照恢复执行
- **历史查询** - 支持查询历史执行记录和状态

### JWT 认证鉴权
- **用户认证** - 基于 JWT 的用户身份验证
- **权限控制** - 基于角色的流程执行权限
- **API 安全** - 所有 API 端点强制认证

### 多租户隔离
- **租户标识** - 每个请求携带租户 ID
- **数据隔离** - 流程、版本、执行状态按租户隔离
- **资源配额** - 支持租户级别的资源限制

### 数据模型

```typescript
// 流程注册项
interface FlowEntry {
  id: string           // UUID
  name: string
  description?: string
  tags?: string[]
  thumbnail?: string   // Base64 缩略图
  latestVersion: number
  versionCount: number
  createdAt: number
  updatedAt: number
  createdBy?: string
  tenantId?: string    // 多租户支持
}

// 流程版本
interface FlowVersion {
  id: string           // UUID
  flowId: string       // 关联的流程 ID
  version: number
  name: string
  description?: string
  flow: FlowModel      // 完整流程数据
  createdAt: number
  isAutoSave?: boolean
}
```

## Impact

- **Affected specs**: `flow-runtime`, 新增 `flow-management`
- **Affected code**:
  - `flow-editor/src/pages/` - 新增页面目录
  - `flow-editor/src/lib/storage/` - 存储抽象层
  - `flow-editor/src/lib/versionHistory.ts` - 重构
  - `flow-editor/src/stores/flowStore.ts` - 扩展
  - `flow-editor/src/App.tsx` - 添加路由
  - `packages/fdl-runtime/src/executor.ts` - 前端执行器增强
  - `packages/fdl-runtime/src/gml/` - 新增 GML 求值器
  - `packages/fdl-rust/` - 新增 Rust 后端 workspace
- **Breaking changes**: 无，保持向后兼容，现有数据可迁移
- **New dependencies**:
  - Rust: axum, tokio, sqlx, tonic, serde, jsonwebtoken, argon2
  - TypeScript: react-router-dom
