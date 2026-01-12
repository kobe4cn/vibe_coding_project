# FlowEngine

FlowEngine 是一套围绕 FDL（Flow Definition Language）构建的流程编排平台，包含 Rust 执行引擎、React 可视化编辑器，以及用于端到端演示的集成环境。

## 组成与目录
- `packages/fdl-rust/`：Rust 版 FDL 运行时，含 `fdl-gml` 表达式引擎、`fdl-executor` 核心调度器、`fdl-auth` 多租户/JWT 模块、`fdl-tools` 各类工具适配器（API/DB/OSS/MQ/MCP/邮件/SMS 等）、`fdl-runtime` HTTP/WebSocket 服务。
- `flow-editor/`：基于 React + Vite 的可视化流程编辑器，支持画布与 YAML 双向同步、版本管理、模板/导入导出等能力。
- `integration_test/`：集成演示与端到端验证环境（MinIO、RabbitMQ、PostgreSQL、MailHog 及示例微服务），附增强版客户视图流程示例与 Compose 配置。
- `specs/`：FDL/GML 语言及工具规范（如 `fdl-spec.md`、`gml-spec.md`、`tool-service.md`），示例 YAML 与参考实现。
- `openspec/`：OpenSpec 驱动的变更管理流程与说明，涉及提案/任务/设计的约定。

## 核心能力
- **FDL DSL**：面向流程编排的 YAML DSL，支持隐式并行、显式依赖、条件/分支/循环/遍历节点、类型安全的输入输出、GML 表达式，以及对 API/数据库/对象存储/消息队列/微服务/Agent/MCP 等工具调用。
- **执行引擎**：Axum + tokio 构建的 HTTP/WebSocket 服务，内置 JWT 认证与多租户、可选 PostgreSQL 持久化、Publisher Confirms 的 MQ 发送、S3 兼容存储、邮件/SMS 等工具适配。
- **可视化编辑**：React 画布基于 @xyflow/react，Monaco YAML 编辑器实时同步，支持自动布局、模板、缩略图、版本历史、执行输入与实时结果查看。
- **集成演示**：在 `integration_test/docs/integration_test.md` 中提供完整的客户视图构建/通知流程示例，涵盖 OSS 预签名、MQ 发布/订阅、微服务调用和报表生成等链路。

## 快速开始
### 后端（FDL Runtime）
依赖：Rust 1.75+（2024 edition），可选 PostgreSQL；常用环境变量：`FDL_HOST`、`FDL_PORT`（默认 3001）、`FDL_JWT_SECRET`（生产必填）、`DATABASE_URL`、`FDL_USE_DATABASE`、`RUST_LOG`。

```bash
cd packages/fdl-rust
cargo build            # 构建全部 crate
cargo test             # 运行测试
cargo run -p fdl-runtime
# API: http://localhost:3001/api
# Swagger: http://localhost:3001/swagger-ui/
# WebSocket: ws://localhost:3001/ws
```

更多部署与安全配置见 `packages/fdl-rust/DEPLOYMENT.md`、`SECURITY.md`。

### 前端（Flow Editor）
依赖：Node.js 20+、npm。启动前在 `flow-editor/.env` 或 `.env.local` 配置 `VITE_API_URL` 指向后端。

```bash
cd flow-editor
npm install
npm run dev            # 开发
npm run build          # 构建产物输出到 dist/
npm run test:run       # 测试
npm run lint           # 代码检查
```

### 集成/演示环境
`integration_test` 提供 Docker Compose 场景（MinIO、RabbitMQ、PostgreSQL、MailHog、风控/CRM/通知示例服务等）。常用入口：

```bash
cd integration_test
docker compose -f docker-compose.yml up -d    # 启动基础设施与示例服务
```

详细流程 YAML、工具配置示例与排障说明见 `integration_test/docs/integration_test.md`。

## 参考文档
- 后端说明：`packages/fdl-rust/README.md`、`DEPLOYMENT.md`、`SECURITY.md`
- 前端说明：`flow-editor/README.md`
- 语言规范：`specs/fdl-spec.md`、`specs/gml-spec.md`、`specs/tool-service.md`
- 变更流程：`openspec/AGENTS.md`

## 许可证
Rust 后端遵循 MIT 许可，其它子项目如有差异请参考各目录内文件说明。
