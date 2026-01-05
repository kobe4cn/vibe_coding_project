# FDL Runtime Database Migrations

PostgreSQL database migrations for the FDL Runtime service.

## Prerequisites

- PostgreSQL 14+
- `uuid-ossp` extension (for gen_random_uuid)

## Migration Files

| File | Description |
|------|-------------|
| `001_create_tenants.sql` | Multi-tenant support table |
| `002_create_flows.sql` | Flow definitions registry |
| `003_create_flow_versions.sql` | Flow version history |
| `004_create_execution_snapshots.sql` | Execution state persistence |
| `005_create_execution_history.sql` | Historical execution records |
| `006_create_audit_logs.sql` | Security audit trail |

## Running Migrations

### Using sqlx-cli

```bash
# Install sqlx-cli
cargo install sqlx-cli --features postgres

# Set database URL
export DATABASE_URL="postgres://user:password@localhost:5432/fdl_runtime"

# Run migrations
sqlx migrate run --source migrations/
```

### Manual Execution

```bash
# Connect to PostgreSQL
psql -U postgres -d fdl_runtime

# Run each migration in order
\i migrations/001_create_tenants.sql
\i migrations/002_create_flows.sql
\i migrations/003_create_flow_versions.sql
\i migrations/004_create_execution_snapshots.sql
\i migrations/005_create_execution_history.sql
\i migrations/006_create_audit_logs.sql
```

## Row Level Security (RLS)

All tables have RLS enabled. To use RLS, set the current tenant before queries:

```sql
-- Set current tenant for the session
SET app.current_tenant_id = 'your-tenant-uuid';

-- Or per-transaction
SET LOCAL app.current_tenant_id = 'your-tenant-uuid';
```

## Schema Overview

```
tenants
  ├── flows
  │   └── flow_versions
  └── execution_snapshots
      └── execution_history (archived)

audit_logs (cross-tenant)
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `FDL_DB_POOL_SIZE` | Connection pool size | 10 |
| `FDL_DB_TIMEOUT` | Query timeout in seconds | 30 |

## Development

For development without PostgreSQL, the runtime uses in-memory storage by default.
Set `FDL_USE_DATABASE=true` to enable PostgreSQL storage.
