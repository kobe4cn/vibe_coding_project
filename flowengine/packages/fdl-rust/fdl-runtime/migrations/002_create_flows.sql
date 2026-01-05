-- Migration: Create flows table
-- Description: Flow definitions registry

CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Flow metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    thumbnail TEXT, -- Base64 encoded thumbnail

    -- Version tracking
    latest_version INTEGER NOT NULL DEFAULT 0,
    version_count INTEGER NOT NULL DEFAULT 0,

    -- Audit
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_flows_tenant_id ON flows(tenant_id);
CREATE INDEX idx_flows_name ON flows(name);
CREATE INDEX idx_flows_tags ON flows USING GIN(tags);
CREATE INDEX idx_flows_updated_at ON flows(updated_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_flows_updated_at
    BEFORE UPDATE ON flows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see flows in their tenant
CREATE POLICY flows_tenant_isolation ON flows
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE flows IS 'Flow definitions registry';
COMMENT ON COLUMN flows.thumbnail IS 'Base64 encoded PNG thumbnail of the flow';
COMMENT ON COLUMN flows.latest_version IS 'Latest version number for quick access';
