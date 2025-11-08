# 📦 Archive

Dieser Ordner enthält archivierte Dateien, die nicht mehr aktiv verwendet werden, aber aus historischen Gründen aufbewahrt werden.

## 📁 Struktur

### `sql-scripts/`
Alte SQL-Skripte, die nicht mehr verwendet werden oder durch neuere Versionen ersetzt wurden:
- `DELETE_SHARED_LISTS.sql` - Alte Lösch-Query (ersetzt durch RESTORE_BASIC_FUNCTIONS.sql)
- `FIX_RLS_*.sql` - Alte RLS-Fix-Versuche
- `COMPLETE_RESET.sql` - Alte Reset-Query
- `supabase_*.sql` - Alte Schema-Definitionen

### `docs/`
Temporäre Dokumentationsdateien, die während des Debuggings/Entwickelns entstanden sind:
- `FIX_ANLEITUNG.md` - Temporäre Fix-Anleitung
- `ZUSAMMENFASSUNG_FIX.md` - Temporäre Zusammenfassung
- `FEHLER_ANALYSE_*.md` - Fehleranalyse-Dokumente
- `MOBILE_FIX_ANLEITUNG.md` - Mobile-spezifische Fixes
- `VITE_APP_STATUS.md` - Temporärer Status-Report

## ⚠️ Wichtig

**Diese Dateien sollten NICHT mehr verwendet werden!**

Für aktuelle SQL-Skripte siehe:
- `RESTORE_BASIC_FUNCTIONS.sql` (im Root-Verzeichnis)
- `migrations/` Ordner (für Datenbank-Migrationen)

Für aktuelle Dokumentation siehe:
- `README.md` (Hauptdokumentation)
- `docs/` Ordner (aktuelle Setup-Anleitungen)
- `SCHNELLSTART_SUPABASE.md` (Setup-Anleitung)

