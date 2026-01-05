  3. 执行器框架 ⚠️ (部分完成)

  位置: packages/fdl-runtime/src/executor.ts

  - FlowExecutor 类实现了基础框架
  - 支持：启动、暂停、恢复、停止、单步执行
  - 断点和调试支持
  - 执行历史记录

  ---
  未完成/缺失的部分

  1. 真实执行能力 ❌

  - 当前是模拟执行，不连接真实工具
  - executeExecNode() 无 handler 时返回模拟数据
  - 没有真实的 API 调用、数据库查询实现

  2. GML 表达式求值不完整 ❌

  - applyWithTransform() 方法只返回原输入
  - 内置函数（DATE、SUM 等）未完整实现

  3. 并行执行 ❌

  - 当前是顺序执行
  - 规范要求的"无依赖节点并行执行"未实现

  4. 子流程执行 ❌

  - each/loop 中的 subFlowNodes 未实现

  5. 后端运行时 ❌

  - 没有 Rust/Go/Python/Java 后端
  - 完全是浏览器端 TypeScript 实现
