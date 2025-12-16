-- ============================================
-- Seed Data: Predefined Tags
-- ============================================

-- 状态类标签
INSERT INTO tags (name, color, icon, is_predefined) VALUES
    ('Bug', '#EF4444', 'bug', TRUE),
    ('Feature', '#3B82F6', 'sparkles', TRUE),
    ('Enhancement', '#8B5CF6', 'trending-up', TRUE),
    ('Documentation', '#06B6D4', 'file-text', TRUE),
    ('Question', '#F59E0B', 'help-circle', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 优先级类标签
INSERT INTO tags (name, color, icon, is_predefined) VALUES
    ('Critical', '#DC2626', 'alert-octagon', TRUE),
    ('Blocker', '#B91C1C', 'ban', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 模块类标签
INSERT INTO tags (name, color, icon, is_predefined) VALUES
    ('Frontend', '#10B981', 'monitor', TRUE),
    ('Backend', '#6366F1', 'server', TRUE),
    ('Database', '#F97316', 'database', TRUE),
    ('API', '#EC4899', 'webhook', TRUE),
    ('UI/UX', '#14B8A6', 'palette', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 工作流标签
INSERT INTO tags (name, color, icon, is_predefined) VALUES
    ('Needs Review', '#FBBF24', 'eye', TRUE),
    ('In Testing', '#A855F7', 'test-tube', TRUE),
    ('Ready for Deploy', '#22C55E', 'rocket', TRUE),
    ('On Hold', '#6B7280', 'pause-circle', TRUE)
ON CONFLICT (name) DO NOTHING;

