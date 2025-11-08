# 🗄️ Database Setup Guide

Dieses Dokument beschreibt, wie du die Datenbank-Struktur für Foodspot Ranker in Supabase einrichtest.

## Übersicht

Die App benötigt folgende Tabellen:
- `lists` - Für User-Listen (z.B. "Beste Burger Münchens")
- `foodspots` - Für einzelne Foodspots innerhalb einer Liste (später)
- `friend_requests` - Für das Friends-System (später)
- `shared_lists` - Für geteilte Listen (später)

## Schritt 1: SQL Editor öffnen

1. Gehe zu deinem Supabase Dashboard
2. Klicke auf **SQL Editor** (linke Sidebar)
3. Klicke auf **New Query** oder **+ New Query**

## Schritt 2: Tables erstellen

Kopiere den folgenden SQL-Code und füge ihn in den SQL Editor ein:

```sql
-- =============================================
-- LISTS TABLE
-- =============================================
-- Speichert alle User-Listen (z.B. "Beste Burger Münchens")

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  accent_color VARCHAR(20) NOT NULL DEFAULT '#FF784F',
  cover_image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Unique constraint: User kann keine zwei Listen mit gleichem Namen haben
  UNIQUE(user_id, list_name)
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_is_public ON lists(is_public);
CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(created_at DESC);

-- Row Level Security (RLS) aktivieren
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Jeder User kann seine eigenen Listen sehen
CREATE POLICY "Users can view own lists"
  ON lists
  FOR SELECT
  USING (auth.uid() = user_id);

-- Jeder User kann seine eigenen Listen erstellen
CREATE POLICY "Users can create own lists"
  ON lists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Jeder User kann seine eigenen Listen aktualisieren
CREATE POLICY "Users can update own lists"
  ON lists
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Jeder User kann seine eigenen Listen löschen
CREATE POLICY "Users can delete own lists"
  ON lists
  FOR DELETE
  USING (auth.uid() = user_id);

-- Öffentliche Listen können von allen eingeloggten Usern gesehen werden
CREATE POLICY "Public lists are viewable by all users"
  ON lists
  FOR SELECT
  USING (is_public = true AND auth.uid() IS NOT NULL);

-- Trigger für updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON lists
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- =============================================
-- FOODSPOTS TABLE (Für später)
-- =============================================
-- Speichert einzelne Foodspots innerhalb einer Liste

CREATE TABLE IF NOT EXISTS foodspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(50),
  website TEXT,
  category VARCHAR(50),
  tier VARCHAR(1) CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'E')),
  rating DECIMAL(3, 2),
  notes TEXT,
  cover_photo_url TEXT,
  visited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_foodspots_list_id ON foodspots(list_id);
CREATE INDEX IF NOT EXISTS idx_foodspots_user_id ON foodspots(user_id);

-- RLS aktivieren
ALTER TABLE foodspots ENABLE ROW LEVEL SECURITY;

-- RLS Policies für foodspots
CREATE POLICY "Users can view foodspots in own lists"
  ON foodspots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists 
      WHERE lists.id = foodspots.list_id 
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create foodspots in own lists"
  ON foodspots
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM lists 
      WHERE lists.id = foodspots.list_id 
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own foodspots"
  ON foodspots
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own foodspots"
  ON foodspots
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger für updated_at
CREATE TRIGGER set_updated_at_foodspots
  BEFORE UPDATE ON foodspots
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
```

## Schritt 3: Storage Bucket erstellen

Für das Hochladen von Cover-Bildern:

1. Gehe zu **Storage** in der linken Sidebar
2. Klicke auf **New Bucket**
3. Name: `list-covers`
4. Public bucket: **Enabled** ✅
5. Klicke auf **Create Bucket**

Dann füge folgende Storage Policy hinzu:

```sql
-- Storage Policies für list-covers Bucket
-- Ersetze {bucket_id} mit der tatsächlichen Bucket-ID

-- Users können eigene Bilder hochladen
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'list-covers' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users können eigene Bilder ansehen
CREATE POLICY "Users can view own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'list-covers' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users können eigene Bilder löschen
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'list-covers' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Wichtig:** Ersetze in den Storage Policies `{bucket_id}` durch den tatsächlichen Bucket-Namen `'list-covers'`.

## Schritt 4: SQL ausführen

1. Klicke auf **Run** (oder drücke `Cmd/Ctrl + Enter`)
2. Warte auf die Erfolgs-Meldung ✅
3. Überprüfe in der **Table Editor**, ob die Tabellen erstellt wurden

## Schritt 5: Testen

1. Öffne deine App: http://localhost:5173
2. Logge dich ein
3. Klicke auf "Erstelle deine erste Liste"
4. Fülle das Formular aus und erstelle eine Liste
5. Überprüfe in Supabase **Table Editor** → `lists`, ob deine Liste gespeichert wurde

## ✅ Erfolg-Checkliste

- [ ] SQL erfolgreich ausgeführt (keine Errors)
- [ ] `lists` Tabelle existiert in Table Editor
- [ ] `foodspots` Tabelle existiert in Table Editor
- [ ] `list-covers` Storage Bucket erstellt
- [ ] Storage Policies hinzugefügt
- [ ] Test-Liste kann erstellt werden
- [ ] Liste erscheint im Dashboard

## 🐛 Troubleshooting

### "permission denied for table lists"
- Prüfe, ob RLS Policies korrekt erstellt wurden
- Prüfe, ob der User eingeloggt ist

### "duplicate key value violates unique constraint"
- Ein User kann nicht zwei Listen mit dem gleichen Namen haben
- Ändere den Listen-Namen

### Storage Upload fehlgeschlagen
- Prüfe, ob Storage Bucket existiert
- Prüfe, ob Storage Policies korrekt sind
- Prüfe, ob Bucket öffentlich ist

### Bilder werden nicht angezeigt
- Prüfe Supabase Storage → Settings → Public URL Format
- Verwende `getPublicUrl()` für korrekte URLs

## 📚 Weitere Ressourcen

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)













