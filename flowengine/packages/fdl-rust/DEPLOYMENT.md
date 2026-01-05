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
```

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
