-- Migration: Add flow publish status
-- Description: Support for publishing flows for external access

-- Add publish-related columns to flows table
ALTER TABLE flows ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE flows ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE flows ADD COLUMN IF NOT EXISTS published_version_id UUID REFERENCES flow_versions(id);

-- Index for quickly finding published flows
CREATE INDEX IF NOT EXISTS idx_flows_published ON flows(published) WHERE published = true;

COMMENT ON COLUMN flows.published IS 'Whether the flow is published for external access';
COMMENT ON COLUMN flows.published_at IS 'Timestamp when the flow was published';
COMMENT ON COLUMN flows.published_version_id IS 'The version that is currently published';
