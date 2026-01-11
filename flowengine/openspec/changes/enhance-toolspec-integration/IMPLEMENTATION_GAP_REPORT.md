# 实现差距报告：ToolSpec 规范集成增强

**生成时间**: 2026-01-10
**更新时间**: 2026-01-10
**检查范围**: proposal.md + design.md vs 实际代码实现

---

## 1. 差距总览

| 模块 | 设计状态 | 实现状态 | 差距级别 |
|------|----------|----------|----------|
| ToolSpec 数据模型 | ✅ 设计完成 | ✅ 实现完成 | 无差距 |
| GML 求值器 | ✅ 设计完成 | ✅ 基本完成 | 小差距 |
| FDL 节点扩展 | ✅ 设计完成 | ✅ 实现完成 | ~~中等差距~~ **已修复** |
| 执行器优化 | ✅ 设计完成 | ✅ 实现完成 | ~~中等差距~~ **已修复** |
| 工具发现 OpenAPI | ✅ 设计完成 | ✅ 实现完成 | 无差距 |
| 工具 Handler | ✅ 设计完成 | ✅ 实现完成 | ~~严重差距~~ **已修复** |
| 前端集成服务节点 | ✅ 设计完成 | ✅ 实现完成 | ~~严重差距~~ **已修复** |
| 自定义节点框架 (D9) | ✅ 设计完成 | ❌ 未实现 | **未开始** |
| 图形化 GML 编辑器 (D10) | ✅ 设计完成 | ❌ 未实现 | **未开始** |
| 多语言 UDF 运行时 (D11) | ✅ 设计完成 | ❌ 未实现 | **未开始** |

---

## 2. 前端差距详情

### 2.1 缺失节点图标 🔴 严重

**文件**: `flow-editor/src/components/panels/NodePalette.tsx`

`NODE_ICONS` 记录中缺少以下节点类型的图标定义：

```typescript
// 当前缺失（第 43-151 行）
// oss: ❌ 无图标
// mq: ❌ 无图标
// mail: ❌ 无图标
// sms: ❌ 无图标
// service: ❌ 无图标
```

**影响**: 拖拽这些节点到画布时将没有图标显示

**修复方案**:
```typescript
// 需要在 NODE_ICONS 中添加
oss: (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 22h16a2 2 0 0 0 2-2V8l-6-6H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2Z"/>
    <path d="M14 2v6h6"/>
    <path d="M8 13h8"/>
    <path d="M8 17h8"/>
  </svg>
),
mq: (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16v16H4z"/>
    <path d="M4 9h16"/>
    <path d="M9 4v16"/>
  </svg>
),
mail: (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
),
sms: (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <path d="M8 10h.01"/>
    <path d="M12 10h.01"/>
    <path d="M16 10h.01"/>
  </svg>
),
service: (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 3v6"/>
    <path d="M12 15v6"/>
    <path d="M3 12h6"/>
    <path d="M15 12h6"/>
  </svg>
),
```

### 2.2 缺失属性面板编辑器 🔴 严重

**文件**: `flow-editor/src/components/panels/PropertyPanel.tsx`

缺少以下节点类型的属性编辑器组件：

| 节点类型 | 编辑器组件 | 状态 |
|----------|-----------|------|
| oss | OSSNodeEditor | ❌ 缺失 |
| mq | MQNodeEditor | ❌ 缺失 |
| mail | MailNodeEditor | ❌ 缺失 |
| sms | SMSNodeEditor | ❌ 缺失 |
| service | ServiceNodeEditor | ❌ 缺失 |

**影响**: 选中这些节点时无法编辑其属性

**修复方案**: 需要实现 5 个编辑器组件，参考 ExecNodeEditor 的模式

### 2.3 节点面板类别未展开 🟡 中等

**文件**: `flow-editor/src/components/panels/NodePalette.tsx:278-280`

```typescript
// 当前代码
const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
  new Set(['entry', 'basic', 'control', 'loop', 'agent'])
)
// 缺少 'integration'
```

**修复**: 添加 `'integration'` 到默认展开列表

---

## 3. 后端差距详情

### 3.1 节点执行器为模拟实现 🟡 中等

**文件**: `fdl-executor/src/nodes/extended.rs`

以下节点的执行逻辑仅返回模拟数据，未连接实际服务：

