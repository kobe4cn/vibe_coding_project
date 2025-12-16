# Design: 票据管理系统架构设计

## Context

这是一个全新项目，需要从零开始构建票据管理系统。系统主要用于跟踪和管理带标签的票据（tickets），支持状态流转、标签分类和搜索筛选。

### 约束条件
- 无需用户认证和权限管理
- 前后端分开部署
- 使用 PostgreSQL 作为数据存储
- 无需考虑数据库迁移方案（初始化项目）

## Goals / Non-Goals

### Goals
- 提供完整的 Ticket CRUD 功能
- 支持灵活的标签系统（预定义 + 自定义）
- 支持按标签筛选和标题搜索
- 清晰的状态管理（开放、进行中、已完成、已取消）
- 简洁易用的前端界面

### Non-Goals
- 用户认证和授权
- 多租户支持
- 实时通知推送
- 复杂的工作流引擎

## Decisions

### 1. 数据模型设计

**Ticket 表结构**:
```sql
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',  -- low, medium, high, urgent
    status VARCHAR(20) NOT NULL DEFAULT 'open',       -- open, in_progress, completed, cancelled
    resolution TEXT,                                   -- 处理结果
    completed_at TIMESTAMPTZ,                          -- 完成时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Tag 表结构**:
```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL DEFAULT '#6B7280',  -- HEX 颜色值
    icon VARCHAR(50),                              -- 图标名称（如 Lucide 图标）
    is_predefined BOOLEAN NOT NULL DEFAULT FALSE,  -- 是否预定义标签
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**关联表**:
```sql
CREATE TABLE ticket_tags (
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (ticket_id, tag_id)
);
```

**附件表**:
```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,           -- 原始文件名
    storage_path VARCHAR(500) NOT NULL,       -- 存储路径
    content_type VARCHAR(100) NOT NULL,       -- MIME 类型
    size_bytes BIGINT NOT NULL,               -- 文件大小
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**决策理由**: 
- 使用 UUID 作为主键，便于分布式部署
- 标签独立存储，支持预定义和自定义两种模式
- 多对多关联表支持一个 ticket 关联多个标签
- 附件采用本地文件系统存储，数据库只存储元数据

#### 1.1 数据库初始化脚本

**完整初始化脚本** (`migrations/001_init.sql`):

```sql
-- ============================================
-- Ticket Management System - Database Schema
-- Version: 1.0.0
-- ============================================

-- 启用 UUID 扩展（PostgreSQL 13+ 默认包含）
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. 创建表结构
-- ============================================

-- Tickets 表
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    resolution TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 约束
    CONSTRAINT chk_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT chk_status CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_title_not_empty CHECK (TRIM(title) <> '')
);

-- Tags 表
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
    icon VARCHAR(50),
    is_predefined BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 约束
    CONSTRAINT uq_tag_name UNIQUE (name),
    CONSTRAINT chk_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_name_not_empty CHECK (TRIM(name) <> '')
);

-- Ticket-Tag 关联表
CREATE TABLE IF NOT EXISTS ticket_tags (
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (ticket_id, tag_id)
);

-- Attachments 表
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 约束
    CONSTRAINT chk_filename_not_empty CHECK (TRIM(filename) <> ''),
    CONSTRAINT chk_size_positive CHECK (size_bytes > 0)
);

-- ============================================
-- 2. 创建索引
-- ============================================

-- Tickets 索引
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_title_search ON tickets USING gin(to_tsvector('simple', title));

-- Tags 索引
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_is_predefined ON tags(is_predefined);

-- Ticket-Tag 关联索引
CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket_id ON ticket_tags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag_id ON ticket_tags(tag_id);

-- Attachments 索引
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON attachments(ticket_id);

-- ============================================
-- 3. 创建触发器函数
-- ============================================

-- 自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 tickets 表添加触发器
DROP TRIGGER IF EXISTS trigger_tickets_updated_at ON tickets;
CREATE TRIGGER trigger_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 创建视图（可选，便于查询）
-- ============================================

-- Ticket 统计视图
CREATE OR REPLACE VIEW ticket_stats AS
SELECT 
    status,
    priority,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM tickets
GROUP BY status, priority;

-- Ticket 带标签数量的视图
CREATE OR REPLACE VIEW tickets_with_tag_count AS
SELECT 
    t.*,
    COALESCE(tc.tag_count, 0) as tag_count,
    COALESCE(ac.attachment_count, 0) as attachment_count
FROM tickets t
LEFT JOIN (
    SELECT ticket_id, COUNT(*) as tag_count 
    FROM ticket_tags 
    GROUP BY ticket_id
) tc ON t.id = tc.ticket_id
LEFT JOIN (
    SELECT ticket_id, COUNT(*) as attachment_count 
    FROM attachments 
    GROUP BY ticket_id
) ac ON t.id = ac.ticket_id;

-- ============================================
-- 5. 添加注释
-- ============================================

COMMENT ON TABLE tickets IS '票据主表';
COMMENT ON COLUMN tickets.id IS '票据唯一标识';
COMMENT ON COLUMN tickets.title IS '票据标题';
COMMENT ON COLUMN tickets.description IS '票据描述';
COMMENT ON COLUMN tickets.priority IS '优先级: low, medium, high, urgent';
COMMENT ON COLUMN tickets.status IS '状态: open, in_progress, completed, cancelled';
COMMENT ON COLUMN tickets.resolution IS '处理结果';
COMMENT ON COLUMN tickets.completed_at IS '完成时间';

