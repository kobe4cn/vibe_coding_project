# FDL Runtime Security Guide

This guide covers security best practices for deploying and operating the FDL Runtime service.

## Authentication

### JWT Configuration

The service uses JWT (JSON Web Tokens) for authentication.

#### Secret Key Requirements

- **Minimum length**: 32 characters
- **Recommended**: 64+ characters, randomly generated
- **Never use**: Default development keys in production

Generate a secure secret:

```bash
# Using OpenSSL
openssl rand -base64 64

# Using /dev/urandom
head -c 64 /dev/urandom | base64
```

#### Token Configuration

| Setting | Development | Production |
|---------|-------------|------------|
| Access Token TTL | 1 hour | 15-60 minutes |
| Refresh Token TTL | 7 days | 1-7 days |
| Algorithm | HS256 | HS256 or RS256 |

#### Claims Structure

```json
{
  "sub": "user-id",
  "tenant_id": "tenant-uuid",
  "bu_code": "BU001",
  "roles": ["admin", "editor"],
  "iat": 1704067200,
  "exp": 1704070800,
  "iss": "fdl-runtime"
}
```

### Role-Based Access Control (RBAC)

#### Predefined Roles

| Role | Permissions |
|------|-------------|
| `superadmin` | All permissions, cross-tenant access |
| `admin` | Manage flows, versions, executions within tenant |
| `editor` | Create/edit flows, execute |
| `executor` | Execute flows only |
| `viewer` | Read-only access |

#### Permission Matrix

| Permission | superadmin | admin | editor | executor | viewer |
|------------|------------|-------|--------|----------|--------|
| flow.create | ✓ | ✓ | ✓ | - | - |
| flow.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| flow.update | ✓ | ✓ | ✓ | - | - |
| flow.delete | ✓ | ✓ | - | - | - |
| execution.start | ✓ | ✓ | ✓ | ✓ | - |
| execution.cancel | ✓ | ✓ | ✓ | ✓ | - |
| execution.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| tenant.manage | ✓ | - | - | - | - |
| audit.read | ✓ | ✓ | - | - | - |

## Multi-Tenancy

### Tenant Isolation

All data is isolated by tenant using Row Level Security (RLS) in PostgreSQL.

#### RLS Implementation

```sql
-- Enable RLS on all tenant tables
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's data
CREATE POLICY tenant_isolation ON flows
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

#### Tenant Context

The tenant ID is extracted from the JWT and set before each query:

```sql
SET LOCAL app.current_tenant_id = 'tenant-uuid-here';
```

### Cross-Tenant Access Prevention

- **API Level**: Middleware validates tenant_id from JWT
- **Database Level**: RLS policies prevent cross-tenant queries
- **Audit Level**: All cross-tenant access attempts are logged

## API Security

### CORS Configuration

```rust
// Recommended CORS settings for production
CorsLayer::new()
    .allow_origin(["https://app.example.com".parse().unwrap()])
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
    .allow_headers([AUTHORIZATION, CONTENT_TYPE])
    .allow_credentials(true)
    .max_age(Duration::from_secs(3600))
```

### Rate Limiting

Implement rate limiting at the API gateway or reverse proxy:

```nginx
# nginx rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://fdl_backend;
}
```

### Input Validation

All API inputs are validated:

- **Flow names**: Max 255 characters, no script tags
- **Descriptions**: Max 10,000 characters, sanitized
- **JSON data**: Schema validated, max depth 50
- **File uploads**: Max 10MB, validated content types

## Database Security

### Connection Security

```bash
# Always use SSL for PostgreSQL connections
export DATABASE_URL="postgres://user:pass@host:5432/db?sslmode=require"
```

### Credential Management

- Store database credentials in environment variables or secrets manager
- Never commit credentials to version control
- Rotate credentials regularly

### Backup Encryption

```bash
# Encrypted backup
pg_dump fdl_runtime | gpg --symmetric --cipher-algo AES256 > backup.sql.gpg
```

## Network Security

### TLS Configuration

Always use TLS 1.2+ in production:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
```

### Firewall Rules

```bash
# Only allow necessary ports
ufw allow 443/tcp    # HTTPS
ufw deny 3001/tcp    # Block direct API access
```

### Network Segmentation

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Internet      │────▶│   Load Balancer │────▶│   FDL Runtime   │
│                 │     │   (TLS Term)    │     │   (Internal)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │   PostgreSQL    │
                                               │   (Internal)    │
                                               └─────────────────┘
```

## Audit Logging

### What's Logged

| Event Type | Severity | Description |
|------------|----------|-------------|
| `auth.login` | low | Successful login |
| `auth.failed` | medium | Failed login attempt |
| `flow.create` | low | Flow created |
| `flow.delete` | medium | Flow deleted |
| `execution.start` | low | Execution started |
| `execution.fail` | medium | Execution failed |
| `tenant.access_denied` | high | Cross-tenant access attempt |
| `admin.config_change` | high | Configuration changed |

### Log Retention

- **Default**: 90 days
- **Security events**: 1 year
- **Compliance**: As required by regulations

### Log Protection

```sql
-- Audit logs are append-only
REVOKE DELETE ON audit_logs FROM fdl_user;
REVOKE UPDATE ON audit_logs FROM fdl_user;
```

## Secrets Management

### Environment Variables

```bash
# Don't expose secrets in process listing
export FDL_JWT_SECRET_FILE=/run/secrets/jwt_secret
```

### Docker Secrets

```yaml
services:
  fdl-runtime:
    secrets:
      - jwt_secret
      - db_password
    environment:
      - FDL_JWT_SECRET_FILE=/run/secrets/jwt_secret

secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
```

### HashiCorp Vault Integration

```bash
# Read secrets from Vault
export FDL_JWT_SECRET=$(vault kv get -field=jwt_secret secret/fdl-runtime)
```

## Security Checklist

### Pre-Production

- [ ] Generate strong JWT secret (64+ characters)
- [ ] Disable development mode (`FDL_DEV_MODE=false`)
- [ ] Enable TLS for all connections
- [ ] Configure CORS for specific origins only
- [ ] Set up database with RLS enabled
- [ ] Configure audit logging
- [ ] Review and limit RBAC permissions

### Production

- [ ] Enable rate limiting
- [ ] Set up intrusion detection
- [ ] Configure log aggregation
- [ ] Enable database connection encryption
- [ ] Set up automated security scanning
- [ ] Implement regular credential rotation
- [ ] Enable container security scanning

### Ongoing

- [ ] Review audit logs weekly
- [ ] Update dependencies monthly
- [ ] Rotate secrets quarterly
- [ ] Conduct security reviews annually
- [ ] Test backup recovery procedures

## Incident Response

### Security Event Response

1. **Detection**: Monitor audit logs for anomalies
2. **Containment**: Revoke compromised tokens immediately
3. **Investigation**: Review audit trail
4. **Recovery**: Rotate affected credentials
5. **Post-mortem**: Document and improve

### Emergency Procedures

```bash
# Revoke all tokens (rotate JWT secret)
export FDL_JWT_SECRET="new-emergency-secret-$(date +%s)"
systemctl restart fdl-runtime

# Block suspicious IP
iptables -A INPUT -s 192.168.1.100 -j DROP
```

## Compliance

### GDPR Considerations

- Personal data in flows is tenant-isolated
- Audit logs track data access
- Data export/deletion APIs available

### SOC 2 Controls

- Access control via RBAC
- Audit logging enabled
- Encryption at rest and in transit
- Regular security assessments

## Vulnerability Reporting

Report security vulnerabilities to: security@flowengine.example.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested remediation (if any)
