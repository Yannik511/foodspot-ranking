# 🔧 Fix: Infinite Recursion in RLS Policies

## Problem

Die RLS Policies haben eine zirkuläre Abhängigkeit:
- Policy auf `lists` prüft `list_members` → triggert RLS auf `list_members`
- Policy auf `list_members` prüft `lists` → triggert RLS auf `lists`
- → **Infinite Recursion** (Fehler 42P17)

## Lösung

Migration 018 erstellt **SECURITY DEFINER Funktionen**, die RLS umgehen:

1. `is_list_owner(p_list_id, p_user_id)` - Prüft Owner-Status ohne RLS
2. `is_list_member(p_list_id, p_user_id)` - Prüft Mitglied-Status ohne RLS
3. `is_list_editor(p_list_id, p_user_id)` - Prüft Editor-Status ohne RLS

Diese Funktionen werden in allen Policies verwendet, um Rekursion zu vermeiden.

## Anwendung

### Schritt 1: Migration 018 ausführen

Führe diese Migration in Supabase SQL Editor aus:

**Datei:** `migrations/018_fix_rls_recursion.sql`

Diese Migration:
- ✅ Erstellt SECURITY DEFINER Funktionen
- ✅ Ersetzt alle rekursiven Policies
- ✅ Behält ursprüngliche Policies für private Listen bei

### Schritt 2: Testen

Führe Migration 019 aus, um zu testen:

**Datei:** `migrations/019_test_rls_policies.sql`

Oder teste manuell:

```sql
-- Als Owner: Sollte eigene Listen sehen können
SELECT * FROM lists WHERE user_id = auth.uid();

-- Als Owner: Sollte Mitglieder sehen können
SELECT * FROM list_members WHERE list_id IN (
  SELECT id FROM lists WHERE user_id = auth.uid()
);

-- Als Member: Sollte geteilte Listen sehen können
SELECT * FROM lists WHERE id IN (
  SELECT list_id FROM list_members WHERE user_id = auth.uid()
);
```

### Schritt 3: App testen

1. Hard Refresh im Browser (Cmd+Shift+R)
2. Erneut einloggen
3. Private Listen sollten unter "Meine Listen" erscheinen
4. Geteilte Listen sollten unter "Geteilte Listen" erscheinen

## Was wurde geändert?

### Vorher (Rekursiv):
```sql
-- Policy auf lists
CREATE POLICY "List members can view shared lists"
ON lists FOR SELECT
USING (
  EXISTS (SELECT 1 FROM list_members WHERE ...)  -- Triggers RLS on list_members
);

-- Policy auf list_members
CREATE POLICY "List members can view all members"
ON list_members FOR SELECT
USING (
  EXISTS (SELECT 1 FROM lists WHERE ...)  -- Triggers RLS on lists → RECURSION!
);
```

### Nachher (Nicht-rekursiv):
```sql
-- Policy auf lists
CREATE POLICY "List members can view shared lists"
ON lists FOR SELECT
USING (
  is_list_member(id, auth.uid())  -- SECURITY DEFINER Funktion, umgeht RLS
);

-- Policy auf list_members
CREATE POLICY "List members can view all members"
ON list_members FOR SELECT
USING (
  is_list_member(list_id, auth.uid()) OR is_list_owner(list_id, auth.uid())
  -- SECURITY DEFINER Funktionen, umgehen RLS
);
```

## Wichtige Hinweise

1. **Ursprüngliche Policies bleiben erhalten**:
   - "Users can view own lists" - funktioniert weiterhin für private Listen
   - "Users can view foodspots in own lists" - funktioniert weiterhin für private Listen

2. **Neue Policies sind zusätzlich**:
   - "List members can view shared lists" - nur für geteilte Listen
   - "List members can view all members" - nur für geteilte Listen

3. **SECURITY DEFINER Funktionen**:
   - Führen Queries mit den Rechten des Funktions-Erstellers aus
   - Umgehen RLS komplett
   - Sind sicher, da sie nur einfache Prüfungen durchführen

## Rollback

Falls Probleme auftreten:

1. Führe Migration 017 aus (entfernt geteilte Listen Features)
2. Oder setze Policies manuell zurück:
   ```sql
   -- Entferne neue Policies
   DROP POLICY IF EXISTS "List members can view shared lists" ON lists;
   DROP POLICY IF EXISTS "List members can view all members" ON list_members;
   -- etc.
   ```

## Erwartetes Verhalten nach Fix

✅ **Keine Rekursion**: Policies verwenden SECURITY DEFINER Funktionen  
✅ **Private Listen**: Funktionieren wie vorher (ursprüngliche Policies)  
✅ **Geteilte Listen**: Funktionieren mit neuen Policies  
✅ **Performance**: Keine Verschlechterung (Funktionen sind optimiert)



