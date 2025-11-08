# Wiederherstellungs-Plan - Sauberer Neustart

## 🎯 Ziel
Basis-Funktionalität wiederherstellen und dann Schritt für Schritt Features hinzufügen.

---

## Phase 1: Notfall-Wiederherstellung ⚡

### Schritt 1: Migration ausführen
1. **Öffne Supabase Dashboard** → SQL Editor
2. **Führe aus**: `migrations/013_EMERGENCY_RESTORE_ALL_POLICIES.sql`
3. **Warte** auf Erfolgsmeldung

### Schritt 2: Basis-Funktionen testen
- [ ] **Einloggen** funktioniert
- [ ] **Listen erstellen** funktioniert
- [ ] **Listen anzeigen** funktioniert (Dashboard)
- [ ] **Abmelden** funktioniert
- [ ] **Foodspots hinzufügen** funktioniert
- [ ] **Tier-List** funktioniert

### Schritt 3: Vollständige Verifizierung
- [ ] Dashboard lädt korrekt
- [ ] Account-Seite zeigt Stats
- [ ] Settings funktionieren
- [ ] Keine Fehler in der Konsole

---

## Phase 2: Social Features (Schrittweise) 👥

### Schritt 4: Freundes-Suche (Basis)
- [ ] Suche nach Usern funktioniert
- [ ] User-Profil anzeigen
- [ ] **NOCH KEINE** Freundschaftsanfragen (später)

### Schritt 5: Freundschaftsanfragen
- [ ] Freundschaftsanfragen erstellen
- [ ] Freundschaftsanfragen annehmen/ablehnen
- [ ] Freunde in Liste anzeigen

### Schritt 6: Freundes-Profil
- [ ] Freundes-Profil anzeigen
- [ ] Basis-Stats anzeigen
- [ ] Vergleichs-Feature (optional)

### Schritt 7: Geteilte Listen (Später)
- [ ] Shared Lists erstellen
- [ ] Collaborators hinzufügen
- [ ] Geteilte Listen im Dashboard anzeigen

---

## ⚠️ Wichtige Regeln

1. **Nur eine Sache nach der anderen**: Jedes Feature einzeln testen
2. **Migrationen sorgfältig prüfen**: Vor dem Ausführen immer überprüfen
3. **RLS Policies nie überschreiben**: Immer zusätzlich hinzufügen, nicht ersetzen
4. **Backup vor größeren Änderungen**: Wichtige Daten sichern
5. **Bei Problemen stoppen**: Nicht weiter machen, bis das Problem gelöst ist

---

## 📁 Aktuelle Migrationen

### ✅ Sicher auszuführen:
- `013_EMERGENCY_RESTORE_ALL_POLICIES.sql` - **Basis-Wiederherstellung**

### ⛔ Nicht ausführen:
- `010_fix_shared_lists_rls.sql` - **DEAKTIVIERT** (hat Probleme verursacht)
- `012_fix_shared_lists_rls_safe.sql` - Für später (nach Basis-Wiederherstellung)

---

## 🚀 Nächste Schritte

1. **JETZT**: Migration 013 ausführen
2. **DANACH**: Alle Basis-Funktionen testen
3. **DANN**: Schritt für Schritt Social Features hinzufügen
