-- Migration: Create audit_logs table
-- Description: Audit logging for security and compliance

CREATE TYPE audit_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

    -- Event info
    event_type VARCHAR(100) NOT NULL,
    severity audit_severity NOT NULL DEFAULT 'low',
    description TEXT NOT NULL,

    -- Actor info
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,

    -- Resource info
    resource_type VARCHAR(50), -- 'flow', 'version', 'execution', 'tenant'
    resource_id UUID,

    -- Request info
    request_method VARCHAR(10),
    request_path TEXT,
    request_params JSONB,

    -- Additional data
    metadata JSONB DEFAULT '{}',

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for security queries
CREATE INDEX idx_audit_logs_security
    ON audit_logs(severity, created_at DESC)
    WHERE severity IN ('high', 'critical');

-- Partitioning by month for better performance
-- Note: Uncomment and run for production
-- CREATE TABLE audit_logs_template (LIKE audit_logs INCLUDING ALL);
-- ALTER TABLE audit_logs PARTITION BY RANGE (created_at);

-- Row Level Security (Note: Audit logs may need different policies)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their tenant's logs
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_tenant_id UUID,
    p_event_type VARCHAR(100),
    p_severity audit_severity,
    p_description TEXT,
    p_user_id VARCHAR(255) DEFAULT NULL,
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO audit_logs (
        tenant_id, event_type, severity, description,
        user_id, resource_type, resource_id, metadata
    )
    VALUES (
        p_tenant_id, p_event_type, p_severity, p_description,
        p_user_id, p_resource_type, p_resource_id, p_metadata
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE audit_logs IS 'Security and compliance audit trail';
COMMENT ON COLUMN audit_logs.event_type IS 'Type of audit event (e.g., flow.create, execution.start)';
COMMENT ON COLUMN audit_logs.severity IS 'Event severity level for alerting';
