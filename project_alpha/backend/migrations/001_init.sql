-- ============================================
-- Ticket Management System - Database Schema
-- Version: 1.0.0
-- ============================================

-- 启用 UUID 扩展（PostgreSQL 13+ 默认包含）
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. 创建表结构
-- ============================================

-- Tickets 表
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    resolution TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 约束
    CONSTRAINT chk_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT chk_status CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT chk_title_not_empty CHECK (TRIM(title) <> '')
);

-- Tags 表
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
    icon VARCHAR(50),
    is_predefined BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 约束
    CONSTRAINT uq_tag_name UNIQUE (name),
    CONSTRAINT chk_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_name_not_empty CHECK (TRIM(name) <> '')
);

-- Ticket-Tag 关联表
CREATE TABLE IF NOT EXISTS ticket_tags (
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (ticket_id, tag_id)
);

-- Attachments 表
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 约束
    CONSTRAINT chk_filename_not_empty CHECK (TRIM(filename) <> ''),
    CONSTRAINT chk_size_positive CHECK (size_bytes > 0)
);

-- ============================================
-- 2. 创建索引
-- ============================================

-- Tickets 索引
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC);

-- Tags 索引
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_is_predefined ON tags(is_predefined);

-- Ticket-Tag 关联索引
CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket_id ON ticket_tags(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag_id ON ticket_tags(tag_id);

-- Attachments 索引
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_id ON attachments(ticket_id);

-- ============================================
-- 3. 创建触发器函数
-- ============================================

-- 自动更新 updated_at 的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 tickets 表添加触发器
DROP TRIGGER IF EXISTS trigger_tickets_updated_at ON tickets;
CREATE TRIGGER trigger_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. 添加注释
-- ============================================

COMMENT ON TABLE tickets IS '票据主表';
COMMENT ON COLUMN tickets.id IS '票据唯一标识';
COMMENT ON COLUMN tickets.title IS '票据标题';
COMMENT ON COLUMN tickets.description IS '票据描述';
COMMENT ON COLUMN tickets.priority IS '优先级: low, medium, high, urgent';
COMMENT ON COLUMN tickets.status IS '状态: open, in_progress, completed, cancelled';
COMMENT ON COLUMN tickets.resolution IS '处理结果';
COMMENT ON COLUMN tickets.completed_at IS '完成时间';

COMMENT ON TABLE tags IS '标签表';
COMMENT ON COLUMN tags.is_predefined IS '是否为系统预定义标签';
COMMENT ON COLUMN tags.color IS 'HEX 颜色值，如 #3B82F6';
COMMENT ON COLUMN tags.icon IS 'Lucide 图标名称，如 bug, alert-circle';

COMMENT ON TABLE ticket_tags IS '票据-标签关联表';
COMMENT ON TABLE attachments IS '附件表';

