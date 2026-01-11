-- Migration: Create ToolSpec-aligned tool services and tools tables
-- Description: Unified tool service registry supporting 10 tool types (api, mcp, db, flow, agent, svc, oss, mq, mail, sms)

-- =====================================================
-- Tool Services Table
-- Stores tool service configurations for all tool types
-- =====================================================
CREATE TABLE IF NOT EXISTS tool_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Service identification
    tool_type VARCHAR(20) NOT NULL,
    code VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Service-specific configuration (polymorphic JSON based on tool_type)
    -- ApiConfig, McpConfig, DbConfig, FlowConfig, AgentConfig, SvcConfig, OssConfig, MqConfig, MailConfig, SmsConfig
    config JSONB NOT NULL DEFAULT '{}',

    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: unique code per tenant and tool type
    CONSTRAINT uq_tool_services_tenant_type_code UNIQUE (tenant_id, tool_type, code),
    CONSTRAINT chk_tool_services_type CHECK (tool_type IN ('api', 'mcp', 'db', 'flow', 'agent', 'svc', 'oss', 'mq', 'mail', 'sms'))
);

-- Indexes for common query patterns
CREATE INDEX idx_tool_services_tenant_id ON tool_services(tenant_id);
CREATE INDEX idx_tool_services_tool_type ON tool_services(tool_type);
CREATE INDEX idx_tool_services_code ON tool_services(code);
CREATE INDEX idx_tool_services_enabled ON tool_services(enabled);
CREATE INDEX idx_tool_services_tenant_type ON tool_services(tenant_id, tool_type);

-- Auto-update timestamp trigger
CREATE TRIGGER update_tool_services_updated_at
    BEFORE UPDATE ON tool_services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row-level security for multi-tenant isolation
ALTER TABLE tool_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY tool_services_tenant_isolation ON tool_services
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE tool_services IS 'ToolSpec-aligned tool service registry supporting 10 tool types';
COMMENT ON COLUMN tool_services.tool_type IS 'Tool type: api, mcp, db, flow, agent, svc, oss, mq, mail, sms';
COMMENT ON COLUMN tool_services.code IS 'Service code used in URI: tool-type://service-code/tool-code';
COMMENT ON COLUMN tool_services.config IS 'Type-specific configuration JSON (ApiConfig, McpConfig, DbConfig, etc.)';

-- =====================================================
-- Tools Table
-- Stores individual tools within a service
-- =====================================================
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES tool_services(id) ON DELETE CASCADE,

    -- Tool identification
    code VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Tool arguments definition (ToolArgs structure)
    -- Contains: defs (type definitions), in (input parameters), out (output definition)
    args JSONB NOT NULL DEFAULT '{"defs": {}, "in": [], "out": null}',

    -- Tool-specific options
    opts JSONB,

    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Audit
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: unique code per service
    CONSTRAINT uq_tools_service_code UNIQUE (service_id, code)
);

-- Indexes for common query patterns
CREATE INDEX idx_tools_service_id ON tools(service_id);
CREATE INDEX idx_tools_code ON tools(code);
CREATE INDEX idx_tools_enabled ON tools(enabled);

-- Auto-update timestamp trigger
CREATE TRIGGER update_tools_updated_at
    BEFORE UPDATE ON tools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE tools IS 'Individual tools within a tool service';
COMMENT ON COLUMN tools.code IS 'Tool code used in URI: tool-type://service-code/tool-code';
COMMENT ON COLUMN tools.args IS 'ToolArgs JSON: {defs: {TypeName: TypeDef}, in: [ParamDef], out: OutputDef}';
COMMENT ON COLUMN tools.opts IS 'Tool-specific options (ConfigOptions structure)';

-- =====================================================
-- Helper function to get tool by URI
-- =====================================================
CREATE OR REPLACE FUNCTION get_tool_by_uri(
    p_tenant_id UUID,
    p_tool_type VARCHAR,
    p_service_code VARCHAR,
    p_tool_code VARCHAR
)
RETURNS TABLE (
    service_id UUID,
    service_code VARCHAR,
    service_name VARCHAR,
    service_config JSONB,
    tool_id UUID,
    tool_code VARCHAR,
    tool_name VARCHAR,
    tool_args JSONB,
    tool_opts JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ts.id as service_id,
        ts.code as service_code,
        ts.name as service_name,
        ts.config as service_config,
        t.id as tool_id,
        t.code as tool_code,
        t.name as tool_name,
        t.args as tool_args,
        t.opts as tool_opts
    FROM tool_services ts
    JOIN tools t ON t.service_id = ts.id
    WHERE ts.tenant_id = p_tenant_id
      AND ts.tool_type = p_tool_type
      AND ts.code = p_service_code
      AND t.code = p_tool_code
      AND ts.enabled = true
      AND t.enabled = true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tool_by_uri IS 'Get tool service and tool by parsed URI components';

-- =====================================================
-- Migrate existing tool_api_services to tool_services
-- =====================================================
INSERT INTO tool_services (tenant_id, tool_type, code, name, description, config, enabled, created_at, updated_at)
SELECT
    tenant_id,
    'api',
    name,
    display_name,
    description,
    jsonb_build_object(
        'type', 'Api',
        'base_url', base_url,
        'auth', CASE
            WHEN auth_type = 'none' THEN NULL
            ELSE jsonb_build_object('type', auth_type, 'config', auth_config)
        END,
        'default_headers', default_headers,
        'timeout_ms', timeout_ms,
        'retry', CASE
            WHEN retry_count > 0 THEN jsonb_build_object('max_retries', retry_count)
            ELSE NULL
        END
    ),
    enabled,
    created_at,
    updated_at
FROM tool_api_services
ON CONFLICT (tenant_id, tool_type, code) DO NOTHING;

-- =====================================================
-- Migrate existing tool_datasources to tool_services
-- =====================================================
INSERT INTO tool_services (tenant_id, tool_type, code, name, description, config, enabled, created_at, updated_at)
SELECT
    tenant_id,
    'db',
    name,
    display_name,
    description,
    jsonb_build_object(
        'type', 'Db',
        'db_type', db_type,
        'connection_string', connection_string,
        'schema', schema_name,
        'pool_size', pool_size,
        'timeout_ms', timeout_ms,
        'read_only', read_only
    ),
    enabled,
    created_at,
    updated_at
FROM tool_datasources
ON CONFLICT (tenant_id, tool_type, code) DO NOTHING;

-- =====================================================
-- Create default db tools from tool_udfs
-- =====================================================
INSERT INTO tools (service_id, code, name, description, args, enabled, created_at, updated_at)
SELECT
    ts.id,
    u.name,
    u.display_name,
    u.description,
    jsonb_build_object(
        'defs', '{}',
        'in', COALESCE(u.input_schema, '[]'::jsonb),
        'out', COALESCE(u.output_schema, 'null'::jsonb)
    ),
    u.enabled,
    u.created_at,
    u.updated_at
FROM tool_udfs u
CROSS JOIN tool_services ts
WHERE ts.tool_type = 'db'
  AND u.is_builtin = true
  AND u.enabled = true
ON CONFLICT (service_id, code) DO NOTHING;