COMMENT ON TABLE tags IS '标签表';
COMMENT ON COLUMN tags.is_predefined IS '是否为系统预定义标签';
COMMENT ON COLUMN tags.color IS 'HEX 颜色值，如 #3B82F6';
COMMENT ON COLUMN tags.icon IS 'Lucide 图标名称，如 bug, alert-circle';

COMMENT ON TABLE ticket_tags IS '票据-标签关联表';
COMMENT ON TABLE attachments IS '附件表';
```

#### 1.2 种子数据脚本

**预定义标签种子数据** (`migrations/002_seed_tags.sql`):

```sql
-- ============================================
-- Seed Data: Predefined Tags
-- ============================================

-- 状态类标签
INSERT INTO tags (name, color, icon, is_predefined) VALUES
    ('Bug', '#EF4444', 'bug', TRUE),
    ('Feature', '#3B82F6', 'sparkles', TRUE),
    ('Enhancement', '#8B5CF6', 'trending-up', TRUE),
    ('Documentation', '#06B6D4', 'file-text', TRUE),
    ('Question', '#F59E0B', 'help-circle', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 优先级类标签
INSERT INTO tags (name, color, icon, is_predefined) VALUES
    ('Critical', '#DC2626', 'alert-octagon', TRUE),
    ('Blocker', '#B91C1C', 'ban', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 模块类标签
INSERT INTO tags (name, color, icon, is_predefined) VALUES
    ('Frontend', '#10B981', 'monitor', TRUE),
    ('Backend', '#6366F1', 'server', TRUE),
    ('Database', '#F97316', 'database', TRUE),
    ('API', '#EC4899', 'webhook', TRUE),
    ('UI/UX', '#14B8A6', 'palette', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 工作流标签
INSERT INTO tags (name, color, icon, is_predefined) VALUES
    ('Needs Review', '#FBBF24', 'eye', TRUE),
    ('In Testing', '#A855F7', 'test-tube', TRUE),
    ('Ready for Deploy', '#22C55E', 'rocket', TRUE),
    ('On Hold', '#6B7280', 'pause-circle', TRUE)
ON CONFLICT (name) DO NOTHING;
```

#### 1.3 数据库初始化流程

**当前开发环境配置**:

| 配置项 | 值 |
|--------|-----|
| 容器运行时 | Podman |
| 容器 ID | `4e6aaa4a488e` |
| 数据库用户 | `postgres` |
| 数据库密码 | `postgres` |
| 数据库端口 | `5432` (默认) |
| 数据库名称 | `ticket_db` (待创建) |

**环境变量配置** (`backend/.env`):

```bash
# 开发环境数据库连接
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ticket_db

# 服务配置
HOST=0.0.0.0
PORT=3000
RUST_LOG=info,sqlx=warn

# 附件存储
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

**开发环境初始化步骤**:

```bash
# ============================================
# 1. 验证 Podman PostgreSQL 容器状态
# ============================================
podman ps | grep postgres
# 预期输出: 4e6aaa4a488e ... postgres ... Up

# 检查端口映射
podman port 4e6aaa4a488e
# 预期输出: 5432/tcp -> 0.0.0.0:5432

# ============================================
# 2. 创建应用数据库
# ============================================
# 方式 A: 使用 podman exec
podman exec -it 4e6aaa4a488e psql -U postgres -c "CREATE DATABASE ticket_db;"

# 方式 B: 使用本地 psql 客户端
psql -h localhost -U postgres -c "CREATE DATABASE ticket_db;"
# 密码: postgres

# ============================================
# 3. 验证数据库创建成功
# ============================================
podman exec -it 4e6aaa4a488e psql -U postgres -c "\l" | grep ticket_db

# ============================================
# 4. 安装 SQLx CLI 并运行迁移
# ============================================
# 安装 SQLx CLI (如果尚未安装)
cargo install sqlx-cli --no-default-features --features postgres

# 进入后端目录
cd backend

# 运行数据库迁移
sqlx migrate run

# 验证迁移状态
sqlx migrate info

# ============================================
# 5. 验证表结构
# ============================================
podman exec -it 4e6aaa4a488e psql -U postgres -d ticket_db -c "\dt"
# 预期输出:
#  Schema |    Name      | Type  |  Owner
# --------+--------------+-------+----------
#  public | tickets      | table | postgres
#  public | tags         | table | postgres
#  public | ticket_tags  | table | postgres
#  public | attachments  | table | postgres

# 验证预定义标签
podman exec -it 4e6aaa4a488e psql -U postgres -d ticket_db -c "SELECT name, color FROM tags WHERE is_predefined = true;"
```

**快捷脚本** (`scripts/init-dev-db.sh`):

```bash
#!/bin/bash
set -e

CONTAINER_ID="4e6aaa4a488e"
DB_NAME="ticket_db"
DB_USER="postgres"

echo "🔍 检查 PostgreSQL 容器状态..."
podman ps | grep -q $CONTAINER_ID || { echo "❌ 容器未运行"; exit 1; }

echo "📦 创建数据库 $DB_NAME..."
podman exec -it $CONTAINER_ID psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "数据库已存在"

echo "🔄 运行数据库迁移..."
cd backend
sqlx migrate run

echo "✅ 数据库初始化完成!"
echo ""
echo "📊 表结构:"
podman exec -it $CONTAINER_ID psql -U $DB_USER -d $DB_NAME -c "\dt"
```

**使用 Docker/Podman Compose 初始化** (可选):

```bash
# 如果使用 compose 文件管理容器
podman-compose up -d postgres
podman-compose up -d backend  # 自动运行迁移
```

**后端启动时自动迁移** (Rust 代码):

```rust
// src/db.rs
use sqlx::postgres::PgPoolOptions;
use sqlx::migrate::Migrator;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub async fn init_db(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;
    
    // 自动运行迁移
    MIGRATOR.run(&pool).await?;
    
    tracing::info!("Database migrations completed");
    Ok(pool)
}
```

#### 1.4 迁移文件结构

```
backend/
└── migrations/
    ├── 001_init.sql              # 表结构、索引、触发器
    ├── 002_seed_tags.sql         # 预定义标签种子数据
    └── .gitkeep
```

#### 1.5 数据库回滚脚本（可选）

**回滚脚本** (`migrations/rollback/001_rollback.sql`):

```sql
-- ============================================
-- Rollback Script - Use with caution!
-- ============================================

-- 删除视图
DROP VIEW IF EXISTS tickets_with_tag_count;
DROP VIEW IF EXISTS ticket_stats;

-- 删除触发器
DROP TRIGGER IF EXISTS trigger_tickets_updated_at ON tickets;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- 删除表（按依赖顺序）
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS ticket_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS tickets;
```

### 2. API 设计

采用 RESTful 风格 API：

| 资源 | 方法 | 路径 | 描述 |
|------|------|------|------|
| Tickets | GET | `/api/tickets` | 列表（支持筛选、搜索、分页） |
| Tickets | POST | `/api/tickets` | 创建 |
| Tickets | GET | `/api/tickets/:id` | 详情 |
| Tickets | PUT | `/api/tickets/:id` | 更新 |
| Tickets | DELETE | `/api/tickets/:id` | 删除 |
| Tickets | PATCH | `/api/tickets/:id/status` | 更新状态 |
| Tags | GET | `/api/tags` | 列表 |
| Tags | POST | `/api/tags` | 创建 |
| Tags | PUT | `/api/tags/:id` | 更新 |
| Tags | DELETE | `/api/tags/:id` | 删除 |
| Ticket Tags | POST | `/api/tickets/:id/tags` | 添加标签 |
| Ticket Tags | DELETE | `/api/tickets/:id/tags/:tag_id` | 移除标签 |
| Attachments | POST | `/api/tickets/:id/attachments` | 上传附件 |
| Attachments | GET | `/api/tickets/:id/attachments` | 列出附件 |
| Attachments | GET | `/api/attachments/:id/download` | 下载附件 |
| Attachments | DELETE | `/api/attachments/:id` | 删除附件 |

**筛选参数** (GET `/api/tickets`):
- `tag_ids[]`: 按标签筛选（支持多个）
- `status`: 按状态筛选
- `priority`: 按优先级筛选
- `search`: 按标题搜索
- `page`, `per_page`: 分页

### 3. 项目结构

**后端 (Rust)**:
```
backend/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── config.rs          # 配置管理
│   ├── db.rs              # 数据库连接
│   ├── error.rs           # 错误处理
│   ├── routes/
│   │   ├── mod.rs
│   │   ├── tickets.rs
│   │   ├── tags.rs
│   │   └── attachments.rs
│   ├── models/
│   │   ├── mod.rs
│   │   ├── ticket.rs
│   │   ├── tag.rs
│   │   └── attachment.rs
│   └── handlers/
│       ├── mod.rs
│       ├── tickets.rs
│       ├── tags.rs
│       └── attachments.rs
└── migrations/
    └── 001_init.sql
```

**前端 (TypeScript)**:
```
frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts
│   │   ├── tickets.ts
│   │   ├── tags.ts
│   │   └── attachments.ts
│   ├── components/
│   │   ├── ui/            # Shadcn 组件
│   │   ├── TicketList.tsx
│   │   ├── TicketForm.tsx
│   │   ├── TicketCard.tsx
│   │   ├── TagBadge.tsx
│   │   ├── SearchFilter.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── AttachmentList.tsx
│   ├── pages/
│   │   ├── TicketsPage.tsx
│   │   ├── TicketDetailPage.tsx
│   │   └── TagsPage.tsx
│   └── types/
│       └── index.ts
└── index.html
```

### 4. 状态流转系统

#### 4.1 状态定义

| 状态 | 值 | 说明 | 是否终态 |
|------|------|------|----------|
| 待处理 | `open` | 新建的 ticket，等待处理 | 否 |
| 处理中 | `in_progress` | 正在处理的 ticket | 否 |
| 已完成 | `completed` | 处理完成的 ticket | 是（可重开） |
| 已取消 | `cancelled` | 被取消的 ticket | 是（可重开） |

#### 4.2 状态流转图

```
                              ┌─────────────────────────────────┐
                              │                                 │
                              ▼                                 │
          ┌──────────────┐  reopen                             │
          │    open      │◄──────────────────────────┐         │
          │  (待处理)    │                           │         │
          └──────┬───────┘                           │         │
                 │                                   │         │
        ┌────────┼────────┐                          │         │
        │ start  │        │ cancel                   │         │
        ▼        │        ▼                          │         │
┌───────────────┐│  ┌─────────────┐                  │         │
│  in_progress  ││  │  cancelled  │──────────────────┘         │
│   (处理中)    ││  │  (已取消)   │  reopen                    │
└───────┬───────┘│  └─────────────┘                            │
        │        │        ▲                                    │
        │ pause  │        │ cancel                             │
        │────────┘        │                                    │
        │                 │                                    │
        ├─────────────────┘                                    │
        │ complete                                             │
        ▼                                                      │
┌───────────────┐                                              │
│   completed   │──────────────────────────────────────────────┘
│   (已完成)    │  reopen
└───────────────┘
```

#### 4.3 状态转换矩阵

| 当前状态 ╲ 目标状态 | open | in_progress | completed | cancelled |
|---------------------|------|-------------|-----------|-----------|
| **open**            | -    | ✅ start    | ❌        | ✅ cancel |
| **in_progress**     | ✅ pause | -       | ✅ complete | ✅ cancel |
| **completed**       | ✅ reopen | ❌     | -         | ❌        |
| **cancelled**       | ✅ reopen | ❌     | ❌        | -         |

#### 4.4 转换规则详细定义

##### 转换: `open` → `in_progress` (start - 开始处理)

| 项目 | 说明 |
|------|------|
| **触发动作** | 用户点击"开始处理"按钮 |
| **前置条件** | 无 |
| **必填字段** | 无 |
| **自动操作** | `updated_at = NOW()` |
| **可选操作** | 可同时更新 `priority` |

##### 转换: `open` → `cancelled` (cancel - 直接取消)

| 项目 | 说明 |
|------|------|
| **触发动作** | 用户点击"取消"按钮 |
| **前置条件** | 无 |
| **必填字段** | `resolution`（取消原因，可选但建议填写） |
| **自动操作** | `updated_at = NOW()` |

##### 转换: `in_progress` → `open` (pause - 暂停/退回)

| 项目 | 说明 |
|------|------|
| **触发动作** | 用户点击"暂停"或"退回"按钮 |
| **前置条件** | 无 |
| **必填字段** | 无 |
| **自动操作** | `updated_at = NOW()` |
| **说明** | 适用于需要等待外部信息或资源的场景 |

##### 转换: `in_progress` → `completed` (complete - 完成)

| 项目 | 说明 |
|------|------|
| **触发动作** | 用户点击"完成"按钮 |
| **前置条件** | 无 |
| **必填字段** | `resolution`（处理结果，**必填**） |
| **自动操作** | `completed_at = NOW()`, `updated_at = NOW()` |
| **验证规则** | `resolution` 不能为空或仅包含空白字符 |

##### 转换: `in_progress` → `cancelled` (cancel - 取消)

| 项目 | 说明 |
|------|------|
| **触发动作** | 用户点击"取消"按钮 |
| **前置条件** | 无 |
| **必填字段** | `resolution`（取消原因，可选但建议填写） |
| **自动操作** | `updated_at = NOW()` |

##### 转换: `completed` → `open` (reopen - 重新打开)

| 项目 | 说明 |
|------|------|
| **触发动作** | 用户点击"重新打开"按钮 |
| **前置条件** | 无 |
| **必填字段** | 无 |
| **自动操作** | `completed_at = NULL`, `updated_at = NOW()` |
| **保留字段** | `resolution` 保留（作为历史记录） |
| **说明** | 适用于问题复发或处理不当需要重新处理的场景 |

##### 转换: `cancelled` → `open` (reopen - 重新打开)

| 项目 | 说明 |
|------|------|
| **触发动作** | 用户点击"重新打开"按钮 |
| **前置条件** | 无 |
| **必填字段** | 无 |
| **自动操作** | `updated_at = NOW()` |
| **保留字段** | `resolution` 保留（作为历史记录） |
| **说明** | 适用于误取消或条件变化需要重新处理的场景 |

#### 4.5 字段自动更新规则汇总

| 字段 | 自动更新场景 | 更新值 |
|------|-------------|--------|
| `status` | 任何状态转换 | 目标状态值 |
| `updated_at` | 任何字段更新、任何状态转换 | `NOW()` |
| `completed_at` | `* → completed` | `NOW()` |
| `completed_at` | `completed → open` | `NULL` |
| `resolution` | `* → completed` (必填) | 用户输入 |
| `resolution` | `* → cancelled` (可选) | 用户输入 |
| `resolution` | 重新打开时 | **保留不清除** |

#### 4.6 API 状态转换接口设计

**请求**: `PATCH /api/tickets/:id/status`

```json
{
  "status": "completed",
  "resolution": "问题已通过重启服务解决"
}
```

**响应成功** (200):
```json
{
  "id": "uuid",
  "title": "...",
  "status": "completed",
  "resolution": "问题已通过重启服务解决",
  "completed_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**响应失败 - 非法转换** (400):
```json
{
  "error": "invalid_transition",
  "message": "Cannot transition from 'completed' to 'in_progress'",
  "current_status": "completed",
  "target_status": "in_progress",
  "allowed_transitions": ["open"]
}
```

**响应失败 - 缺少必填字段** (422):
```json
{
  "error": "validation_error",
  "message": "Resolution is required when completing a ticket",
  "field": "resolution"
}
```

#### 4.7 前端状态操作按钮显示规则

| 当前状态 | 显示的操作按钮 |
|----------|---------------|
| `open` | 【开始处理】【取消】 |
| `in_progress` | 【完成】【暂停】【取消】 |
| `completed` | 【重新打开】 |
| `cancelled` | 【重新打开】 |

#### 4.8 状态颜色和图标定义

| 状态 | 颜色 | 图标 (Lucide) | Badge 样式 |
|------|------|--------------|------------|
| `open` | 蓝色 `#3B82F6` | `circle` | `bg-blue-100 text-blue-800` |
| `in_progress` | 黄色 `#F59E0B` | `loader` | `bg-yellow-100 text-yellow-800` |
| `completed` | 绿色 `#10B981` | `check-circle` | `bg-green-100 text-green-800` |
| `cancelled` | 灰色 `#6B7280` | `x-circle` | `bg-gray-100 text-gray-800` |

#### 4.9 状态转换的后端实现伪代码

```rust
fn transition_status(
    ticket: &mut Ticket,
    new_status: Status,
    resolution: Option<String>,
) -> Result<(), TransitionError> {
    // 1. 验证转换是否合法
    let allowed = match ticket.status {
        Status::Open => vec![Status::InProgress, Status::Cancelled],
        Status::InProgress => vec![Status::Open, Status::Completed, Status::Cancelled],
        Status::Completed => vec![Status::Open],
        Status::Cancelled => vec![Status::Open],
    };
    
    if !allowed.contains(&new_status) {
        return Err(TransitionError::InvalidTransition {
            from: ticket.status,
            to: new_status,
            allowed,
        });
    }
    
    // 2. 验证必填字段
    if new_status == Status::Completed && resolution.as_ref().map_or(true, |r| r.trim().is_empty()) {
        return Err(TransitionError::ResolutionRequired);
    }
    
    // 3. 执行自动操作
    let now = Utc::now();
    ticket.status = new_status;
    ticket.updated_at = now;
    
    match new_status {
        Status::Completed => {
            ticket.completed_at = Some(now);
            ticket.resolution = resolution;
        }
        Status::Cancelled => {
            if resolution.is_some() {
                ticket.resolution = resolution;
            }
        }
        Status::Open if ticket.status == Status::Completed => {
            // 从完成状态重新打开时，清除完成时间但保留 resolution
            ticket.completed_at = None;
        }
        _ => {}
    }
    
    Ok(())
}
```

### 5. 优先级定义

| 优先级 | 值 | 说明 |
|--------|------|------|
| 低 | `low` | 非紧急事项 |
| 中 | `medium` | 默认优先级 |
| 高 | `high` | 需要优先处理 |
| 紧急 | `urgent` | 需要立即处理 |

### 6. 附件存储策略

- **存储位置**: 本地文件系统 (`./uploads/attachments/{ticket_id}/{uuid}_{filename}`)
- **限制**:
  - 单文件最大: 10MB
  - 单 ticket 最多: 20 个附件
  - 允许类型: 常见文档、图片格式
- **安全**: 使用 UUID 重命名防止路径遍历攻击

### 7. 前端架构设计

#### 7.1 技术栈选型

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 构建工具 | Vite | ^6.0 | 快速开发服务器和构建 |
| UI 框架 | React | ^19.0 | 组件化 UI (19.2.3+) |
| 语言 | TypeScript | ^5.7 | 类型安全 |
| 样式 | Tailwind CSS | ^4.1 | 原子化 CSS (v4 性能提升 5x) |
| 组件库 | Shadcn/ui | latest | 可定制的 UI 组件 |
| 路由 | React Router | ^7.0 | 客户端路由 |
| 状态管理 | TanStack Query | ^5.0 | 服务端状态管理 |
| 表单 | React Hook Form | ^7.0 | 表单处理 |
| 校验 | Zod | ^3.0 | Schema 验证 |
| HTTP | Fetch API | native | API 请求 |
| 图标 | Lucide React | latest | 图标库 |

> **版本说明** (2025年12月):
> - React 19 引入了 Actions、服务器组件支持等新特性，建议使用 19.2.3+ 以修复安全漏洞
> - Tailwind CSS 4.x 从 JavaScript 重写为 Rust，构建速度提升 5 倍，增量构建提升 100 倍
> - React Router 7.0 提供更简洁的路由声明方式和改进的动态路由支持
> - Vite 6.x 为当前稳定版本

#### 7.2 项目结构详细

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── main.tsx                    # 应用入口
│   ├── App.tsx                     # 根组件和路由配置
│   ├── index.css                   # 全局样式和 Tailwind
│   │
│   ├── api/                        # API 层
│   │   ├── client.ts               # HTTP 客户端封装
│   │   ├── tickets.ts              # Ticket API
│   │   ├── tags.ts                 # Tag API
│   │   └── attachments.ts          # Attachment API
│   │
│   ├── components/                 # 组件
│   │   ├── ui/                     # Shadcn 基础组件
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/                 # 布局组件
│   │   │   ├── AppLayout.tsx       # 主布局
│   │   │   ├── Sidebar.tsx         # 侧边栏
│   │   │   ├── Header.tsx          # 顶部导航
│   │   │   └── PageContainer.tsx   # 页面容器
│   │   │
│   │   ├── ticket/                 # Ticket 相关组件
│   │   │   ├── TicketCard.tsx      # 列表卡片
│   │   │   ├── TicketForm.tsx      # 创建/编辑表单
│   │   │   ├── TicketDetail.tsx    # 详情展示
│   │   │   ├── TicketList.tsx      # 列表容器
│   │   │   ├── StatusBadge.tsx     # 状态标签
│   │   │   ├── StatusActions.tsx   # 状态操作按钮
│   │   │   └── StatusTransitionDialog.tsx  # 状态转换弹窗
│   │   │
│   │   ├── tag/                    # Tag 相关组件
│   │   │   ├── TagBadge.tsx        # 标签徽章
│   │   │   ├── TagSelector.tsx     # 标签选择器
│   │   │   ├── TagForm.tsx         # 标签表单
│   │   │   └── TagList.tsx         # 标签列表
│   │   │
│   │   ├── attachment/             # 附件相关组件
│   │   │   ├── AttachmentList.tsx  # 附件列表
│   │   │   ├── AttachmentUpload.tsx # 上传组件
│   │   │   └── AttachmentItem.tsx  # 单个附件
│   │   │
│   │   ├── filter/                 # 筛选相关组件
│   │   │   ├── SearchFilter.tsx    # 综合筛选
│   │   │   ├── StatusFilter.tsx    # 状态筛选
│   │   │   ├── PriorityFilter.tsx  # 优先级筛选
│   │   │   └── TagFilter.tsx       # 标签筛选
│   │   │
│   │   └── common/                 # 通用组件
│   │       ├── PriorityBadge.tsx   # 优先级标签
│   │       ├── EmptyState.tsx      # 空状态
│   │       ├── LoadingSpinner.tsx  # 加载状态
│   │       ├── ErrorMessage.tsx    # 错误提示
│   │       ├── Pagination.tsx      # 分页
│   │       ├── ConfirmDialog.tsx   # 确认弹窗
│   │       └── ColorPicker.tsx     # 颜色选择器
│   │
│   ├── pages/                      # 页面组件
│   │   ├── TicketsPage.tsx         # 票据列表页
│   │   ├── TicketDetailPage.tsx    # 票据详情页
│   │   ├── TicketCreatePage.tsx    # 创建票据页
│   │   ├── TicketEditPage.tsx      # 编辑票据页
│   │   ├── TagsPage.tsx            # 标签管理页
│   │   └── NotFoundPage.tsx        # 404 页面
│   │
│   ├── hooks/                      # 自定义 Hooks
│   │   ├── useTickets.ts           # Ticket 数据 Hook
│   │   ├── useTags.ts              # Tag 数据 Hook
│   │   ├── useAttachments.ts       # Attachment 数据 Hook
│   │   ├── useStatusTransition.ts  # 状态转换 Hook
│   │   └── useDebounce.ts          # 防抖 Hook
│   │
│   ├── types/                      # TypeScript 类型
│   │   ├── index.ts                # 类型导出
│   │   ├── ticket.ts               # Ticket 类型
│   │   ├── tag.ts                  # Tag 类型
│   │   ├── attachment.ts           # Attachment 类型
│   │   └── api.ts                  # API 响应类型
│   │
│   ├── lib/                        # 工具函数
│   │   ├── utils.ts                # 通用工具
│   │   ├── cn.ts                   # className 合并
│   │   ├── constants.ts            # 常量定义
│   │   └── validators.ts           # 表单验证 Schema
│   │
│   └── config/                     # 配置
│       └── env.ts                  # 环境变量
│
├── .env.example                    # 环境变量模板
├── .env.development                # 开发环境
├── .env.production                 # 生产环境
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── components.json                 # Shadcn 配置
```

#### 7.3 路由设计

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | TicketsPage | 票据列表（默认首页） |
| `/tickets` | TicketsPage | 票据列表 |
| `/tickets/new` | TicketCreatePage | 创建票据 |
| `/tickets/:id` | TicketDetailPage | 票据详情 |
| `/tickets/:id/edit` | TicketEditPage | 编辑票据 |
| `/tags` | TagsPage | 标签管理 |
| `*` | NotFoundPage | 404 页面 |

**路由配置示例**:
```tsx
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/tickets" replace /> },
      { path: "tickets", element: <TicketsPage /> },
      { path: "tickets/new", element: <TicketCreatePage /> },
      { path: "tickets/:id", element: <TicketDetailPage /> },
      { path: "tickets/:id/edit", element: <TicketEditPage /> },
      { path: "tags", element: <TagsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
```

#### 7.4 状态管理策略

采用 **TanStack Query (React Query)** 进行服务端状态管理：

```tsx
// hooks/useTickets.ts
export function useTickets(filters: TicketFilters) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => ticketApi.list(filters),
    staleTime: 30 * 1000,  // 30秒内不重新请求
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => ticketApi.get(id),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ticketApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolution }) => 
      ticketApi.updateStatus(id, status, resolution),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.setQueryData(['tickets', id], data);
    },
  });
}
```

**状态分类**:

| 状态类型 | 管理方式 | 示例 |
|----------|----------|------|
| 服务端状态 | TanStack Query | tickets, tags, attachments |
| URL 状态 | React Router | 路由参数, 查询参数 |
| 表单状态 | React Hook Form | 创建/编辑表单 |
| UI 状态 | React useState | 弹窗开关, loading 状态 |

#### 7.5 API 客户端设计

```typescript
// api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface ApiError {
  error: string;
  message: string;
  field?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | string[]>;
    }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else if (value) {
          url.searchParams.set(key, value);
        }
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new ApiClientError(response.status, error);
    }

    return response.json();
  }

  get<T>(path: string, params?: Record<string, string | string[]>) {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>('POST', path, { body });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>('PUT', path, { body });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>('PATCH', path, { body });
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }

  // 文件上传专用
  async upload<T>(path: string, file: File): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new ApiClientError(response.status, error);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_BASE);