| 函数 | 行号 | 状态 |
|------|------|------|
| `execute_oss_node` | 228-265 | ⚠️ 模拟实现 |
| `execute_mq_node` | 274-311 | ⚠️ 模拟实现 |
| `execute_mail_node` | 321-365 | ⚠️ 模拟实现 |
| `execute_sms_node` | 375-419 | ⚠️ 模拟实现 |
| `execute_service_node` | 429-473 | ⚠️ 模拟实现 |

**代码示例（OSS 节点）**:
```rust
// 第 247-250 行
// 模拟 OSS 操作结果（实际实现需要连接对象存储服务）
let result = Value::object([
    ("uri", Value::string(oss_uri.clone())),
    ("operation", Value::string(operation)),
    ...
]);
```

### 3.2 缺失工具 Handler 🔴 严重

**文件**: `fdl-tools/src/`

设计文档 D7 定义了 10 种工具服务 Handler，当前只实现了 3 种：

| Handler | 文件 | 状态 |
|---------|------|------|
| ApiHandler | `api.rs` | ✅ 已实现 |
| McpHandler | `mcp.rs` | ✅ 已实现 |
| DatabaseHandler | `database.rs` | ✅ 已实现 |
| OssHandler | - | ❌ 缺失 |
| MqHandler | - | ❌ 缺失 |
| MailHandler | - | ❌ 缺失 |
| SmsHandler | - | ❌ 缺失 |
| SvcHandler | - | ❌ 缺失 |
| FlowHandler | - | ❌ 缺失 |
| AgentHandler | - | ❌ 缺失 |

**影响**: 通过 `oss://`, `mq://`, `mail://`, `sms://`, `svc://` URI 调用工具时将无法执行

---

## 4. GML 求值器状态

### 4.1 已实现的方法

| 类别 | 方法 | 状态 |
|------|------|------|
| 数组 | map, filter, some, every | ✅ |
| 数组 | sort, group, proj/pluck | ✅ |
| 数组 | length, sum, avg, min, max | ✅ |
| 数组 | distinct, join, flat, chunk | ✅ |
| 字符串 | length, toLowerCase, toUpperCase | ✅ |
| 对象 | proj | ✅ |
| 表达式 | CASE WHEN | ✅ |
| 时间 | date offset | ✅ |

### 4.2 未实现/部分实现

| 方法 | 状态 | 备注 |
|------|------|------|
| collap | ❌ 未找到 | 设计文档 P2 优先级 |
| expand | ❌ 未找到 | 设计文档 P2 优先级 |
| med | ❌ 未找到 | 设计文档 P2 优先级 |

---

## 5. 未实现的设计模块

### 5.1 自定义节点开发框架 (D9) ❌ 未开始

设计文档第 739-912 行描述了完整的插件系统，包括：
- PluginRegistry（插件注册）
- PluginSandbox（WASM/Deno/Native 运行时）
- 自定义节点清单格式 (node-manifest.yaml)
- 前端组件扩展 API

**当前状态**: 完全未实现

### 5.2 图形化 GML 编辑器 (D10) ❌ 未开始

设计文档第 914-1088 行描述了双模式 GML 编辑器：
- 文本编辑模式（Monaco Editor）
- 可视化块拖拽模式
- 双向同步机制

**当前状态**: 完全未实现

### 5.3 多语言 UDF 运行时 (D11) ❌ 未开始

设计文档第 1090-1370 行描述了支持多语言的 UDF 系统：
- SQL UDF (DuckDB)
- JavaScript UDF (QuickJS/Deno)
- Python UDF (RustPython/PyO3)
- WASM UDF (wasmtime)
- 安全沙箱设计

**当前状态**: 完全未实现

---

## 6. 建议修复优先级

### P0 - 立即修复（影响基本功能）

1. **添加缺失的节点图标** - 1 小时
   - 文件: `NodePalette.tsx`
   - 添加 5 个 SVG 图标

2. **添加属性编辑器** - 4 小时
   - 文件: `PropertyPanel.tsx`
   - 实现 5 个 NodeEditor 组件

3. **展开集成服务类别** - 5 分钟
   - 文件: `NodePalette.tsx:278`
   - 添加 `'integration'` 到 Set

### P1 - 短期修复（完善核心功能）

4. **实现工具 Handler** - 每个 8-16 小时
   - OssHandler（需要 S3/OSS SDK）
   - MqHandler（需要消息队列客户端）
   - MailHandler（需要 SMTP/邮件 API）
   - SmsHandler（需要短信服务 API）
   - SvcHandler（需要 gRPC/HTTP 客户端）

