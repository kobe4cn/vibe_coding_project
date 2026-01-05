# 技术设计文档：FDL 可视化流程编辑器

## Context

### 背景

FDL（Flow Definition Language）是一种面向业务流程编排的 DSL，基于 YAML 语法设计。当前仅支持文本编辑方式，需要构建可视化编辑器以降低使用门槛。

### 约束条件

1. **规范兼容**：必须完全兼容 FDL-spec 和 GML-spec 规范
2. **双向同步**：YAML 与可视化界面必须实时双向同步
3. **性能要求**：支持 100+ 节点的流程渲染和编辑
4. **浏览器兼容**：支持 Chrome、Firefox、Safari、Edge 最新两个版本

### 利益相关方

- 业务开发人员：主要用户，需要快速创建和维护业务流程
- 技术架构师：需要评审和优化流程设计
- 产品经理：需要理解和参与流程设计讨论

## Goals / Non-Goals

### Goals

1. 实现完整的 FDL 节点可视化编辑能力
2. 提供直观的拖拽式流程设计体验
3. 实现 YAML ↔ 可视化的无损双向转换
4. 提供 GML 表达式的智能编辑支持
5. 遵循 Material Design 设计语言
6. 实现流程运行时执行引擎，支持本地模拟执行
7. 实现版本历史记录和回滚功能
8. 实现流程调试器，支持断点和单步执行
9. **融合 Agent 编排能力**：参考 OpenAI Agent Builder，支持 AI Agent 节点、Guardrail 安全校验、人工审批等智能编排能力
10. **支持 MCP 协议集成**：通过 Model Context Protocol 连接外部工具和服务

### Non-Goals

1. 不实现多人协作编辑功能（第一版）
2. 不实现云端流程部署和管理（第一版）
3. 不实现真实 LLM API 调用（Agent 节点使用 Mock 响应）
4. 不实现完整的 MCP Server 托管（仅支持连接外部 MCP 服务）

## Decisions

### 1. 技术栈选择

**决策**：采用 React + TypeScript + React Flow + Monaco Editor

**理由**：
- **React Flow**：成熟的流程图库，内置拖拽、缩放、连线等功能，社区活跃
- **Monaco Editor**：VS Code 同款编辑器，语法高亮和智能补全能力强大
- **Zustand**：轻量级状态管理，适合中等复杂度应用
- **TypeScript**：类型安全，提升代码质量和可维护性

**备选方案**：
- Ace Editor：考虑过但 Monaco 功能更强，且有更好的 TypeScript 定义文件
- Rete.js：功能强大但学习曲线陡峭，社区较小
- Redux：功能完善但对于本项目来说过于重量级

### 2. 架构设计

**决策**：采用分层架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UI 层 (React Components)                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │Flow Canvas│ │Node Editor│ │YAML Editor│ │ Debugger  │ │VersionMgr│  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         状态层 (Zustand Store)                           │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │Flow State │ │Editor St. │ │Debug State│ │Version St.│ │ Sync St.  │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         核心层 (Core Logic)                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │FDL Parser │ │GML Parser │ │ Runtime   │ │ Debugger  │ │VersionDB │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         模型层 (Data Models)                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │Flow Model │ │Node Model │ │Edge Model │ │Exec State │ │Version Rec│  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. 节点类型设计

**决策**：基于 FDL 规范 + OpenAI Agent Builder 理念，定义 12 种节点类型

#### 3.1 FDL 原生节点（7 种）