```

#### 7.6 错误处理策略

**错误类型分类**:

| HTTP 状态码 | 错误类型 | 前端处理 |
|-------------|----------|----------|
| 400 | 业务逻辑错误 | 显示错误提示，保留用户输入 |
| 404 | 资源不存在 | 跳转到 404 页面或显示提示 |
| 409 | 冲突 | 显示冲突原因，建议用户操作 |
| 413 | 文件过大 | 提示文件大小限制 |
| 415 | 不支持的文件类型 | 提示允许的文件类型 |
| 422 | 验证错误 | 高亮错误字段，显示错误信息 |
| 500 | 服务器错误 | 显示通用错误提示，建议稍后重试 |

**全局错误处理**:
```tsx
// App.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        if (error instanceof ApiClientError) {
          toast.error(error.message);
        } else {
          toast.error('操作失败，请稍后重试');
        }
      },
    },
  },
});
```

#### 7.7 UI/UX 设计规范

**配色方案**:

| 用途 | 颜色变量 | 值 |
|------|----------|-----|
| 主色 | `--primary` | `#3B82F6` (蓝色) |
| 成功 | `--success` | `#10B981` (绿色) |
| 警告 | `--warning` | `#F59E0B` (黄色) |
| 危险 | `--destructive` | `#EF4444` (红色) |
| 中性 | `--muted` | `#6B7280` (灰色) |

