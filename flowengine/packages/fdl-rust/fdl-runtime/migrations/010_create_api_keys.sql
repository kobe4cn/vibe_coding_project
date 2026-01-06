-- Migration: Create API keys table
-- Description: API keys for external flow execution

CREATE TABLE IF NOT EXISTS flow_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,

    -- Key metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Key security
    key_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of the key
    key_prefix VARCHAR(8) NOT NULL, -- First 8 chars for identification

    -- Access control
    rate_limit INTEGER DEFAULT 100, -- Requests per minute
    allowed_ips TEXT[],             -- IP whitelist (optional)

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER NOT NULL DEFAULT 0,

    -- Audit
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ          -- Optional expiration
);

-- Indexes
CREATE INDEX idx_flow_api_keys_tenant_id ON flow_api_keys(tenant_id);
CREATE INDEX idx_flow_api_keys_flow_id ON flow_api_keys(flow_id);
CREATE INDEX idx_flow_api_keys_key_prefix ON flow_api_keys(key_prefix);
CREATE INDEX idx_flow_api_keys_key_hash ON flow_api_keys(key_hash);
CREATE INDEX idx_flow_api_keys_active ON flow_api_keys(is_active) WHERE is_active = true;

-- Row Level Security
ALTER TABLE flow_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see API keys in their tenant
CREATE POLICY flow_api_keys_tenant_isolation ON flow_api_keys
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE flow_api_keys IS 'API keys for external flow execution';
COMMENT ON COLUMN flow_api_keys.key_hash IS 'SHA-256 hash of the API key';
COMMENT ON COLUMN flow_api_keys.key_prefix IS 'First 8 characters of the key for identification';
COMMENT ON COLUMN flow_api_keys.rate_limit IS 'Maximum requests per minute';
