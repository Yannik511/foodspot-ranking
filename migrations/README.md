# 🗄️ Database Migrations

Dieser Ordner enthält alle SQL-Migrationen für die Foodspot Ranking App.

## 📋 Migrations-Übersicht

### ✅ Aktive Migrationen (Verwenden!)

| Datei | Beschreibung | Reihenfolge |
|-------|--------------|-------------|
| `000_complete_setup.sql` | **ALLES IN EINEM** - Komplettes Setup (empfohlen für Neustart) | 1️⃣ |
| `001_reset_database.sql` | Löscht alle Tabellen, Policies, Trigger, etc. | 1️⃣ |
| `002_create_lists_table.sql` | Erstellt die `lists` Tabelle | 2️⃣ |
| `003_create_foodspots_table.sql` | Erstellt die `foodspots` Tabelle | 3️⃣ |
| `004_create_indexes.sql` | Erstellt alle Indizes | 4️⃣ |
| `005_create_triggers.sql` | Erstellt Trigger für `updated_at` | 5️⃣ |
| `006_create_storage_buckets.sql` | **MANUELL** - Anleitung für Storage Buckets | 6️⃣ |
| `007_create_storage_policies.sql` | Erstellt RLS Policies für Storage | 7️⃣ |
| `008_create_rls_policies.sql` | Erstellt RLS Policies für Tabellen | 8️⃣ |

### ⚠️ Deaktivierte Migrationen (Nicht verwenden!)

Diese Migrationen sind veraltet und wurden durch `RESTORE_BASIC_FUNCTIONS.sql` (im Root-Verzeichnis) ersetzt:
- `010_fix_shared_lists_rls.sql.DISABLED` - Veraltete Shared Lists RLS Fix
- `011_restore_original_policies.sql.DISABLED` - Veralteter Policy Restore
- `012_fix_shared_lists_rls_safe.sql.DISABLED` - Veraltete Safe RLS Fix
- `013_EMERGENCY_RESTORE_ALL_POLICIES.sql.DISABLED` - Veralteter Emergency Restore
- `014_VERIFY_RLS_ENABLED.sql.DISABLED` - Veraltete RLS Verifikation

**Für RLS-Reparaturen verwende:** `../RESTORE_BASIC_FUNCTIONS.sql` im Root-Verzeichnis!

## 🔧 RLS-Policies reparieren

Falls Probleme mit RLS-Policies auftreten (z.B. Listen werden nicht angezeigt):

**Verwende:** `../RESTORE_BASIC_FUNCTIONS.sql` (im Root-Verzeichnis)

Diese Datei stellt alle grundlegenden RLS-Policies wieder her und entfernt problematische Policies.

## 🚀 Schnellstart: Komplettes Setup

### Option 1: Alles in einem (Empfohlen)

1. **Öffne Supabase Dashboard** → SQL Editor
2. **Kopiere** den Inhalt von `000_complete_setup.sql`
3. **Füge** ihn in den SQL Editor ein
4. **Führe** die Query aus (Cmd/Ctrl + Enter)
5. **Erstelle Storage Buckets manuell** (siehe unten)
6. **Führe** `007_create_storage_policies.sql` aus

### Option 2: Schritt für Schritt

Führe die Migrationen in dieser Reihenfolge aus:

1. `001_reset_database.sql` - Reset
2. `002_create_lists_table.sql` - Lists Tabelle
3. `003_create_foodspots_table.sql` - Foodspots Tabelle
4. `004_create_indexes.sql` - Indizes
5. `005_create_triggers.sql` - Trigger
6. **Manuell**: Storage Buckets erstellen (siehe unten)
7. `007_create_storage_policies.sql` - Storage Policies
8. `008_create_rls_policies.sql` - RLS Policies

## 📦 Storage Buckets erstellen (Manuell)

Die Storage Buckets müssen manuell im Supabase Dashboard erstellt werden:

### Bucket 1: `list-covers`

1. Gehe zu **Storage** → **New Bucket**
2. **Name**: `list-covers`
3. **Public bucket**: ✅ **ENABLED**
4. **File size limit**: 5 MB (optional)
5. **Allowed MIME types**: `image/*` (optional)
6. Klicke auf **Create Bucket**

### Bucket 2: `profile-avatars`

1. Gehe zu **Storage** → **New Bucket**
2. **Name**: `profile-avatars`
3. **Public bucket**: ✅ **ENABLED**
4. **File size limit**: 2 MB (optional)
5. **Allowed MIME types**: `image/*` (optional)
6. Klicke auf **Create Bucket**

### Verifikation

Nach dem Erstellen, führe diese Query aus:

```sql
SELECT name, public FROM storage.buckets 
WHERE name IN ('list-covers', 'profile-avatars');
```

Du solltest beide Buckets sehen.

## ✅ Erfolg-Checkliste

Nach dem Ausführen aller Migrationen:

- [ ] `lists` Tabelle existiert
- [ ] `foodspots` Tabelle existiert
- [ ] Alle Indizes erstellt
- [ ] Trigger funktionieren
- [ ] RLS Policies aktiviert
- [ ] Storage Buckets erstellt (`list-covers`, `profile-avatars`)
- [ ] Storage Policies erstellt

## 🧪 Testen

Nach dem Setup kannst du testen:

1. **Erstelle einen Test-User** (über Auth → Users)
2. **Logge dich in der App ein**
3. **Erstelle eine Liste**
4. **Füge einen Foodspot hinzu**
5. **Prüfe in Supabase Table Editor**, ob alles gespeichert wurde

## 🐛 Troubleshooting

### "relation already exists"
- Die Tabelle existiert bereits
- Führe zuerst `001_reset_database.sql` aus

### "policy already exists"
- Die Policy existiert bereits
- Führe zuerst `001_reset_database.sql` aus

### "bucket does not exist"
- Storage Bucket wurde noch nicht erstellt
- Erstelle die Buckets manuell (siehe oben)

### "permission denied"
- RLS Policies sind nicht korrekt
- Prüfe, ob `008_create_rls_policies.sql` ausgeführt wurde
- Prüfe, ob der User eingeloggt ist

## 📚 Weitere Ressourcen

- [Supabase SQL Editor](https://supabase.com/docs/guides/database/tables)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)






