# Migration 043 anwenden - Fix für Beschreibungs-Bearbeitung in geteilten Listen

## Problem
Beim nachträglichen Bearbeiten der gemeinsamen Beschreibung in geteilten Listen tritt ein Fehler auf:
```
Error: null value in column "score" of relation "foodspot_ratings" violates not-null constraint
```

## Lösung
Die `merge_foodspot` Funktion wurde angepasst, sodass Ratings nur dann eingefügt werden, wenn auch tatsächlich ein Score (Rating) vorhanden ist.

## Migration anwenden

### Option 1: Über Supabase SQL Editor (empfohlen)

1. Gehe zu deinem Supabase Dashboard: https://supabase.com/dashboard
2. Wähle dein Projekt aus
3. Navigiere zu **SQL Editor** in der linken Sidebar
4. Klicke auf **New Query**
5. Kopiere den **gesamten Inhalt** der Datei `migrations/043_fix_merge_foodspot_null_score.sql`
6. Füge ihn in den SQL Editor ein
7. Klicke auf **Run** (oder Strg+Enter / Cmd+Enter)
8. Warte auf die Bestätigung "Success"

### Option 2: Über Supabase CLI

```bash
# Im Projektverzeichnis
supabase db push

# Oder spezifisch diese Migration:
supabase migration up --db-url "deine-database-url"
```

## Nach der Migration testen

1. Öffne die Web-App im Browser
2. Gehe zu einer geteilten Liste
3. Öffne einen Foodspot
4. Bearbeite die gemeinsame Beschreibung
5. Speichere die Änderungen
6. ✅ Es sollte jetzt funktionieren ohne Fehler!

## Was wurde geändert?

Die Funktion fügt jetzt nur noch ein Rating in `foodspot_ratings` ein, wenn:
- Ein `p_score` Wert übergeben wird (nicht NULL)
- Beim bloßen Bearbeiten der Beschreibung wird **kein** Rating eingefügt

### Geänderte Zeilen in der Funktion:

**Änderung 1: Rating nur einfügen wenn Score vorhanden**

**Vorher (Zeilen 116-122):**
```sql
INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment)
VALUES (v_foodspot_id, p_list_id, v_user_id, v_normalized_score, p_criteria, p_comment)
ON CONFLICT (foodspot_id, user_id) DO UPDATE SET
  score = EXCLUDED.score,
  criteria = EXCLUDED.criteria,
  comment = EXCLUDED.comment,
  updated_at = TIMEZONE('utc'::text, NOW());
```

**Nachher:**
```sql
-- Only insert/update rating if score is provided
IF v_normalized_score IS NOT NULL THEN
  INSERT INTO foodspot_ratings (foodspot_id, list_id, user_id, score, criteria, comment)
  VALUES (v_foodspot_id, p_list_id, v_user_id, v_normalized_score, p_criteria, p_comment)
  ON CONFLICT (foodspot_id, user_id) DO UPDATE SET
    score = EXCLUDED.score,
    criteria = EXCLUDED.criteria,
    comment = EXCLUDED.comment,
    updated_at = TIMEZONE('utc'::text, NOW());
END IF;
```

**Änderung 2: Beschreibung in korrekte Spalte speichern**

Die Beschreibung wird jetzt in die `description` Spalte gespeichert (nicht `notes`), damit sie korrekt geladen wird:

```sql
description = COALESCE(p_description, description)
```

Gleiches gilt für den INSERT-Fall (neue Foodspots).

## Funktioniert für

✅ Owner der Liste  
✅ Editor der Liste  
✅ Nachträgliche Bearbeitung der Beschreibung  
✅ Hinzufügen neuer Spots mit Beschreibung  
✅ Bearbeitung ohne Rating-Änderung  

## Support

Bei Problemen prüfe:
- Supabase Logs im Dashboard unter **Logs** → **Postgres Logs**
- Browser Console für Frontend-Fehler

