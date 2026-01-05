-- Migration: Create execution_history table
-- Description: Historical execution records for audit and analytics

CREATE TABLE IF NOT EXISTS execution_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL,
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    version_id UUID REFERENCES flow_versions(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Flow info at execution time
    flow_name VARCHAR(255) NOT NULL,
    version_number INTEGER,

    -- Execution result
    status execution_status NOT NULL,
    input_params JSONB DEFAULT '{}',
    output_result JSONB,

    -- Error info
    error_message TEXT,
    error_node VARCHAR(255),

    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER, -- Execution duration in milliseconds

    -- Statistics
    nodes_executed INTEGER NOT NULL DEFAULT 0,
    nodes_failed INTEGER NOT NULL DEFAULT 0,

    -- Audit
    executed_by VARCHAR(255),
    execution_source VARCHAR(50), -- 'api', 'scheduler', 'manual', 'webhook'

    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_execution_history_execution_id ON execution_history(execution_id);
CREATE INDEX idx_execution_history_flow_id ON execution_history(flow_id);
CREATE INDEX idx_execution_history_tenant_id ON execution_history(tenant_id);
CREATE INDEX idx_execution_history_status ON execution_history(status);
CREATE INDEX idx_execution_history_started_at ON execution_history(started_at DESC);

-- Composite index for tenant queries
CREATE INDEX idx_execution_history_tenant_started
    ON execution_history(tenant_id, started_at DESC);

-- Index for analytics queries
CREATE INDEX idx_execution_history_analytics
    ON execution_history(tenant_id, flow_id, status, started_at DESC);

-- Row Level Security
ALTER TABLE execution_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY execution_history_tenant_isolation ON execution_history
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Function to archive completed executions
CREATE OR REPLACE FUNCTION archive_completed_execution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status = 'running' THEN
        INSERT INTO execution_history (
            execution_id, flow_id, version_id, tenant_id,
            flow_name, version_number, status,
            input_params, output_result,
            error_message, error_node,
            started_at, completed_at, duration_ms,
            nodes_executed, nodes_failed,
            metadata
        )
        SELECT
            NEW.execution_id, NEW.flow_id, NEW.version_id, NEW.tenant_id,
            f.name, fv.version_number, NEW.status,
            NEW.input_params, NEW.output_result,
            NEW.error_message, NEW.error_node,
            NEW.started_at, NEW.completed_at,
            EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)) * 1000,
            array_length(NEW.completed_nodes, 1),
            CASE WHEN NEW.error_node IS NOT NULL THEN 1 ELSE 0 END,
            NEW.execution_metadata
        FROM flows f
        LEFT JOIN flow_versions fv ON fv.id = NEW.version_id
        WHERE f.id = NEW.flow_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER archive_execution_trigger
    AFTER UPDATE ON execution_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION archive_completed_execution();

COMMENT ON TABLE execution_history IS 'Historical execution records for audit and analytics';
COMMENT ON COLUMN execution_history.duration_ms IS 'Total execution duration in milliseconds';
COMMENT ON COLUMN execution_history.execution_source IS 'How the execution was triggered';
