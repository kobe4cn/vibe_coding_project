# FDL Runtime Deployment Guide

This guide covers deployment of the FDL (Flow Definition Language) Runtime backend service.

## Overview

The FDL Runtime is a Rust-based backend service that provides:
- REST API for flow management
- WebSocket support for real-time execution updates
- JWT authentication and multi-tenant support
- PostgreSQL database storage (optional)

## Prerequisites

- Rust 1.75+ (2024 edition)
- PostgreSQL 14+ (optional, for production)
- Docker (optional, for containerized deployment)

## Building

### Development Build

```bash
cd packages/fdl-rust
cargo build
```

### Release Build

```bash
cargo build --release
```

The binary will be at `target/release/fdl-server`.

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `FDL_HOST` | Server bind address | `0.0.0.0` | No |
| `FDL_PORT` | Server port | `3001` | No |
| `FDL_DEV_MODE` | Enable development mode | `true` | No |
| `FDL_JWT_SECRET` | JWT signing secret | (dev default) | **Yes (prod)** |
| `DATABASE_URL` | PostgreSQL connection URL | None | No |
| `FDL_USE_DATABASE` | Enable PostgreSQL storage | `false` | No |
| `RUST_LOG` | Log level | `fdl_runtime=debug` | No |

### Example Configuration

```bash
# Production configuration
export FDL_HOST=0.0.0.0
export FDL_PORT=3001
export FDL_DEV_MODE=false
export FDL_JWT_SECRET="your-super-secret-key-at-least-32-characters"
export DATABASE_URL="postgres://user:password@localhost:5432/fdl_runtime"
export FDL_USE_DATABASE=true
export RUST_LOG=fdl_runtime=info,tower_http=info
```

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE fdl_runtime;
CREATE USER fdl_user WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE fdl_runtime TO fdl_user;
```

### 2. Run Migrations

```bash
# Using sqlx-cli
cargo install sqlx-cli --features postgres
export DATABASE_URL="postgres://fdl_user:your-password@localhost:5432/fdl_runtime"
sqlx migrate run --source fdl-runtime/migrations/
```

Or manually:

```bash
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/001_create_tenants.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/002_create_flows.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/003_create_flow_versions.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/004_create_execution_snapshots.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/005_create_execution_history.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/006_create_audit_logs.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/007_fix_default_tenant_id.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/008_create_tool_configs.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/009_add_flow_publish.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/010_create_api_keys.sql
psql -U fdl_user -d fdl_runtime -f fdl-runtime/migrations/011_create_tool_services.sql
```

### Migration Details

| Migration | Description |
|-----------|-------------|
| 001 | 创建租户表 (tenants) |
| 002 | 创建流程表 (flows) |
| 003 | 创建流程版本表 (flow_versions) |
| 004 | 创建执行快照表 (execution_snapshots) |
| 005 | 创建执行历史表 (execution_history) |
| 006 | 创建审计日志表 (audit_logs) |
| 007 | 修复默认租户 ID 为固定 UUID (`00000000-0000-0000-0000-000000000001`) |
| 008 | 创建工具配置表 (tool_api_services, tool_datasources, tool_udfs) |
| 009 | 添加流程发布功能字段 (flows.published, published_at, published_version_id) |
| 010 | 创建 API 密钥表 (flow_api_keys) |
| 011 | 创建 ToolSpec 工具服务表 (tool_services, tools) 并迁移旧数据 |

## Running

### Direct Execution

```bash
./target/release/fdl-server
```

### Using systemd

Create `/etc/systemd/system/fdl-runtime.service`:

```ini
[Unit]
Description=FDL Runtime Service
After=network.target postgresql.service

[Service]
Type=simple
User=fdl
Group=fdl
WorkingDirectory=/opt/fdl-runtime
ExecStart=/opt/fdl-runtime/fdl-server
Restart=always
RestartSec=5

Environment=FDL_HOST=0.0.0.0
Environment=FDL_PORT=3001
Environment=FDL_DEV_MODE=false
Environment=FDL_JWT_SECRET=your-secret-here
Environment=DATABASE_URL=postgres://user:pass@localhost/fdl_runtime
Environment=FDL_USE_DATABASE=true
Environment=RUST_LOG=fdl_runtime=info

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable fdl-runtime
sudo systemctl start fdl-runtime
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM rust:1.75-slim as builder

