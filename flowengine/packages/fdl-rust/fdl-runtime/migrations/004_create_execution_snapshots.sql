-- Migration: Create execution_snapshots table
-- Description: Execution state persistence for recovery

CREATE TYPE execution_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled',
    'paused'
);

CREATE TABLE IF NOT EXISTS execution_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL UNIQUE,
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    version_id UUID REFERENCES flow_versions(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Execution state
    status execution_status NOT NULL DEFAULT 'pending',
    progress NUMERIC(5, 4) NOT NULL DEFAULT 0, -- 0.0000 to 1.0000

    -- Context data
    variables JSONB NOT NULL DEFAULT '{}',
    completed_nodes TEXT[] DEFAULT '{}',
    current_node VARCHAR(255),
    pending_nodes TEXT[] DEFAULT '{}',

    -- Error info
    error_message TEXT,
    error_node VARCHAR(255),
    error_details JSONB,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata
    input_params JSONB DEFAULT '{}',
    output_result JSONB,
    execution_metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_execution_snapshots_execution_id ON execution_snapshots(execution_id);
CREATE INDEX idx_execution_snapshots_flow_id ON execution_snapshots(flow_id);
CREATE INDEX idx_execution_snapshots_tenant_id ON execution_snapshots(tenant_id);
CREATE INDEX idx_execution_snapshots_status ON execution_snapshots(status);
CREATE INDEX idx_execution_snapshots_started_at ON execution_snapshots(started_at DESC);

-- Index for finding recoverable executions
CREATE INDEX idx_execution_snapshots_recoverable
    ON execution_snapshots(tenant_id, status)
    WHERE status IN ('running', 'paused');

-- Row Level Security
ALTER TABLE execution_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY execution_snapshots_tenant_isolation ON execution_snapshots
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE execution_snapshots IS 'Execution state snapshots for recovery and monitoring';
COMMENT ON COLUMN execution_snapshots.variables IS 'Current execution context variables';
COMMENT ON COLUMN execution_snapshots.completed_nodes IS 'List of completed node IDs';
COMMENT ON COLUMN execution_snapshots.progress IS 'Execution progress from 0 to 1';
