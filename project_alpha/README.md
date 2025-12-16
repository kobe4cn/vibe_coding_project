# Ticket Management System

基于标签分类和管理的票据系统，用于跟踪任务、问题或工单。

## 功能特性

- ✅ **票据管理**: 创建、编辑、删除票据，支持标题、描述、优先级
- ✅ **标签系统**: 预定义标签 + 自定义标签，支持颜色和图标
- ✅ **状态流转**: open → in_progress → completed/cancelled
- ✅ **附件上传**: 支持多种文件格式，单文件最大 10MB
- ✅ **搜索筛选**: 按标题搜索、状态/优先级/标签筛选
- ✅ **分页排序**: 支持分页和多字段排序

## 技术栈

### 后端
- **框架**: Rust + Axum 0.7
- **数据库**: PostgreSQL 16 + SQLx
- **异步运行时**: Tokio
- **日志**: Tracing

### 前端
- **框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **样式**: Tailwind CSS 4
- **状态管理**: TanStack Query
- **路由**: React Router 7
- **表单验证**: Zod

## 先决条件

- Docker & Docker Compose
- Rust 1.75+ (开发环境)
- Node.js 22+ (开发环境)
- PostgreSQL 16+ (或使用 Docker)

## 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
# 克隆项目后直接启动
docker compose up -d

# 访问应用
# 前端: http://localhost
# 后端 API: http://localhost:3000
# 数据库会自动初始化
```

### 方式二：开发环境

#### 1. 启动数据库

```bash
docker compose up postgres -d
```

#### 2. 初始化数据库

**方式 A: 自动迁移（推荐）**

后端启动时会自动运行迁移脚本，无需手动操作。

**方式 B: 手动初始化**

```bash
# 进入 PostgreSQL 容器
docker exec -it {docker_name} sh

# 或使用本地 psql
psql -U postgres
create database ticket_db;



```

#### 3. 配置后端

```bash
cd backend

# 复制环境变量模板
cp env.template .env

# 或手动创建 .env 文件
cat > .env << 'EOF'
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ticket_db
HOST=0.0.0.0
PORT=3000
RUST_LOG=debug,sqlx=warn
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF

#sqlx migrate run 初始化数据库结构和数据
cd backend
sqlx migrate run
#如果没有sqlx 命令请先安装 sqlx-cli
cargo install sqlx-cli


# 启动后端
cargo run
```

#### 4. 配置前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

#### 5. 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:3000
- 健康检查: http://localhost:3000/health

## 数据库结构

### 表结构

| 表名 | 描述 |
|------|------|
| `tickets` | 票据主表 |
| `tags` | 标签表 |
| `ticket_tags` | 票据-标签关联表 |
| `attachments` | 附件表 |

### 迁移文件

```
backend/migrations/
├── 001_init.sql        # 表结构、索引、触发器
└── 002_seed_tags.sql   # 预定义标签数据
```

### 预定义标签

系统内置 16 个预定义标签：

- **状态类**: Bug, Feature, Enhancement, Documentation, Question
- **优先级类**: Critical, Blocker
- **模块类**: Frontend, Backend, Database, API, UI/UX
- **工作流类**: Needs Review, In Testing, Ready for Deploy, On Hold

## 环境变量配置

### 后端 (backend/.env)

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | ✅ | - | PostgreSQL 连接字符串 |
| `HOST` | - | `0.0.0.0` | 监听地址 |
| `PORT` | - | `3000` | 监听端口 |
| `RUST_LOG` | - | `info` | 日志级别 |
| `UPLOAD_DIR` | - | `./uploads` | 附件存储目录 |
| `MAX_FILE_SIZE` | - | `10485760` | 最大文件大小(字节) |

### 前端 (frontend/.env)

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `VITE_API_BASE_URL` | - | 空 | API 基础地址 |

## API 端点

### 票据管理

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/tickets` | 列表 (分页、筛选、搜索) |
| `POST` | `/api/tickets` | 创建票据 |
| `GET` | `/api/tickets/:id` | 获取详情 |
| `PUT` | `/api/tickets/:id` | 更新票据 |
| `DELETE` | `/api/tickets/:id` | 删除票据 |
| `PATCH` | `/api/tickets/:id/status` | 更新状态 |

### 标签管理

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/tags` | 列表 |
| `POST` | `/api/tags` | 创建标签 |
| `PUT` | `/api/tags/:id` | 更新标签 |
| `DELETE` | `/api/tags/:id` | 删除标签 |

### 票据-标签关联

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/api/tickets/:id/tags` | 添加标签 |
| `DELETE` | `/api/tickets/:id/tags/:tag_id` | 移除标签 |

### 附件管理

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/api/tickets/:id/attachments` | 列表 |
| `POST` | `/api/tickets/:id/attachments` | 上传 (multipart) |
| `GET` | `/api/attachments/:id/download` | 下载 |
| `DELETE` | `/api/attachments/:id` | 删除 |

### 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/health` | 基础检查 |
| `GET` | `/health/ready` | 就绪检查 (含数据库) |

## API 使用示例

### 创建票据

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "title": "修复登录页面Bug",
    "description": "用户无法在移动端登录",
    "priority": "high"
  }'
```

### 查询票据列表

```bash
# 基础查询
curl "http://localhost:3000/api/tickets"

# 带筛选和分页
curl "http://localhost:3000/api/tickets?status=open&priority=high&page=1&per_page=10"

# 搜索
curl "http://localhost:3000/api/tickets?search=登录"
```

### 更新状态（完成票据）

```bash
curl -X PATCH http://localhost:3000/api/tickets/{id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "resolution": "已修复登录问题"
  }'
