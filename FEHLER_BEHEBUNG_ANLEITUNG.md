# 🔴 PGRST204 Fehler - Behebung

## Problem
Beim Speichern eines Foodspots erscheint der Fehler:
```
PGRST204 - Failed to load resource: the server responded with a status of 400
```

## Ursache
Die `ratings` Spalte fehlt in der `foodspots` Tabelle in Supabase.

## ✅ Lösung - Schritt für Schritt

### 1. Supabase Dashboard öffnen
1. Gehe zu: https://app.supabase.com
2. Logge dich ein
3. Öffne dein Projekt "foodspot-ranking"

### 2. SQL Editor öffnen
1. Klicke links auf **SQL Editor** (das `<>` Symbol)
2. Klicke auf **"+ New Query"**

### 3. SQL-Code kopieren und ausführen
1. Öffne die Datei: `FIX_RATINGS_SPALTE.sql`
2. **Kopiere ALLEN Code** (STRG+A, STRG+C)
3. **Füge ihn in den SQL Editor ein** (STRG+V)
4. **Klicke auf "Run"** (oder drücke CMD/Ctrl + Enter)

### 4. Erfolg prüfen
Du solltest sehen: **"Success. No rows returned"** ✅

### 5. App testen
- Gehe zurück zu deiner App
- Versuche erneut einen Foodspot zu speichern
- Der Fehler sollte jetzt behoben sein! ✅

---

## 📝 Was macht das SQL-Script?

```sql
ALTER TABLE foodspots 
ADD COLUMN IF NOT EXISTS ratings JSONB DEFAULT '{}'::jsonb;
```

Dies fügt die `ratings` Spalte hinzu, die die einzelnen Bewertungen (z.B. Brot: 5, Fleisch: 4) als JSON speichert.

---

## 🐛 Falls es immer noch nicht funktioniert

1. **Prüfe die Console** (F12) für detaillierte Fehlermeldungen
2. **Prüfe ob die Spalte existiert:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'foodspots' 
   AND column_name = 'ratings';
   ```
3. **Falls die Spalte existiert**, prüfe ob der Datentyp `jsonb` ist








