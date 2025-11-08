-- =============================================
-- MIGRATION 004: CREATE INDEXES
-- =============================================
-- Erstellt alle notwendigen Indizes für optimale Performance
-- =============================================

-- Indizes für lists Tabelle
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_is_public ON lists(is_public);
CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lists_category ON lists(category);

-- Indizes für foodspots Tabelle
CREATE INDEX IF NOT EXISTS idx_foodspots_list_id ON foodspots(list_id);
CREATE INDEX IF NOT EXISTS idx_foodspots_user_id ON foodspots(user_id);
CREATE INDEX IF NOT EXISTS idx_foodspots_tier ON foodspots(tier);
CREATE INDEX IF NOT EXISTS idx_foodspots_category ON foodspots(category);

-- =============================================
-- SUCCESS: Indexes Created
-- =============================================