```

### 创建标签

```bash
curl -X POST http://localhost:3000/api/tags \
  -H "Content-Type: application/json" \
  -d '{
    "name": "性能优化",
    "color": "#10B981",
    "icon": "zap"
  }'
```

## 状态流转

```
┌─────────────────────────────────────────────────────────┐
│                      状态流转图                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│    ┌──────────┐     开始处理      ┌─────────────┐      │
│    │   open   │ ───────────────→  │ in_progress │      │
│    │  待处理   │ ←───────────────  │   处理中    │      │
│    └────┬─────┘     暂停处理      └──────┬──────┘      │
│         │                                │             │
│         │ 取消                      完成 │ 取消        │
│         ↓                                ↓             │
│    ┌──────────┐                   ┌─────────────┐      │
│    │cancelled │                   │  completed  │      │
│    │  已取消   │ ──────────────→  │   已完成    │      │
│    └──────────┘      重新打开      └─────────────┘      │
│         │                                │             │
│         └────────→ open ←────────────────┘             │
│                   重新打开                              │
└─────────────────────────────────────────────────────────┘
```

### 状态转换规则

| 当前状态 | 允许转换到 | 备注 |
|----------|-----------|------|
| `open` | `in_progress`, `cancelled` | - |
| `in_progress` | `open`, `completed`, `cancelled` | 完成需填写处理结果 |
| `completed` | `open` | 重新打开 |
| `cancelled` | `open` | 重新打开 |

## 测试

### 后端测试

```bash
cd backend

# 创建测试数据库
createdb ticket_db_test

# 设置测试环境变量
export TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/ticket_db_test

# 运行测试（使用单线程避免数据库竞争）
cargo test -- --test-threads=1

# 运行特定测试
cargo test ticket_api -- --test-threads=1
cargo test status_transition -- --test-threads=1
cargo test tag_api -- --test-threads=1
cargo test ticket_history_test -- --test-threads=1

# 注意：测试使用共享的测试数据库，并行执行可能导致数据竞争
# 项目已配置 .cargo/config.toml 默认使用单线程，但显式指定更安全
```

### 前端测试

```bash
cd frontend

# 运行单元测试
npm run test:run

# 监视模式
npm run test

# 覆盖率报告
npm run test:coverage
```

## 项目结构

```
project_alpha/
├── backend/
│   ├── src/
│   │   ├── main.rs          # 入口文件
│   │   ├── lib.rs           # 库入口
│   │   ├── config.rs        # 配置管理
│   │   ├── db.rs            # 数据库初始化
│   │   ├── error.rs         # 错误处理
│   │   ├── models/          # 数据模型
│   │   │   ├── ticket.rs
│   │   │   ├── tag.rs
│   │   │   └── attachment.rs
│   │   ├── routes/          # 路由定义
│   │   │   ├── tickets.rs
│   │   │   ├── tags.rs
│   │   │   ├── attachments.rs
│   │   │   └── health.rs
│   │   └── handlers/        # 业务逻辑
│   │       ├── tickets.rs
│   │       ├── tags.rs
│   │       └── attachments.rs
│   ├── migrations/          # 数据库迁移
│   ├── tests/               # 测试文件
│   ├── Cargo.toml
│   ├── Dockerfile
│   └── env.template
├── frontend/
│   ├── src/
│   │   ├── api/             # API 客户端
│   │   ├── components/      # UI 组件
│   │   │   ├── common/      # 通用组件
│   │   │   ├── layout/      # 布局组件
│   │   │   ├── ticket/      # 票据组件
│   │   │   └── tag/         # 标签组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── pages/           # 页面组件
│   │   ├── types/           # TypeScript 类型
│   │   ├── lib/             # 工具函数
│   │   └── test/            # 测试配置
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── env.template
├── .github/workflows/       # CI/CD 配置
├── docker-compose.yml
└── README.md
```

## 部署

### Docker Compose (推荐)

```bash
# 生产环境部署
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 清理数据（危险！）
docker compose down -v
```

### 单独部署

**后端:**
```bash
cd backend
cargo build --release
./target/release/ticket-backend
```

**前端:**
```bash
cd frontend
npm run build
# 将 dist/ 目录部署到 Nginx/CDN
```

## 常见问题

### 1. 数据库连接失败

```
Error: connection refused
```

**解决方案:**
- 确保 PostgreSQL 服务已启动: `docker compose up postgres -d`
- 检查 `DATABASE_URL` 配置是否正确
- 确保数据库 `ticket_db` 已创建

### 2. 前端无法连接后端

**开发环境:**
- Vite 会自动代理 `/api` 请求到 `http://localhost:3000`
- 确保后端在 3000 端口运行

**生产环境:**
- 检查 `nginx.conf` 中的 proxy_pass 配置
- 确保后端服务名正确

### 3. 附件上传失败

```
Error: File too large
```

**解决方案:**
- 检查 `MAX_FILE_SIZE` 配置
- 默认限制 10MB，可调整环境变量

### 4. 迁移脚本执行失败

```
Error: relation already exists
```

**解决方案:**
- 迁移脚本使用 `IF NOT EXISTS`，通常不会出错
- 如需重置数据库: `docker compose down -v && docker compose up -d`

## 贡献指南

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -m 'Add some feature'`
4. 推送分支: `git push origin feature/your-feature`
5. 创建 Pull Request

### 代码规范

- **Rust**: 运行 `cargo fmt` 和 `cargo clippy`
- **TypeScript**: 运行 `npm run lint`
- **测试**: 确保所有测试通过

## License

MIT
