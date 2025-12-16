-- ============================================
-- Add Ticket History Table
-- Version: 1.0.0
-- ============================================

-- Ticket History 表
CREATE TABLE IF NOT EXISTS ticket_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    change_type VARCHAR(20) NOT NULL,
    field_name VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 约束
    CONSTRAINT chk_change_type CHECK (change_type IN (
        'status', 'priority', 'resolution', 'tag_added', 'tag_removed'
    ))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON ticket_history(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_history_change_type ON ticket_history(change_type);

-- 注释
COMMENT ON TABLE ticket_history IS '票据变更历史记录表';
COMMENT ON COLUMN ticket_history.id IS '历史记录唯一标识';
COMMENT ON COLUMN ticket_history.ticket_id IS '关联的票据 ID';
COMMENT ON COLUMN ticket_history.change_type IS '变更类型: status, priority, resolution, tag_added, tag_removed';
COMMENT ON COLUMN ticket_history.field_name IS '字段名（如 status, priority），标签变更时为 NULL';
COMMENT ON COLUMN ticket_history.old_value IS '变更前的值';
COMMENT ON COLUMN ticket_history.new_value IS '变更后的值';
COMMENT ON COLUMN ticket_history.created_at IS '变更时间';

