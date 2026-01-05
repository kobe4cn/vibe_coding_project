-- Migration: Create flow_versions table
-- Description: Flow version history

CREATE TABLE IF NOT EXISTS flow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Version info
    version_number INTEGER NOT NULL,
    label VARCHAR(255),
    description TEXT,

    -- Flow data
    data JSONB NOT NULL, -- Complete flow definition

    -- Metadata
    is_auto_save BOOLEAN NOT NULL DEFAULT false,
    tags TEXT[] DEFAULT '{}',

    -- Audit
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint per flow
    UNIQUE(flow_id, version_number)
);

-- Indexes
CREATE INDEX idx_flow_versions_flow_id ON flow_versions(flow_id);
CREATE INDEX idx_flow_versions_tenant_id ON flow_versions(tenant_id);
CREATE INDEX idx_flow_versions_version_number ON flow_versions(flow_id, version_number DESC);
CREATE INDEX idx_flow_versions_created_at ON flow_versions(created_at DESC);
CREATE INDEX idx_flow_versions_is_auto_save ON flow_versions(is_auto_save);

-- Row Level Security
ALTER TABLE flow_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see versions in their tenant
CREATE POLICY flow_versions_tenant_isolation ON flow_versions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Function to update flow metadata when version is created
CREATE OR REPLACE FUNCTION update_flow_version_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE flows SET
            version_count = version_count + 1,
            latest_version = NEW.version_number,
            updated_at = NOW()
        WHERE id = NEW.flow_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE flows SET
            version_count = version_count - 1,
            latest_version = COALESCE(
                (SELECT MAX(version_number) FROM flow_versions WHERE flow_id = OLD.flow_id),
                0
            ),
            updated_at = NOW()
        WHERE id = OLD.flow_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER flow_versions_count_trigger
    AFTER INSERT OR DELETE ON flow_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_flow_version_count();

COMMENT ON TABLE flow_versions IS 'Flow version history with complete flow data';
COMMENT ON COLUMN flow_versions.data IS 'Complete flow definition as JSON';
COMMENT ON COLUMN flow_versions.is_auto_save IS 'Whether this version was auto-saved';