**优先级颜色**:

| 优先级 | 背景色 | 文字色 | 边框色 |
|--------|--------|--------|--------|
| low | `bg-slate-100` | `text-slate-700` | `border-slate-300` |
| medium | `bg-blue-100` | `text-blue-700` | `border-blue-300` |
| high | `bg-orange-100` | `text-orange-700` | `border-orange-300` |
| urgent | `bg-red-100` | `text-red-700` | `border-red-300` |

**响应式断点**:

| 断点 | 宽度 | 布局调整 |
|------|------|----------|
| `sm` | ≥640px | 单列布局 |
| `md` | ≥768px | 侧边栏折叠 |
| `lg` | ≥1024px | 侧边栏展开 |
| `xl` | ≥1280px | 更宽的内容区 |

**交互反馈**:

| 操作 | 反馈方式 | 时机 |
|------|----------|------|
| 加载中 | Spinner + 骨架屏 | 数据请求时 |
| 成功 | Toast 提示 (绿色) | 创建/更新/删除成功 |
| 失败 | Toast 提示 (红色) | 操作失败 |
| 确认 | Dialog 弹窗 | 删除、状态转换等关键操作 |

### 8. 测试策略

#### 8.1 测试金字塔

```
         ┌───────────┐
         │   E2E     │  少量关键流程
         │   Tests   │
         ├───────────┤
         │Integration│  API 和组件集成
         │   Tests   │
         ├───────────┤
         │   Unit    │  大量单元测试
         │   Tests   │
         └───────────┘
```

