# FDL Rust Backend

Rust implementation of the Flow Definition Language (FDL) runtime.

## Crates

| Crate | Description |
|-------|-------------|
| `fdl-gml` | GML (Graph Mapping Language) expression engine |
| `fdl-executor` | Core flow execution engine |
| `fdl-auth` | JWT authentication and multi-tenant support |
| `fdl-tools` | Tool handlers (API, database, MCP) |
| `fdl-runtime` | HTTP/WebSocket API service |

## Quick Start

### Development

```bash
# Build all crates
cargo build

# Run tests
cargo test

# Run the server
cargo run -p fdl-runtime
```

### Access Points

- **API**: http://localhost:3001/api
- **Swagger UI**: http://localhost:3001/swagger-ui/
- **WebSocket**: ws://localhost:3001/ws
- **Health**: http://localhost:3001/api/health

## API Overview

### Flows

```bash
# List flows
curl http://localhost:3001/api/flows

# Create flow
curl -X POST http://localhost:3001/api/flows \
  -H "Content-Type: application/json" \
  -d '{"name": "My Flow", "description": "Test flow"}'

# Get flow
curl http://localhost:3001/api/flows/{id}

# Update flow
curl -X PUT http://localhost:3001/api/flows/{id} \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Delete flow
curl -X DELETE http://localhost:3001/api/flows/{id}
```

### Versions

```bash
# List versions
curl http://localhost:3001/api/flows/{flowId}/versions

# Create version
curl -X POST http://localhost:3001/api/flows/{flowId}/versions \
  -H "Content-Type: application/json" \
  -d '{"data": {...}, "label": "v1.0"}'

# Get version
curl http://localhost:3001/api/flows/{flowId}/versions/{versionId}
```

### Execution

```bash
# Execute flow
curl -X POST http://localhost:3001/api/execute/{flowId} \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"key": "value"}, "async_mode": true}'

# Get execution status
curl http://localhost:3001/api/execute/status/{executionId}

# Cancel execution
curl -X POST http://localhost:3001/api/execute/cancel/{executionId}
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `FDL_HOST` | Bind address | `0.0.0.0` |
| `FDL_PORT` | Port | `3001` |
| `FDL_DEV_MODE` | Development mode | `true` |
| `FDL_JWT_SECRET` | JWT secret | (dev default) |
| `DATABASE_URL` | PostgreSQL URL | None |

## Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Production deployment instructions
- [Security Guide](./SECURITY.md) - Security configuration and best practices
- [Migrations](./fdl-runtime/migrations/README.md) - Database migration instructions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        fdl-runtime                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Routes    │  │  WebSocket  │  │     State Mgmt      │ │
│  │  (Axum)     │  │  Handler    │  │     (DashMap)       │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│   fdl-auth      │ │  fdl-executor   │ │     fdl-tools       │
│ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────────┐ │
│ │     JWT     │ │ │ │   Context   │ │ │ │  API Handler    │ │
│ │  Middleware │ │ │ │   Engine    │ │ │ │  DB Handler     │ │
│ │    RBAC     │ │ │ │  Scheduler  │ │ │ │  MCP Handler    │ │
│ │   Tenant    │ │ │ │ Persistence │ │ │ └─────────────────┘ │
│ └─────────────┘ │ │ └──────┬──────┘ │ └─────────────────────┘
└─────────────────┘ │        │        │
                    │        ▼        │
                    │ ┌─────────────┐ │
                    │ │   fdl-gml   │ │
                    │ │   Parser    │ │
                    │ │  Evaluator  │ │
                    │ └─────────────┘ │
                    └─────────────────┘
```

## Testing

```bash
# Run all tests
cargo test

# Run specific crate tests
cargo test -p fdl-gml
cargo test -p fdl-executor
cargo test -p fdl-auth
cargo test -p fdl-tools
cargo test -p fdl-runtime

# Run with output
cargo test -- --nocapture
```

## Test Coverage

| Crate | Tests |
|-------|-------|
| fdl-gml | 35 |
| fdl-executor | 46 |
| fdl-auth | 54 |
| fdl-tools | 21 |
| fdl-runtime | 15 |
| **Total** | **171** |

## License

MIT License
