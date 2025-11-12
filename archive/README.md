# Archive

Dieses Verzeichnis enthält archivierte Dateien aus vorherigen Entwicklungsphasen.

## Struktur

### `/docs/` - Alte Fix-Dokumentationen
Dokumentationen von Fehlerbehebungen und Analysen aus früheren Entwicklungsphasen:
- RLS-Fixes
- Mobile-App Fixes  
- Vite-App Status
- Feature-Analysen

### `/sql-scripts/` - Alte SQL-Skripte
Frühere SQL-Skripte für:
- User Stats
- Avatar Setup
- Storage Policies
- Social Schema
- RLS-Fixes

Diese wurden durch die strukturierten Migrations im `/migrations/` Ordner ersetzt.

### `/cleanup-YYYYMMDD/` - Bereinigungs-Archive
Dateien die bei Projekt-Bereinigungen archiviert wurden:
- Deaktivierte Migrations (*.DISABLED)
- Alte READMEs
- Temporäre Restore-Skripte

## Wichtig

⚠️ **Diese Dateien sind nur zur Referenz**
- Verwende immer die aktuellen Migrations aus `/migrations/`
- Dokumentationen im Hauptverzeichnis sind aktuell
- Archive-Dateien werden nicht mehr aktiv gewartet

## Mobile Archive

`/mobile-archive/foodspot-ranking-mobile/` enthält die React Native Mobile App.

**Status:** Archiviert - Web-App ist Fokus
**Grund:** Web-First Strategie, Mobile später optional

Die Mobile-App kann bei Bedarf reaktiviert werden.