#### 8.2 后端测试 (Rust)

**测试框架**: 内置 `#[cfg(test)]` + `tokio::test`

**测试分类**:

| 类型 | 目录 | 说明 |
|------|------|------|
| 单元测试 | `src/**/*_test.rs` | 函数级别测试 |
| 集成测试 | `tests/` | API 端到端测试 |

**关键测试用例**:

```rust
// tests/ticket_api_test.rs

#[tokio::test]
async fn test_create_ticket() {
    let app = setup_test_app().await;
    
    let response = app
        .post("/api/tickets")
        .json(&json!({
            "title": "Test Ticket",
            "description": "Description",
            "priority": "high"
        }))
        .await;
    
    assert_eq!(response.status(), StatusCode::CREATED);
    let ticket: Ticket = response.json().await;
    assert_eq!(ticket.title, "Test Ticket");
    assert_eq!(ticket.status, "open");
    assert_eq!(ticket.priority, "high");
}

#[tokio::test]
async fn test_status_transition_valid() {
    let app = setup_test_app().await;
    let ticket = create_test_ticket(&app).await;
    
    // open -> in_progress
    let response = app
        .patch(&format!("/api/tickets/{}/status", ticket.id))
        .json(&json!({ "status": "in_progress" }))
        .await;
    
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_status_transition_invalid() {
    let app = setup_test_app().await;
    let ticket = create_test_ticket(&app).await;
    
    // open -> completed (invalid, should fail)
    let response = app
        .patch(&format!("/api/tickets/{}/status", ticket.id))
        .json(&json!({ "status": "completed" }))
        .await;
    
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_complete_requires_resolution() {
    let app = setup_test_app().await;
    let ticket = create_test_ticket(&app).await;
    
    // Start processing first
    app.patch(&format!("/api/tickets/{}/status", ticket.id))
        .json(&json!({ "status": "in_progress" }))
        .await;
    
    // Try to complete without resolution
    let response = app
        .patch(&format!("/api/tickets/{}/status", ticket.id))
        .json(&json!({ "status": "completed" }))
        .await;
    
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}
```

