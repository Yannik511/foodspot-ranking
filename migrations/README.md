# Database Migrations

Dieses Verzeichnis enthält alle Datenbank-Migrationen für die Foodspot Ranking App.

## Letzte Migration

**047_create_get_list_entry_counts_function_up.sql** – Aggregiert Foodspot-Anzahlen in einem RPC
- Liefert für beliebige `list_id`s serverseitig `entry_count`
- Reduziert dutzende Einzelqueries beim Laden der Dashboards

**045_rollback_profile_visibility.sql** – Rollback des experimentellen Profile-Visibility-Features
- Stellt die ursprüngliche Freundeslogik wieder her
- Entfernt die zusätzliche `profile_visibility`-Spalte aus `user_profiles`
- Setzt RLS/Policies auf den stabilen Zustand zurück

> Hinweise:
> - `046_create_get_shared_list_members_function_up.sql` (optional) sorgt dafür, dass Editoren alle Mitglieder sehen können. Down-Datei vorhanden.
> - `047...` sollte vor dem nächsten Deploy ausgeführt werden, damit die Frontend-Optimierung aktiv wird.

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
