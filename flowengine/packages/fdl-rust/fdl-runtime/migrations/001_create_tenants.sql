-- Migration: Create tenants table
-- Description: Multi-tenant support for FDL runtime

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bu_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',

    -- Quotas
    max_flows INTEGER NOT NULL DEFAULT 100,
    max_executions_per_day INTEGER NOT NULL DEFAULT 1000,
    max_storage_mb INTEGER NOT NULL DEFAULT 1024,

    -- Usage tracking
    current_flow_count INTEGER NOT NULL DEFAULT 0,
    current_storage_mb NUMERIC(10, 2) NOT NULL DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tenants_bu_code ON tenants(bu_code);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Default tenant for development
INSERT INTO tenants (bu_code, name, description)
VALUES ('default', 'Default Tenant', 'Default tenant for development')
ON CONFLICT (bu_code) DO NOTHING;

COMMENT ON TABLE tenants IS 'Multi-tenant configuration and quotas';
COMMENT ON COLUMN tenants.bu_code IS 'Business unit code for tenant identification';
COMMENT ON COLUMN tenants.config IS 'Tenant-specific configuration as JSON';
