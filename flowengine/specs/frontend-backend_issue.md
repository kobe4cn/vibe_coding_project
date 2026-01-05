1. 存储对接 ❌ 未默认连接

  前端有两个 Storage Provider：
  - IndexedDBProvider - 本地浏览器存储 (当前默认)
  - BackendProvider - 后端 REST API

  默认配置 (context.tsx:34):
  const DEFAULT_CONFIG: StorageConfig = {
    mode: 'local',  // 默认使用本地存储
  }

  目前流程数据存储在浏览器的 IndexedDB 中，不是后端数据库。

  2. 后端 API 已实现 ✅

  | 路由                     | 功能      | 状态         |
  |--------------------------|-----------|--------------|
  | /api/flows               | Flow CRUD | ✅ 已实现    |
  | /api/flows/{id}/versions | 版本管理  | ✅ 已实现    |
  | /api/execute/{flow_id}   | 流程执行  | ⚠️ Stub 实现 |
  | /api/health              | 健康检查  | ✅ 已实现    |

  3. 流程执行 ⚠️ 未完整实现

  execute.rs 中的执行逻辑是 stub：
  // 同步执行 - 目前只是标记完成
  state.update_execution(&execution_id, ExecStatus::Completed, 1.0, None);

  没有真正调用 fdl-executor 执行流程。

  ---
  如何连接前后端

  方式 1：通过设置 UI 切换

  我们之前创建的 StorageSettings.tsx 可以切换存储模式：
  1. 设置 Backend URL: http://localhost:3001
  2. 切换模式为 backend

  方式 2：修改默认配置

  需要修改吗？我可以：
  1. 完善执行功能 - 让后端真正执行 FDL 流程
  2. 添加执行 UI - 前端调用执行 API 并显示结果
  3. 默认连接后端 - 修改默认存储模式为 backend
