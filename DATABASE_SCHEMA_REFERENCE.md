# 📊 Database Schema Reference

## Aktuelle `lists` Tabelle Struktur

```sql
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Unique constraint: User kann keine zwei Listen mit gleichem Namen haben
  UNIQUE(user_id, list_name)
);
```

## Verfügbare Felder

| Feld | Typ | NOT NULL? | Beschreibung |
|------|-----|-----------|--------------|
| `id` | UUID | ✅ | Primary Key |
| `user_id` | UUID | ✅ | Foreign Key zu `auth.users` |
| `list_name` | VARCHAR(100) | ✅ | Name der Liste |
| `city` | VARCHAR(100) | ✅ | Stadt |
| `description` | TEXT | ❌ | Beschreibung |
| `cover_image_url` | TEXT | ❌ | URL zum Cover-Bild |
| `created_at` | TIMESTAMP | ✅ | Erstellt am |
| `updated_at` | TIMESTAMP | ✅ | Zuletzt aktualisiert |

## Entfernte Felder (nicht mehr verwendet)

- ❌ `category` - Kategorie wurde entfernt
- ❌ `accent_color` - Farb-Akzent wurde entfernt
- ❌ `is_public` - Öffentlichkeits-Toggle wurde entfernt

## Indexes

- `idx_lists_user_id` - Für schnelle Abfragen nach User
- `idx_lists_created_at` - Für Sortierung nach Datum

## RLS Policies

1. ✅ "Users can view own lists" - SELECT
2. ✅ "Users can create own lists" - INSERT
3. ✅ "Users can update own lists" - UPDATE
4. ✅ "Users can delete own lists" - DELETE

## Setup

Für frisches Setup:

1. Führe `COMPLETE_RESET.sql` aus (Clean Start)
2. Dann füge Storage Bucket "list-covers" hinzu
3. Dann füge `supabase_storage_policies.sql` hinzu

Siehe auch: `SCHNELLSTART_SUPABASE.md` für vollständige Anleitung.