5. **替换模拟实现为真实调用** - 每个 4-8 小时
   - 将 extended.rs 中的模拟逻辑替换为调用对应 Handler

### P2 - 中期规划

6. **完善 GML 求值器** - 16 小时
   - 实现 collap, expand, med 方法

### P3 - 长期规划

7. **自定义节点框架** - 80+ 小时
8. **图形化 GML 编辑器** - 120+ 小时
9. **多语言 UDF 运行时** - 160+ 小时

---

## 7. 快速修复脚本

### 7.1 修复节点图标

```bash
# 需要编辑 flow-editor/src/components/panels/NodePalette.tsx
# 在 NODE_ICONS 对象中添加 oss, mq, mail, sms, service 的图标
```

### 7.2 修复节点面板展开

```bash
# 需要编辑 flow-editor/src/components/panels/NodePalette.tsx:278-280
# 将 new Set(['entry', 'basic', 'control', 'loop', 'agent'])
# 改为 new Set(['entry', 'basic', 'control', 'loop', 'agent', 'integration'])
```

---

## 附录

### A. 文件位置速查

| 组件 | 文件路径 |
|------|----------|
| 节点图标 | `flow-editor/src/components/panels/NodePalette.tsx:43-151` |
| 属性面板 | `flow-editor/src/components/panels/PropertyPanel.tsx` |
| 节点类型定义 | `flow-editor/src/types/flow.ts` |
| 节点执行器 | `fdl-executor/src/nodes/extended.rs` |
| 工具 Handler | `fdl-tools/src/` |
| 调度器 | `fdl-executor/src/scheduler.rs` |
| GML 求值器 | `fdl-gml/src/evaluator.rs` |

### B. 测试验证

```bash
# 后端测试
cd packages/fdl-rust
cargo test

# 前端类型检查
cd flow-editor
npx tsc --noEmit
```

---

## 8. 修复记录 (2026-01-10)

### 8.1 前端修复

| 修复项 | 文件 | 状态 |
|--------|------|------|
| 添加 oss/mq/mail/sms/service 节点图标 | `NodePalette.tsx` | ✅ 完成 |
| 添加 integration 类别默认展开 | `NodePalette.tsx:278` | ✅ 完成 |
| 添加 OSSNodeEditor | `PropertyPanel.tsx` | ✅ 完成 |
| 添加 MQNodeEditor | `PropertyPanel.tsx` | ✅ 完成 |
| 添加 MailNodeEditor | `PropertyPanel.tsx` | ✅ 完成 |
| 添加 SMSNodeEditor | `PropertyPanel.tsx` | ✅ 完成 |
| 添加 ServiceNodeEditor | `PropertyPanel.tsx` | ✅ 完成 |

### 8.2 后端修复

| 修复项 | 文件 | 状态 |
|--------|------|------|
| 实现 OssHandler | `fdl-tools/src/oss.rs` | ✅ 完成 |
| 实现 MqHandler | `fdl-tools/src/mq.rs` | ✅ 完成 |
| 实现 MailHandler | `fdl-tools/src/mail.rs` | ✅ 完成 |
| 实现 SmsHandler | `fdl-tools/src/sms.rs` | ✅ 完成 |
| 实现 SvcHandler | `fdl-tools/src/svc.rs` | ✅ 完成 |
| 更新 lib.rs 导出 handlers | `fdl-tools/src/lib.rs` | ✅ 完成 |
| 执行器连接实际 Handler | `fdl-executor/src/nodes/extended.rs` | ✅ 完成 |

### 8.3 Handler 功能说明

| Handler | 支持的操作 |
|---------|-----------|
| OssHandler | upload, download, delete, list, presign, copy, head |
| MqHandler | send, receive, subscribe, unsubscribe, ack, nack, info |
| MailHandler | send, sendTemplate, verify, status |
| SmsHandler | send, sendTemplate, batchSend, status, balance |
| SvcHandler | call, health, info, endpoints |

### 8.4 架构说明

执行器节点（OSS/MQ/Mail/SMS/Service）现在支持两种模式：

1. **注册表模式**：当配置了 `ManagedToolRegistry` 时，节点会通过注册表执行实际的工具调用
2. **模拟模式**：当没有配置注册表或工具未注册时，返回模拟数据（用于测试和开发）

结果中包含 `_mock: true` 标志表示使用了模拟数据。
