# Change: 创建 FDL 可视化流程编辑器

## Why

当前 FDL（Flow Definition Language）流程定义仅支持 YAML 文本编辑，对于复杂业务流程的设计和维护存在以下痛点：
1. **学习成本高**：用户需要熟悉 FDL/GML 语法规范才能编写流程
2. **可视化缺失**：无法直观理解流程结构、节点依赖关系和执行路径
3. **调试困难**：复杂的条件分支、循环嵌套难以在文本中追踪
4. **协作效率低**：非技术人员难以参与流程设计和评审

构建一个基于 React 的可视化流程编辑器，实现 YAML 与图形界面的双向转换，将显著降低流程编排的门槛，提升开发效率。

## What Changes

### 核心功能

- **流程画布**：基于 React Flow 的可视化画布，支持拖拽创建、连线、布局
- **节点体系**：完整实现 FDL 规范的 7 种节点类型（工具调用、数据映射、条件跳转、多分支跳转、延迟执行、集合遍历、条件循环）
- **FDL 解析器**：YAML ↔ 可视化模型的双向转换引擎
- **GML 编辑器**：基于 Monaco Editor 的 GML 表达式编辑器，支持语法高亮和智能补全
- **实时同步**：YAML 文本与可视化画布的实时双向同步

### 运行时功能

- **执行引擎**：基于 FDL 语义的流程运行时执行引擎，支持隐式并行、显式依赖、工具调用模拟
- **版本管理**：流程定义的版本历史记录、版本对比和回滚功能
- **调试工具**：流程调试器，支持断点设置、单步执行、变量监视和执行轨迹追踪

### Agent 能力（参考 OpenAI Agent Builder）

- **AI Agent 节点**：LLM 驱动的智能处理节点，支持模型选择、指令配置和工具绑定
- **Guardrail 节点**：安全校验节点，支持 PII 检测、越狱攻击检测、内容审核和自定义校验规则
- **人工审批节点**：Human-in-the-Loop 审批流程，支持多选项审批和超时处理
- **MCP 工具节点**：通过 Model Context Protocol 连接外部工具服务
- **Agent 移交节点**：支持 Agent 间任务委托和多 Agent 编排

### 设计风格

- 遵循 Google Material Design 设计语言
- 简洁现代的节点样式和连接线
- 清晰的视觉层次和交互反馈

## Impact

- **新增规格**：
  - `flow-canvas`：流程画布核心能力
  - `flow-nodes`：流程节点类型定义
  - `fdl-parser`：FDL 解析与转换
  - `gml-editor`：GML 编辑器能力
  - `yaml-sync`：YAML 双向同步
  - `flow-runtime`：流程执行引擎
  - `flow-versioning`：版本历史管理
  - `flow-debugger`：流程调试器
  - `flow-agents`：Agent 扩展节点（AI Agent、Guardrail、人工审批、MCP、Handoff）

- **技术栈**：
  - React 18+ with TypeScript
  - React Flow（流程图核心库）
  - Monaco Editor（代码编辑器）
  - Zustand（状态管理）
  - YAML 解析库（js-yaml）
  - IndexedDB / LocalStorage（版本历史存储）
  - Web Worker（执行引擎隔离）

- **受影响代码**：
  - 新增 `src/` 前端应用目录
  - 新增 `packages/fdl-parser/` 解析器包
  - 新增 `packages/fdl-runtime/` 执行引擎包
