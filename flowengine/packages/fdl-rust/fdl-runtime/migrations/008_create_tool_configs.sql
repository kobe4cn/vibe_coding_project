-- Migration: Create tool configuration tables
-- Description: API services, datasources, and UDF configurations for tool execution

-- =====================================================
-- API Services Table
-- =====================================================
CREATE TABLE IF NOT EXISTS tool_api_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Service identification
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Connection configuration
    base_url TEXT NOT NULL,
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none',
    auth_config JSONB NOT NULL DEFAULT '{}',
    default_headers JSONB NOT NULL DEFAULT '{}',

    -- Execution settings
    timeout_ms INTEGER NOT NULL DEFAULT 30000,
    retry_count INTEGER NOT NULL DEFAULT 0,

    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_api_services_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_api_services_tenant_id ON tool_api_services(tenant_id);
CREATE INDEX idx_api_services_name ON tool_api_services(name);
CREATE INDEX idx_api_services_enabled ON tool_api_services(enabled);

CREATE TRIGGER update_api_services_updated_at
    BEFORE UPDATE ON tool_api_services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tool_api_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_services_tenant_isolation ON tool_api_services
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE tool_api_services IS 'API service configurations for api:// tool calls';
COMMENT ON COLUMN tool_api_services.name IS 'Service identifier used in api://service-name/endpoint';
COMMENT ON COLUMN tool_api_services.auth_type IS 'Authentication type: none, apikey, basic, bearer, oauth2, custom';
COMMENT ON COLUMN tool_api_services.auth_config IS 'Authentication configuration (api_key, username/password, token, etc.)';

-- =====================================================
-- Datasources Table
-- =====================================================
CREATE TABLE IF NOT EXISTS tool_datasources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Datasource identification
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Connection configuration
    db_type VARCHAR(50) NOT NULL,
    connection_string TEXT NOT NULL,
    schema_name VARCHAR(255),
    default_table VARCHAR(255),

    -- Pool settings
    pool_size INTEGER NOT NULL DEFAULT 10,
    timeout_ms INTEGER NOT NULL DEFAULT 5000,

    -- Access control
    read_only BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_datasources_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_datasources_tenant_id ON tool_datasources(tenant_id);
CREATE INDEX idx_datasources_name ON tool_datasources(name);
CREATE INDEX idx_datasources_db_type ON tool_datasources(db_type);
CREATE INDEX idx_datasources_enabled ON tool_datasources(enabled);

CREATE TRIGGER update_datasources_updated_at
    BEFORE UPDATE ON tool_datasources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tool_datasources ENABLE ROW LEVEL SECURITY;

CREATE POLICY datasources_tenant_isolation ON tool_datasources
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE tool_datasources IS 'Database connection configurations for db:// tool calls';
COMMENT ON COLUMN tool_datasources.name IS 'Datasource identifier used in db://datasource-name/udf';
COMMENT ON COLUMN tool_datasources.db_type IS 'Database type: mysql, postgresql, sqlite, mongodb, redis, elasticsearch, clickhouse';
COMMENT ON COLUMN tool_datasources.connection_string IS 'Database connection string (credentials should be encrypted in production)';

-- =====================================================
-- UDFs (User Defined Functions) Table
-- =====================================================
CREATE TABLE IF NOT EXISTS tool_udfs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID, -- NULL for global/builtin UDFs

    -- UDF identification
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- UDF configuration
    udf_type VARCHAR(50) NOT NULL DEFAULT 'builtin',
    handler TEXT NOT NULL,
    input_schema JSONB,
    output_schema JSONB,

    -- Compatibility
    applicable_db_types TEXT[] DEFAULT '{}',

    -- Status
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: unique per tenant, or global if tenant_id is NULL
    CONSTRAINT uq_udfs_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_udfs_tenant_id ON tool_udfs(tenant_id);
CREATE INDEX idx_udfs_name ON tool_udfs(name);
CREATE INDEX idx_udfs_udf_type ON tool_udfs(udf_type);
CREATE INDEX idx_udfs_is_builtin ON tool_udfs(is_builtin);
CREATE INDEX idx_udfs_enabled ON tool_udfs(enabled);

CREATE TRIGGER update_udfs_updated_at
    BEFORE UPDATE ON tool_udfs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tool_udfs IS 'User Defined Functions for database operations';
COMMENT ON COLUMN tool_udfs.name IS 'UDF name used in db://datasource/udf-name';
COMMENT ON COLUMN tool_udfs.udf_type IS 'UDF type: builtin, sql, wasm, http';
COMMENT ON COLUMN tool_udfs.handler IS 'Handler identifier: builtin::count, sql template, wasm path, or http endpoint';
COMMENT ON COLUMN tool_udfs.applicable_db_types IS 'Database types this UDF can work with (empty = all)';

-- =====================================================
-- Insert builtin UDFs
-- =====================================================
INSERT INTO tool_udfs (tenant_id, name, display_name, description, udf_type, handler, input_schema, output_schema, is_builtin, enabled)
VALUES
    (NULL, 'take', '获取单条记录', '根据条件获取单条记录', 'builtin', 'builtin::take',
     '{"type":"object","properties":{"filter":{"type":"object"},"fields":{"type":"array","items":{"type":"string"}}}}',
     '{"type":"object"}', true, true),

    (NULL, 'list', '获取列表', '根据条件获取记录列表', 'builtin', 'builtin::list',
     '{"type":"object","properties":{"filter":{"type":"object"},"fields":{"type":"array","items":{"type":"string"}},"limit":{"type":"integer"},"offset":{"type":"integer"},"order_by":{"type":"string"}}}',
     '{"type":"array"}', true, true),

    (NULL, 'count', '统计数量', '根据条件统计记录数量', 'builtin', 'builtin::count',
     '{"type":"object","properties":{"filter":{"type":"object"}}}',
     '{"type":"integer"}', true, true),

    (NULL, 'page', '分页查询', '分页获取记录列表', 'builtin', 'builtin::page',
     '{"type":"object","properties":{"filter":{"type":"object"},"fields":{"type":"array","items":{"type":"string"}},"page":{"type":"integer","default":1},"page_size":{"type":"integer","default":20},"order_by":{"type":"string"}}}',
     '{"type":"object","properties":{"items":{"type":"array"},"total":{"type":"integer"},"page":{"type":"integer"},"page_size":{"type":"integer"},"total_pages":{"type":"integer"}}}',
     true, true),

    (NULL, 'create', '创建记录', '创建新记录', 'builtin', 'builtin::create',
     '{"type":"object","properties":{"data":{"type":"object"}},"required":["data"]}',
     '{"type":"object"}', true, true),

    (NULL, 'modify', '修改记录', '根据条件修改记录', 'builtin', 'builtin::modify',
     '{"type":"object","properties":{"filter":{"type":"object"},"data":{"type":"object"}},"required":["filter","data"]}',
     '{"type":"object","properties":{"affected_rows":{"type":"integer"}}}', true, true),

    (NULL, 'delete', '删除记录', '根据条件删除记录', 'builtin', 'builtin::delete',
     '{"type":"object","properties":{"filter":{"type":"object"}},"required":["filter"]}',
     '{"type":"object","properties":{"affected_rows":{"type":"integer"}}}', true, true),

    (NULL, 'native', '原生查询', '执行原生 SQL 查询', 'builtin', 'builtin::native',
     '{"type":"object","properties":{"sql":{"type":"string"},"params":{"type":"array"}},"required":["sql"]}',
     '{"type":"array"}', true, true)
ON CONFLICT (tenant_id, name) DO NOTHING;