**测试数据库策略**:
- 每个测试用例使用独立的事务
- 测试结束后自动回滚
- 使用 `sqlx::test` 宏管理测试数据库

#### 8.3 前端测试

**测试框架**:

| 工具 | 用途 |
|------|------|
| Vitest | 单元测试和组件测试 |
| Testing Library | React 组件测试 |
| MSW | API Mock |
| Playwright | E2E 测试 |

**测试文件结构**:
```
frontend/
├── src/
│   ├── components/
│   │   └── ticket/
│   │       ├── TicketCard.tsx
│   │       └── TicketCard.test.tsx    # 组件测试
│   └── hooks/
│       ├── useTickets.ts
│       └── useTickets.test.ts         # Hook 测试
├── tests/
│   └── e2e/
│       ├── tickets.spec.ts            # E2E 测试
│       └── tags.spec.ts
└── vitest.config.ts
```

**组件测试示例**:
```tsx
// components/ticket/StatusBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders open status correctly', () => {
    render(<StatusBadge status="open" />);
    expect(screen.getByText('待处理')).toBeInTheDocument();
    expect(screen.getByText('待处理')).toHaveClass('bg-blue-100');
  });

  it('renders completed status correctly', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toHaveClass('bg-green-100');
  });
});
```

**E2E 测试示例**:
```typescript
// tests/e2e/tickets.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Ticket Management', () => {
  test('should create a new ticket', async ({ page }) => {
    await page.goto('/tickets/new');
    
    await page.fill('[name="title"]', 'New Test Ticket');
    await page.fill('[name="description"]', 'Test description');
    await page.selectOption('[name="priority"]', 'high');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/tickets\/[\w-]+/);
    await expect(page.getByText('New Test Ticket')).toBeVisible();
  });

  test('should complete a ticket with resolution', async ({ page }) => {
    // Setup: Create and start a ticket
    const ticketId = await createTestTicket(page);
    await page.goto(`/tickets/${ticketId}`);
    
    // Start processing
    await page.click('button:has-text("开始处理")');
    await expect(page.getByText('处理中')).toBeVisible();
    
    // Complete with resolution
    await page.click('button:has-text("完成")');
    await page.fill('[name="resolution"]', '问题已解决');
    await page.click('button:has-text("确认完成")');
    
    await expect(page.getByText('已完成')).toBeVisible();
  });
});
```

