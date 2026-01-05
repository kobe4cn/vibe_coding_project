-- Migration: Fix default tenant ID
-- Description: Update default tenant to use well-known UUID for consistency

-- First, update any flows that reference the old default tenant
UPDATE flows
SET tenant_id = '00000000-0000-0000-0000-000000000001'::UUID
WHERE tenant_id = (SELECT id FROM tenants WHERE bu_code = 'default');

-- Update flow_versions
UPDATE flow_versions
SET tenant_id = '00000000-0000-0000-0000-000000000001'::UUID
WHERE tenant_id = (SELECT id FROM tenants WHERE bu_code = 'default');

-- Update execution_snapshots
UPDATE execution_snapshots
SET tenant_id = '00000000-0000-0000-0000-000000000001'::UUID
WHERE tenant_id = (SELECT id FROM tenants WHERE bu_code = 'default');

-- Delete the old default tenant
DELETE FROM tenants WHERE bu_code = 'default';

-- Insert default tenant with well-known UUID
INSERT INTO tenants (id, bu_code, name, description)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'default',
    'Default Tenant',
    'Default tenant for development'
)
ON CONFLICT (bu_code) DO UPDATE SET id = '00000000-0000-0000-0000-000000000001'::UUID;

COMMENT ON TABLE tenants IS 'Multi-tenant configuration and quotas. Default tenant has well-known UUID 00000000-0000-0000-0000-000000000001';
