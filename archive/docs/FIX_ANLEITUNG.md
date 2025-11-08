# 🔧 Anleitung: Grundfunktionen wiederherstellen

## Problem
- Welcome Screen wird immer angezeigt (auch wenn Listen vorhanden sind)
- Listen können nicht erstellt werden
- Grundfunktionen funktionieren nicht

## Ursache
Die vielen SQL-Migrationen haben die RLS Policies durcheinander gebracht. Es gibt konfliktierende Policies, die die grundlegenden Funktionen blockieren.

## Lösung

### Schritt 1: SQL Query ausführen (WICHTIG!)

1. Öffne Supabase Dashboard
2. Gehe zu **SQL Editor**
3. Öffne die Datei: **`RESTORE_BASIC_FUNCTIONS.sql`**
4. Kopiere den **gesamten Inhalt**
5. Füge ihn in den SQL Editor ein
6. Führe die Query aus (Run oder Cmd/Ctrl + Enter)

**Diese Query:**
- ✅ Löscht alle geteilten Listen Daten
- ✅ Entfernt ALLE problematischen RLS Policies
- ✅ Stellt die ursprünglichen, einfachen RLS Policies wieder her
- ✅ Stellt sicher, dass Listen erstellt und angezeigt werden können

### Schritt 2: Überprüfung

Nach dem Ausführen der Query solltest du in der Konsole sehen:
- Alle Policies für `lists` und `foodspots` sind wiederhergestellt
- Keine geteilten Listen Daten mehr vorhanden

### Schritt 3: App testen

1. **Melde dich in der App an**
2. **Prüfe die Browser-Konsole** (F12 → Console)
   - Sollte keine RLS-Fehler mehr zeigen
   - Sollte "Lists loaded successfully: X lists" zeigen (wenn Listen vorhanden)
3. **Teste Listen erstellen:**
   - Gehe zu "Erstelle deine erste Liste"
   - Fülle das Formular aus
   - Klicke "Liste erstellen"
   - Die Liste sollte erstellt werden und im Dashboard erscheinen

### Schritt 4: Wenn es immer noch nicht funktioniert

1. **Prüfe die Browser-Konsole** für Fehlermeldungen
2. **Prüfe Supabase Logs:**
   - Gehe zu Supabase Dashboard → Logs
   - Prüfe, ob es Fehler bei den Datenbankabfragen gibt
3. **Teste die RLS Policies direkt:**
   - Führe diese Query im SQL Editor aus:
   ```sql
   -- Test: Kann der User seine eigenen Listen sehen?
   SELECT * FROM lists WHERE user_id = auth.uid();
   ```
   - Wenn diese Query leer ist, aber Listen existieren, ist RLS das Problem

## Was wurde geändert?

### Code-Änderungen:
1. ✅ CreateSharedList: Nur noch Freunde anzeigen, keine Listen erstellen
2. ✅ Dashboard: Alle geteilten Listen Features entfernt
3. ✅ FriendProfile: Geteilte Listen Sektion entfernt
4. ✅ Social.jsx: Geteilte Listen Notifications entfernt
5. ✅ DiscoverTab: Öffentliche Listen entfernt
6. ✅ Fehlerbehandlung verbessert (zeigt Fehler in Console)

### SQL-Änderungen:
1. ✅ RESTORE_BASIC_FUNCTIONS.sql erstellt
   - Bereinigt alle Policies
   - Stellt ursprüngliche Policies wieder her
   - Entfernt alle geteilten Listen Logik

## Nach dem Fix

Nach dem Ausführen der SQL-Query sollten folgende Funktionen wieder arbeiten:
- ✅ Listen erstellen
- ✅ Listen anzeigen (nur eigene)
- ✅ Listen bearbeiten
- ✅ Listen löschen
- ✅ Foodspots hinzufügen
- ✅ Foodspots bearbeiten
- ✅ Foodspots löschen
- ✅ Welcome Screen nur bei 0 Listen
- ✅ Freunde hinzufügen (friendships Tabelle unverändert)
- ✅ Freunde anzeigen (FriendsTab)
- ✅ Freundesprofil anzeigen (FriendProfile)
- ✅ Vergleichen (Compare)
- ❌ Geteilte Listen (deaktiviert - Button zeigt nur Freunde an)

## Wichtige Dateien

- **RESTORE_BASIC_FUNCTIONS.sql** - Haupt-SQL-Query (WICHTIGST!)
- **DELETE_SHARED_LISTS.sql** - Löscht nur Daten (optional)
- **src/pages/Dashboard.jsx** - Dashboard mit verbesserter Fehlerbehandlung