WORKDIR /app
COPY . .
RUN cargo build --release -p fdl-runtime

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/fdl-server /usr/local/bin/

ENV FDL_HOST=0.0.0.0
ENV FDL_PORT=3001
EXPOSE 3001

CMD ["fdl-server"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  fdl-runtime:
    build: .
    ports:
      - "3001:3001"
    environment:
      - FDL_HOST=0.0.0.0
      - FDL_PORT=3001
      - FDL_DEV_MODE=false
      - FDL_JWT_SECRET=${FDL_JWT_SECRET}
      - DATABASE_URL=postgres://fdl:${DB_PASSWORD}@postgres:5432/fdl_runtime
      - FDL_USE_DATABASE=true
      - RUST_LOG=fdl_runtime=info
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=fdl
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=fdl_runtime
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

## Reverse Proxy (nginx)

```nginx
upstream fdl_backend {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.flowengine.example.com;

    ssl_certificate /etc/letsencrypt/live/api.flowengine.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.flowengine.example.com/privkey.pem;

    location / {
        proxy_pass http://fdl_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://fdl_backend/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

## Health Checks

The service exposes health endpoints:

```bash
# Basic health check
curl http://localhost:3001/api/health

# Detailed health with uptime
curl http://localhost:3001/api/health/detailed
```

## Monitoring

### Prometheus Metrics

The service logs can be parsed for metrics. For production, consider adding:

```rust
// In main.rs, add tower-http metrics layer
.layer(PrometheusMetricsLayer::new())
```

### Logging

Logs use `tracing` with JSON output available:

```bash
export RUST_LOG=fdl_runtime=info,tower_http=debug
```

## Scaling

### Horizontal Scaling

The service is stateless and can be horizontally scaled behind a load balancer.
Ensure all instances share the same:
- `FDL_JWT_SECRET`
- `DATABASE_URL`

### Connection Pooling

For high traffic, configure connection pool size:

```bash
export FDL_DB_POOL_SIZE=20
```

## Troubleshooting

### Common Issues

1. **Connection refused**: Check if the port is accessible and not blocked by firewall
2. **Database connection failed**: Verify DATABASE_URL and PostgreSQL is running
3. **JWT validation failed**: Ensure FDL_JWT_SECRET matches between services
4. **WebSocket disconnects**: Check nginx timeout settings and keepalive configuration

### Debug Mode

Enable detailed logging:

```bash
export RUST_LOG=fdl_runtime=debug,tower_http=trace
```

---

## Quick Start (Development)

快速启动开发环境的完整步骤：

### 1. Prerequisites

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# 安装 PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# 安装 sqlx-cli
cargo install sqlx-cli --features postgres
```

### 2. Database Initialization

```bash
# 创建数据库
createdb fdl_runtime

# 设置环境变量
export DATABASE_URL="postgres://localhost/fdl_runtime"

# 运行所有迁移
cd packages/fdl-rust
sqlx migrate run --source fdl-runtime/migrations/

# 验证迁移状态
sqlx migrate info --source fdl-runtime/migrations/
```

### 3. Start Development Server

```bash
# 开发模式启动（使用内存存储）
cargo run -p fdl-runtime

# 开发模式启动（使用 PostgreSQL）
FDL_USE_DATABASE=true cargo run -p fdl-runtime
```

### 4. Verify Installation

```bash
# 健康检查
curl http://localhost:3001/api/health

# 获取详细状态
curl http://localhost:3001/api/health/detailed
```

---

## New Features Initialization

ToolSpec 集成增强功能需要额外的初始化步骤。

### Default Tenant

系统使用固定 UUID 作为默认租户 ID：

```
Default Tenant ID: 00000000-0000-0000-0000-000000000001
```

所有开发环境的数据默认属于此租户。

### Database Schema Overview

新增的核心表结构：

```
┌─────────────────┐     ┌─────────────────┐
│  tool_services  │────<│     tools       │
│  (工具服务注册)  │     │   (工具定义)     │
└─────────────────┘     └─────────────────┘
        │
        │ 支持 10 种工具类型:
        │ api, mcp, db, flow, agent,
        │ svc, oss, mq, mail, sms
        │
┌─────────────────┐     ┌─────────────────┐
│  flow_api_keys  │────<│     flows       │
│  (API 密钥)     │     │   (流程定义)     │
└─────────────────┘     └─────────────────┘
```

### Tool Service Configuration

#### API Service Example

通过 SQL 初始化 API 工具服务：

```sql
-- 创建 API 工具服务
INSERT INTO tool_services (tenant_id, tool_type, code, name, description, config)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'api',
    'crm-service',
    'CRM 服务',
    '客户关系管理 API',
    '{
        "base_url": "https://api.example.com/crm/v1",
        "auth": {
            "type": "Bearer",
            "token": "your-api-token"
        },
        "default_headers": {
            "Content-Type": "application/json"
        },
        "timeout_ms": 30000
    }'::jsonb
);

-- 创建工具定义
INSERT INTO tools (service_id, code, name, description, args)
SELECT
    id,
    'get_customer',
    '获取客户信息',
    '根据 ID 获取客户详情',
    '{
        "defs": {},
        "in": [
            {"name": "customer_id", "type": "string", "nullable": false, "description": "客户ID"}
        ],
        "out": {"type": "object", "description": "客户信息"}
    }'::jsonb
FROM tool_services
WHERE code = 'crm-service' AND tool_type = 'api';
```

#### Database Service Example

```sql
-- 创建数据库工具服务
INSERT INTO tool_services (tenant_id, tool_type, code, name, description, config)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'db',
    'order-db',
    '订单数据库',
    '订单管理数据源',
    '{
        "db_type": "PostgreSQL",
        "connection_string": "postgres://user:pass@localhost/orders",
        "pool_size": 10,
        "timeout_ms": 5000,
        "read_only": false
    }'::jsonb
);
```

#### OSS Service Example

```sql
-- 创建 OSS 工具服务
INSERT INTO tool_services (tenant_id, tool_type, code, name, description, config)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'oss',
    'aliyun-oss',
    '阿里云 OSS',
    '对象存储服务',
    '{
        "provider": "Aliyun",
        "endpoint": "https://oss-cn-hangzhou.aliyuncs.com",
        "bucket": "my-bucket",
        "credentials": {
            "access_key_id": "your-access-key",
            "access_key_secret": "your-secret-key"
        }
    }'::jsonb
);
```

#### MQ Service Example (RabbitMQ)

```sql
-- 创建消息队列工具服务
INSERT INTO tool_services (tenant_id, tool_type, code, name, description, config)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'mq',
    'customer-events',
    '客户事件队列',
    'RabbitMQ 消息队列服务',
    '{
        "broker": "rabbitmq",
        "connection_string": "amqp://flowengine:flowengine123@localhost:5672/%2f",
        "default_exchange": "customer.events",
        "default_routing_key": "view.updated",
        "default_queue": "view.updated",
        "serialization": "json"
    }'::jsonb
);
```

#### MQ 配置字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `broker` | string | 是 | 消息中间件类型：`rabbitmq`, `kafka`, `rocketmq`, `redis` |
| `connection_string` | string | 是 | 连接字符串，RabbitMQ 格式: `amqp://user:pass@host:port/vhost` |
| `default_exchange` | string | 否 | 默认 Exchange 名称 |
| `default_routing_key` | string | 否 | 默认 Routing Key |
| `default_queue` | string | 否 | 默认队列名称 |
| `serialization` | string | 否 | 消息序列化格式：`json`(默认), `protobuf`, `avro` |

#### MQ URI 格式

```
mq://service-name/exchange/routing_key
mq://service-name/queue_name
```

**示例：**
- `mq://customer-events/customer.events/view.updated` - 发送到 exchange `customer.events`，routing key `view.updated`
- `mq://customer-events/view.updated` - 发送到默认 exchange，queue 名为 `view.updated`

#### MQ 节点 YAML 配置示例

```yaml
notifyMQ:
    name: 发布客户视图更新事件
    desp: 向消息队列发送事件，通知下游系统客户视图已更新
    exec: mq://customer-events/customer.events/view.updated
    args: |
        operation = 'publish'
        message = toJson({
            eventType = 'customer.view.updated',
            eventId = uuid(),
            timestamp = now(),
            payload = {
                customerId = customerId,
                reportUrl = saveReport.objectUrl,
                creditLevel = creditLevel
            }
        })
        routingKey = 'view.updated'
```

#### MQ 操作类型

| 操作 | 说明 | 参数 |
|------|------|------|
| `publish` / `send` | 发布消息到队列 | `message`, `exchange`, `routingKey` |
| `consume` / `receive` / `get` | 从队列消费一条消息 | `auto_ack` (默认 true) |
| `purge` | 清空队列 | - |

#### RabbitMQ 自动资源管理

执行器会自动管理 RabbitMQ 资源：

1. **Queue 声明** - 使用默认选项自动声明队列
2. **Exchange 声明** - 使用 `durable=true` 自动声明 Topic Exchange
3. **Queue 绑定** - 自动将队列绑定到 Exchange

**注意事项：**
- 如果资源已存在且配置不兼容，会记录警告日志但不会中断执行
- Publisher Confirms 已启用，`ack=true` 表示消息已被 broker 接收
- 消息默认使用 `delivery_mode=2`（持久化）

### Flow Publishing Configuration

发布流程并创建 API 密钥：

```sql
-- 发布流程
UPDATE flows
SET published = true,
    published_at = NOW(),
    published_version_id = (SELECT id FROM flow_versions WHERE flow_id = flows.id ORDER BY version DESC LIMIT 1)
WHERE id = 'your-flow-id';

-- 创建 API 密钥 (密钥需要在应用层生成并哈希)
INSERT INTO flow_api_keys (tenant_id, flow_id, name, description, key_hash, key_prefix)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'your-flow-id',
    'Production Key',
    '生产环境调用密钥',
    'sha256-hash-of-key',  -- 实际密钥的 SHA256 哈希
    'fe_prod_'             -- 密钥前缀用于识别
);
```

### Built-in UDFs

迁移 008 自动创建以下内置数据库 UDF：

| UDF | 说明 | 用法示例 |
|-----|------|----------|
| `take` | 获取单条记录 | `db://order-db/take` |
| `list` | 获取列表 | `db://order-db/list` |
| `count` | 统计数量 | `db://order-db/count` |
| `page` | 分页查询 | `db://order-db/page` |
| `create` | 创建记录 | `db://order-db/create` |
| `modify` | 修改记录 | `db://order-db/modify` |
| `delete` | 删除记录 | `db://order-db/delete` |
| `native` | 原生 SQL | `db://order-db/native` |

### Environment Variables (New)

新增的环境变量：

| Variable | Description | Default |
|----------|-------------|---------|
| `FDL_DEFAULT_TENANT_ID` | 默认租户 UUID | `00000000-0000-0000-0000-000000000001` |
| `FDL_TOOL_TIMEOUT_MS` | 工具调用超时 | `30000` |
| `FDL_ENABLE_PERSISTENCE` | 启用状态持久化 | `true` |
| `FDL_SNAPSHOT_INTERVAL` | 快照保存间隔（节点数） | `5` |

### Verify Tool Configuration

检查工具配置是否正确：

```sql
-- 查看所有工具服务
SELECT tool_type, code, name, enabled FROM tool_services;

-- 查看特定服务的工具
SELECT t.code, t.name, t.enabled
FROM tools t
JOIN tool_services ts ON t.service_id = ts.id
WHERE ts.code = 'crm-service';

-- 通过 URI 查询工具
SELECT * FROM get_tool_by_uri(
    '00000000-0000-0000-0000-000000000001',
    'api',
    'crm-service',
    'get_customer'
);
```

---

## Upgrade from Previous Version

如果从旧版本升级：

### 1. Backup Database

```bash
pg_dump fdl_runtime > fdl_runtime_backup.sql
```

### 2. Run New Migrations

```bash
sqlx migrate run --source fdl-runtime/migrations/
```

### 3. Verify Migration

```bash
# 检查新表是否创建
psql fdl_runtime -c "\dt tool_*"

# 检查数据迁移
psql fdl_runtime -c "SELECT COUNT(*) FROM tool_services"
```

迁移 011 会自动将旧的 `tool_api_services` 和 `tool_datasources` 数据迁移到新的 `tool_services` 表。