| 节点类型 | FDL 标识 | 视觉表示 | 颜色主题 |
|---------|---------|---------|---------|
| 工具调用节点 | `exec` | 圆角矩形 | 蓝色 (#1976D2) |
| 数据映射节点 | `with` (无 exec) | 菱形 | 绿色 (#388E3C) |
| 条件跳转节点 | `when`+`then` | 菱形 | 橙色 (#F57C00) |
| 多分支跳转节点 | `case` | 六边形 | 橙色 (#F57C00) |
| 延迟执行节点 | `wait` | 圆形 | 灰色 (#616161) |
| 集合遍历节点 | `each` | 带循环标记的矩形 | 紫色 (#7B1FA2) |
| 条件循环节点 | `loop`+`when` | 带循环标记的矩形 | 紫色 (#7B1FA2) |

#### 3.2 Agent 扩展节点（5 种，参考 OpenAI Agent Builder）

| 节点类型 | FDL 标识 | 视觉表示 | 颜色主题 | 说明 |
|---------|---------|---------|---------|------|
| AI Agent 节点 | `agent` | 带 AI 图标的圆角矩形 | 深蓝色 (#0D47A1) | LLM 驱动的智能处理节点 |
| Guardrail 节点 | `guard` | 盾牌形状 | 红色 (#C62828) | 输入/输出安全校验 |
| 人工审批节点 | `approval` | 带人形图标的圆形 | 青色 (#00838F) | 暂停等待人工确认 |
| MCP 工具节点 | `mcp` | 带插件图标的矩形 | 靛蓝色 (#303F9F) | 连接 MCP Server |
| Agent 移交节点 | `handoff` | 带箭头的双圆 | 棕色 (#5D4037) | 委托给其他 Agent |

> **设计理念**：参考 [OpenAI Agent Builder](https://platform.openai.com/docs/guides/agent-builder) 的节点设计，将 AI Agent 作为一等公民融入流程编排，支持 Guardrail 安全校验、人工审批、Agent 间移交等现代 Agent 编排模式。

### 4. 双向同步策略

**决策**：采用"中间模型"作为桥梁

```
YAML Text ←──parse──→ Flow Model ←──convert──→ React Flow Nodes/Edges
           └──────────────↓──────────────┘
                    单一数据源
```

**同步机制**：
1. **YAML → 可视化**：解析 YAML 为 Flow Model，再转换为 React Flow 格式
2. **可视化 → YAML**：将 React Flow 节点/边转换为 Flow Model，再序列化为 YAML
3. **防抖处理**：用户编辑时采用 300ms 防抖，避免频繁转换
4. **错误处理**：解析错误时保留上一有效状态，显示错误提示

### 5. 子流程处理

**决策**：采用"展开/折叠"模式处理 `each` 和 `loop` 内的子流程

**理由**：
- 子流程节点可以折叠显示，减少视觉复杂度
- 展开时显示完整的内部节点结构
- 子流程边界用虚线框标识

### 6. 连接线规则

**决策**：基于 FDL 语义定义连接规则

| 连接类型 | 源端口 | 目标端口 | 线条样式 |
|---------|-------|---------|---------|
| 正常流转 (`next`) | bottom | top | 实线 + 箭头 |
| 条件成功 (`then`) | right | top | 绿色实线 |
| 条件失败 (`else`) | left | top | 红色虚线 |
| 异常处理 (`fail`) | bottom | top | 红色点线 |

### 7. GML 编辑器设计

**决策**：基于 Monaco Editor 实现 GML 语法支持

**功能**：
1. **语法高亮**：自定义 GML 语言定义，支持关键字、操作符、字符串高亮
2. **智能补全**：
   - 上下文变量提示（基于当前流程定义）
   - 内置函数提示（UDF 列表）
   - 原型方法提示（数组/对象/字符串方法）
3. **错误检查**：基本语法错误实时提示
4. **悬浮提示**：函数签名和参数说明

### 8. Agent 节点设计（参考 OpenAI Agent Builder）

**决策**：实现 AI Agent 节点，支持 LLM 驱动的智能处理

**Agent 节点配置**：
```yaml
summary:
    name: 智能摘要生成
    agent:
        model: gpt-4o              # 模型选择
        instructions: |            # Agent 指令
            你是一个专业的内容摘要助手。
            请根据输入的文章内容，生成简洁的摘要。
        tools:                     # 可用工具列表
            - file_search          # 文件搜索
            - web_search           # 网络搜索
        output_format: markdown    # 输出格式
        temperature: 0.7           # 温度参数
    args: content = article.body
    with: summary = summary.output
```

**设计要点**：
1. **模型配置**：支持选择不同的 LLM 模型（mock 模式下使用预设响应）
2. **指令编写**：支持多行 Markdown 格式的 Agent 指令
3. **工具绑定**：可以将流程中的其他 exec 节点作为 Agent 可调用的工具
4. **输出解析**：支持 JSON、Markdown、纯文本等多种输出格式
5. **思维链**：支持启用 Chain-of-Thought 推理模式

**参考来源**：[OpenAI Agent Builder - Agent Node](https://generect.com/blog/openai-agent-builder/)

### 9. Guardrail 安全校验设计

**决策**：实现 Guardrail 节点，提供输入/输出安全校验

**Guardrail 类型**：
| 类型 | 说明 | 触发时机 |
|-----|------|---------|
| `pii` | 个人隐私信息检测与脱敏 | 输入/输出 |
| `jailbreak` | 越狱攻击检测 | 输入 |
| `moderation` | 有害内容过滤 | 输入/输出 |
| `hallucination` | 幻觉检测（需 RAG 支持） | 输出 |
| `schema` | JSON Schema 格式校验 | 输出 |
| `custom` | 自定义 GML 表达式校验 | 输入/输出 |

**节点配置**：
```yaml
check_input:
    name: 输入安全检查
    guard:
        type: [pii, jailbreak]     # 校验类型列表
        action: block              # block | warn | redact
        on_fail: reject            # 失败时跳转节点
    args: input = userMessage
    then: process                  # 通过时继续
    else: reject                   # 失败时跳转
```

**执行逻辑**：
- Guardrail 与主流程并行执行，尽早发现问题
- 支持多个校验规则组合，任一失败即触发 on_fail
- 提供详细的校验报告（哪些规则触发、具体位置）

### 10. 人工审批节点设计

**决策**：实现 Human-in-the-Loop 人工审批节点

**使用场景**：
1. 敏感操作确认（如：删除数据、发送邮件）
2. AI 生成内容人工复核
3. 工单审批流程
4. 高风险决策确认

**节点配置**：
```yaml
review:
    name: 人工审核
    approval:
        title: 请确认发送邮件
        description: |
            收件人: ${email.to}
            主题: ${email.subject}
        options:                   # 审批选项
            - id: approve
              label: 批准发送
            - id: reject
              label: 拒绝
            - id: edit
              label: 修改后重试
        timeout: 24h               # 超时时间
        timeout_action: reject     # 超时默认操作
    then: send_email              # 批准后继续
    else: notify_reject           # 拒绝后跳转
```

**UI 交互**：
- 执行到审批节点时，流程暂停
- 弹出审批对话框，显示待审批内容
- 支持添加审批意见
- 审批结果记录到执行日志

### 11. MCP 工具集成设计

**决策**：支持通过 Model Context Protocol 连接外部工具服务

**MCP 节点配置**：
```yaml
search_docs:
    name: 搜索文档
    mcp:
        server: file-search-server  # MCP Server 标识
        tool: search                # 工具名称
        auth:                       # 认证配置
            type: api_key
            key: ${MCP_API_KEY}
    args: query = userQuery, limit = 10
    with: results = search_docs.items
```

**MCP Server 注册**：
```yaml
# 在流程元信息中配置可用的 MCP Server
flow:
    name: 智能客服流程
    mcp_servers:
        - id: file-search-server
          url: http://localhost:3000/mcp
          name: 文档搜索服务
        - id: crm-server
          url: http://crm-api/mcp
          name: CRM 系统
```

**设计要点**：
1. **连接器注册表**：集中管理 MCP Server 连接配置
2. **工具发现**：自动获取 MCP Server 提供的工具列表
3. **Schema 验证**：基于 MCP 协议的输入/输出 Schema 校验
4. **错误处理**：连接失败、超时等异常处理
5. **Mock 模式**：开发调试时支持 Mock MCP 响应

### 12. Agent 移交（Handoff）设计

**决策**：实现 Agent 间的任务移交机制

**使用场景**：
1. 专业领域委托（如：法律问题交给法律 Agent）
2. 多轮对话中的角色切换
3. 复杂任务的分解与协作

**节点配置**：
```yaml
delegate_legal:
    name: 移交法律咨询
    handoff:
        target: legal-agent         # 目标 Agent 流程
        context:                    # 传递的上下文
            - conversation_history
            - user_profile
        resume_on: completed        # 返回条件
    args: question = userQuestion
    with: answer = delegate_legal.response
```

**执行语义**：
1. 当前流程暂停，启动目标 Agent 流程
2. 传递指定的上下文变量
3. 目标流程完成后，返回结果并恢复当前流程
4. 支持设置超时和回退策略

**多 Agent 编排模式**（参考 OpenAI Agents SDK）：
```
┌─────────────┐     handoff      ┌─────────────┐
│  主 Agent   │ ───────────────→ │ 专家 Agent  │
│  (路由)     │ ←─────────────── │  (执行)     │
└─────────────┘     return       └─────────────┘
       │
       │ handoff
       ↓
┌─────────────┐
│ 审核 Agent  │
│  (校验)     │
└─────────────┘
```

### 13. 流程执行引擎设计

**决策**：实现基于 Web Worker 的本地模拟执行引擎

**架构**：
```
┌─────────────────────────────────────────────────────────┐
│                     主线程 (Main Thread)                 │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Runtime Controller                               │    │
│  │ - 启动/暂停/停止执行                              │    │
│  │ - 接收执行状态更新                                │    │
│  │ - 管理断点和调试命令                              │    │
│  └─────────────────────────────────────────────────┘    │
│                          ↕ postMessage                   │
├─────────────────────────────────────────────────────────┤
│                    Worker 线程 (Web Worker)              │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Flow Executor                                    │    │
│  │ - 解析 Flow Model                                │    │
│  │ - 执行节点逻辑                                   │    │
│  │ - 管理执行上下文                                 │    │
│  │ - GML 表达式求值                                 │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**执行语义**：
1. **隐式并行**：无依赖的起始节点并行执行（使用 Promise.all）
2. **显式依赖**：按 next/then/else 定义的顺序执行
3. **工具调用模拟**：exec 节点通过可配置的 Mock 函数返回模拟数据
4. **GML 求值**：完整实现 GML 表达式求值器
5. **子流程执行**：each/loop 节点按规范语义迭代执行

**工具模拟策略**：
- 提供内置 Mock 数据生成器（基于参数类型）
- 支持用户自定义 Mock 响应
- 支持延迟模拟（模拟网络延迟）

### 14. 版本历史管理设计

**决策**：基于 IndexedDB 实现本地版本历史存储

**存储模型**：
```typescript
interface FlowVersion {
  id: string;              // 版本 ID (UUID)
  flowId: string;          // 流程 ID
  version: number;         // 版本号（自增）
  content: string;         // YAML 内容快照
  timestamp: Date;         // 创建时间
  message?: string;        // 版本描述
  author?: string;         // 作者（本地用户名）
  parentId?: string;       // 父版本 ID（用于分支）
}
```

**功能设计**：
1. **自动保存**：编辑后自动创建版本快照（防抖 5 秒）
2. **手动保存**：用户可手动创建带描述的版本
3. **版本列表**：显示版本历史时间线
4. **版本对比**：Diff 视图对比两个版本的差异
5. **版本回滚**：恢复到指定历史版本
6. **版本导出**：导出指定版本的 YAML 文件

**存储限制**：
- 每个流程最多保留 100 个版本
- 超出后自动清理最旧的版本
- 总存储空间限制 50MB

### 15. 流程调试器设计

**决策**：实现集成式调试器，支持断点、单步执行和变量监视

**调试模式**：
```
┌─────────────────────────────────────────────────────────┐
│  调试工具栏                                              │
│  [▶ 运行] [⏸ 暂停] [⏹ 停止] [⏭ 步进] [⏩ 步过] [↗ 步出] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────────────┐  ┌─────────────────────────┐  │
│   │                     │  │ 变量监视窗口             │  │
│   │   流程画布          │  │ ├─ args.in              │  │
│   │   (带执行状态)      │  │ │  └─ customerId: "123" │  │
│   │                     │  │ ├─ customer             │  │
│   │   🔴 断点节点       │  │ │  ├─ name: "张三"     │  │
│   │   🟢 已执行节点     │  │ │  └─ email: "..."     │  │
│   │   🟡 当前执行节点   │  │ └─ orderCount: 5       │  │
│   │   ⚪ 未执行节点     │  │                         │  │
│   │                     │  ├─────────────────────────┤  │
│   │                     │  │ 执行日志                │  │
│   │                     │  │ [10:30:01] 开始执行...  │  │
│   └─────────────────────┘  │ [10:30:02] customer ✓  │  │
│                            │ [10:30:03] 命中断点...  │  │
│                            └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**断点类型**：
1. **节点断点**：在指定节点执行前暂停
2. **条件断点**：满足 GML 条件时暂停
3. **异常断点**：节点执行出错时自动暂停

**调试操作**：
| 操作 | 快捷键 | 说明 |
|-----|-------|------|
| 运行 | F5 | 开始或继续执行 |
| 暂停 | F6 | 暂停当前执行 |
| 停止 | Shift+F5 | 终止执行 |
| 单步执行 | F10 | 执行当前节点，进入下一节点 |
| 步入 | F11 | 进入子流程内部 |
| 步出 | Shift+F11 | 执行完当前子流程 |

**变量监视**：
- 显示当前上下文中所有变量
- 支持展开对象和数组
- 支持添加自定义监视表达式
- 变量变化时高亮显示

**执行轨迹**：
- 记录每个节点的执行顺序
- 记录每个节点的输入/输出数据
- 支持回放历史执行步骤

## Risks / Trade-offs

### 风险 1：复杂流程性能

**风险**：100+ 节点的流程可能导致渲染性能问题

**缓解措施**：
- 使用 React Flow 的虚拟化渲染
- 实现节点懒加载
- 子流程默认折叠

### 风险 2：双向同步一致性

**风险**：YAML 和可视化之间可能出现同步不一致

**缓解措施**：
- 采用单一数据源（Flow Model）
- 每次同步后进行完整性校验
- 提供"重新同步"手动操作

### 风险 3：GML 解析复杂度

**风险**：GML 语法较复杂，完整解析器开发成本高

**缓解措施**：
- 第一版实现基础语法高亮和简单补全
- 复杂表达式验证可后续迭代

### 风险 4：执行引擎 GML 求值

**风险**：GML 完整求值器实现复杂，包含原型方法、CASE 表达式等

**缓解措施**：
- 分阶段实现，优先支持核心语法
- 复杂原型方法（如 collap）可后续迭代
- 提供详细的不支持语法错误提示

### 风险 5：IndexedDB 兼容性

**风险**：部分浏览器或隐私模式下 IndexedDB 不可用

**缓解措施**：
- 检测 IndexedDB 可用性
- 降级使用 LocalStorage（容量受限）
- 提供导出/导入功能作为备份方案

### 风险 6：调试器与执行同步

**风险**：调试器的暂停/恢复可能导致状态不一致

**缓解措施**：
- 使用 Web Worker 隔离执行环境
- 实现完善的状态快照和恢复机制
- 暂停时冻结所有待执行任务

### 风险 7：Agent 节点 Mock 真实性

**风险**：Mock 的 LLM 响应与真实 API 差异可能导致流程调试失效

**缓解措施**：
- 提供多种 Mock 策略：固定响应、模板响应、录制回放
- 支持可选的真实 API 调用（需用户配置 API Key）
- Mock 响应标注明确的"模拟"标识

### 风险 8：Guardrail 误判

**风险**：安全校验规则可能产生误报或漏报

**缓解措施**：
- 提供校验结果详情和置信度分数
- 支持"警告但继续"模式
- 允许用户自定义校验规则覆盖默认行为

### 风险 9：MCP 连接稳定性

**风险**：外部 MCP Server 不可用导致流程中断

**缓解措施**：
- 实现连接健康检查和自动重试
- 提供 Mock 响应降级方案
- 支持设置超时和回退节点

### 风险 10：Agent Handoff 死锁

**风险**：多个 Agent 循环移交导致死锁

**缓解措施**：
- 实现移交深度限制（默认最大 5 层）
- 检测循环移交并报错
- 提供全局超时机制

## Migration Plan

### 阶段 1：基础框架（Week 1-2）

1. 项目脚手架搭建
2. React Flow 集成
3. 基础节点组件开发
4. 简单 YAML 解析

### 阶段 2：核心功能（Week 3-4）

1. 完整 FDL 解析器
2. 7 种节点类型实现
3. 双向同步机制
4. 节点属性编辑面板

### 阶段 3：编辑器增强（Week 5-6）

1. Monaco Editor 集成
2. GML 语法支持
3. 智能补全实现
4. 错误提示优化

### 阶段 4：执行引擎（Week 7-8）

1. GML 表达式求值器
2. 流程执行器核心逻辑
3. 工具调用模拟器
4. 执行状态管理

### 阶段 5：Agent 能力扩展（Week 9-10）

1. Agent 节点实现（Mock LLM 响应）
2. Guardrail 节点实现（PII、Jailbreak 检测）
3. 人工审批节点实现
4. MCP 工具节点实现

### 阶段 6：Agent 高级特性（Week 11-12）

1. Agent Handoff 移交机制
2. 多 Agent 编排支持
3. MCP Server 连接器注册表
4. Agent 工具绑定

### 阶段 7：版本管理（Week 13-14）

1. IndexedDB 存储层
2. 版本历史 UI
3. 版本对比 Diff 视图
4. 回滚功能

### 阶段 6：调试器（Week 11-12）

1. 断点管理
2. 单步执行控制
3. 变量监视面板
4. 执行日志和轨迹

### 阶段 7：优化完善（Week 13-14）

1. 性能优化
2. 交互细节打磨
3. 文档编写
4. 测试覆盖

### 回滚策略

- 各阶段独立可用
- 如发现重大问题可回退到上一阶段版本

## Open Questions

1. **工具注册表集成**：`exec` 节点的工具选择器是否需要与外部工具注册表对接？当前设计为手动输入 URI。

2. **主题定制**：是否需要支持自定义节点颜色和样式主题？

3. **快捷键方案**：是否需要支持键盘快捷键操作（如 Ctrl+C 复制节点）？

4. **导出格式**：除 YAML 外，是否需要支持导出为图片或 PDF？

## 附录：目录结构

```
flowengine/
├── packages/
│   ├── fdl-parser/              # FDL/GML 解析器包
│   │   ├── src/
│   │   │   ├── fdl/
│   │   │   │   ├── parser.ts    # FDL YAML 解析器
│   │   │   │   ├── serializer.ts# FDL YAML 序列化器
│   │   │   │   └── types.ts     # FDL 类型定义
│   │   │   ├── gml/
│   │   │   │   ├── lexer.ts     # GML 词法分析
│   │   │   │   ├── parser.ts    # GML 语法分析
│   │   │   │   ├── evaluator.ts # GML 求值器
│   │   │   │   └── types.ts     # GML AST 类型
│   │   │   └── index.ts
│   │   └── package.json
│   └── fdl-runtime/             # 流程执行引擎包
│       ├── src/
│       │   ├── executor.ts      # 流程执行器
│       │   ├── scheduler.ts     # 节点调度器
│       │   ├── context.ts       # 执行上下文
│       │   ├── mock.ts          # 工具调用模拟
│       │   ├── worker.ts        # Web Worker 入口
│       │   └── types.ts         # 运行时类型
│       └── package.json
├── src/
│   ├── components/
│   │   ├── canvas/              # 流程画布组件
│   │   │   ├── FlowCanvas.tsx
│   │   │   ├── Toolbar.tsx
│   │   │   └── Minimap.tsx
│   │   ├── nodes/               # 节点组件
│   │   │   ├── BaseNode.tsx
│   │   │   ├── ExecNode.tsx
│   │   │   ├── MappingNode.tsx
│   │   │   ├── ConditionNode.tsx
│   │   │   ├── SwitchNode.tsx
│   │   │   ├── DelayNode.tsx
│   │   │   ├── EachNode.tsx
│   │   │   └── LoopNode.tsx
│   │   ├── editors/             # 编辑器组件
│   │   │   ├── NodeEditor.tsx
│   │   │   ├── GmlEditor.tsx
│   │   │   └── YamlEditor.tsx
│   │   ├── debugger/            # 调试器组件
│   │   │   ├── DebugToolbar.tsx
│   │   │   ├── VariableWatch.tsx
│   │   │   ├── ExecutionLog.tsx
│   │   │   ├── BreakpointManager.tsx
│   │   │   └── CallStack.tsx
│   │   ├── versioning/          # 版本管理组件
│   │   │   ├── VersionHistory.tsx
│   │   │   ├── VersionDiff.tsx
│   │   │   └── VersionDialog.tsx
│   │   └── panels/              # 面板组件
│   │       ├── NodePalette.tsx
│   │       └── PropertyPanel.tsx
│   ├── stores/                  # 状态管理
│   │   ├── flowStore.ts
│   │   ├── editorStore.ts
│   │   ├── debugStore.ts        # 调试状态
│   │   └── versionStore.ts      # 版本状态
│   ├── hooks/                   # 自定义 Hooks
│   │   ├── useFlowSync.ts
│   │   ├── useNodeDrag.ts
│   │   ├── useDebugger.ts       # 调试器 Hook
│   │   └── useVersioning.ts     # 版本管理 Hook
│   ├── services/                # 服务层
│   │   ├── versionDB.ts         # IndexedDB 版本存储
│   │   └── runtimeBridge.ts     # Worker 通信桥接
│   ├── utils/                   # 工具函数
│   │   ├── layout.ts            # 自动布局算法
│   │   ├── validation.ts        # 流程验证
│   │   └── diff.ts              # 版本对比算法
│   ├── types/                   # TypeScript 类型
│   │   ├── flow.ts
│   │   ├── debug.ts
│   │   └── version.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
└── vite.config.ts
```
