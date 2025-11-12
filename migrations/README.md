# Database Migrations

Dieses Verzeichnis enthält alle Datenbank-Migrationen für die Foodspot Ranking App.

## Letzte Migration

**043_fix_merge_foodspot_null_score.sql** - NULL Score Handling & Description Fix
- Behebt 400 Bad Request Fehler beim Bearbeiten von Beschreibungen
- Speichert Beschreibungen in korrekte `description` Spalte
- Rating wird nur eingefügt wenn Score vorhanden ist

Siehe `APPLY_MIGRATION_043.md` im Hauptverzeichnis für Details.

## Migrations-Übersicht

### Setup & Core (000-009)
- `000-008`: Basis-Setup (Tabellen, Indexes, Triggers, Storage, RLS)

### Shared Lists (015-024)
- Geteilte Listen-Funktionalität, RLS-Fixes, Einladungen

### Photos & Profiles (025-031)
- Shared Foodspot Photos, User Profiles

### Rating System (037-043)
- Rating-Präzision, Merge-Funktionen, Score-Handling

## Anwendung

**Über Supabase Dashboard (empfohlen):**
1. https://supabase.com/dashboard → SQL Editor
2. Migration-Inhalt kopieren & einfügen
3. Run (Cmd+Enter)

**Über CLI:**
```bash
supabase db push
# oder
psql $DATABASE_URL -f migrations/XXX_name.sql
```

## Archiv

Alte/deaktivierte Migrations: `archive/cleanup-YYYYMMDD/`