#### 8.4 测试覆盖率目标

| 层级 | 覆盖率目标 | 说明 |
|------|-----------|------|
| 后端单元测试 | ≥80% | 核心业务逻辑 |
| 后端集成测试 | 100% API 端点 | 所有 API 都有测试 |
| 前端组件测试 | ≥70% | 关键组件 |
| E2E 测试 | 关键流程 | CRUD + 状态流转 |

### 9. 部署方案

#### 9.1 环境配置

**后端环境变量** (`.env`):
```bash
# 数据库
DATABASE_URL=postgres://user:password@localhost:5432/ticket_db

# 服务器
HOST=0.0.0.0
PORT=3000

# 日志
RUST_LOG=info,sqlx=warn

# 附件存储
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760  # 10MB

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

**前端环境变量** (`.env`):
```bash
# 开发环境
VITE_API_BASE_URL=http://localhost:3000

# 生产环境
VITE_API_BASE_URL=https://api.example.com
```

#### 9.2 Docker 配置

**后端 Dockerfile**:
```dockerfile
# backend/Dockerfile
FROM rust:1.75-slim as builder

WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libpq5 ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/ticket-backend /app/
COPY --from=builder /app/migrations /app/migrations

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000
CMD ["./ticket-backend"]
```

**前端 Dockerfile**:
```dockerfile
# frontend/Dockerfile
FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf**:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 禁止访问敏感文件
    location ~ /\. {
        deny all;
    }
}
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ticket_user
      POSTGRES_PASSWORD: ticket_password
      POSTGRES_DB: ticket_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ticket_user -d ticket_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgres://ticket_user:ticket_password@postgres:5432/ticket_db
      HOST: 0.0.0.0
      PORT: 3000
      RUST_LOG: info
      CORS_ALLOWED_ORIGINS: http://localhost:8080
    volumes:
      - uploads:/app/uploads
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_BASE_URL: http://localhost:3000
    ports:
      - "8080:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  uploads:
```

#### 9.3 开发环境启动

**后端开发**:
```bash
cd backend

# 安装依赖并启动数据库
docker compose up -d postgres

# 运行数据库迁移
sqlx database create
sqlx migrate run

# 启动开发服务器 (支持热重载)
cargo watch -x run
```

**前端开发**:
```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

#### 9.4 生产部署流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   代码提交   │────▶│   CI/CD     │────▶│   部署      │
│   (Git)     │     │   Pipeline  │     │   (Docker)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │  Lint   │  │  Test   │  │  Build  │
        └─────────┘  └─────────┘  └─────────┘
```

**GitHub Actions 示例** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Run backend tests
        run: |
          cd backend
          cargo test
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run frontend tests
        run: |
          cd frontend
          npm ci
          npm run test

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and push Docker images
        run: |
          docker compose build
          # Push to registry...

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # SSH to server and pull new images
          # docker compose pull && docker compose up -d
```

#### 9.5 健康检查和监控

**后端健康检查端点**:

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 基本存活检查 |
| `/health/ready` | GET | 就绪检查（含数据库连接） |

**健康检查响应**:
```json
// GET /health
{
  "status": "ok",
  "version": "1.0.0"
}

// GET /health/ready
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "storage": "ok"
  }
}
```

**日志格式** (JSON):
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "target": "ticket_backend::handlers::tickets",
  "message": "Ticket created",
  "ticket_id": "uuid",
  "request_id": "uuid"
}
```

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 无用户认证可能导致数据被误操作 | 可在后续版本添加认证，当前用于内部或单用户场景 |
| 标签数量过多时查询性能下降 | 为 tags.name 和 ticket_tags 添加索引 |
| 附件存储占用磁盘空间 | 设置文件大小和数量限制，可后续迁移到对象存储 |
| 大文件上传可能超时 | 设置合理的超时时间，考虑分片上传（后续优化） |

## Open Questions

(已解决)

