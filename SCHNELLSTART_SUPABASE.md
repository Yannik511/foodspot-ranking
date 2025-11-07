# 🚀 Schnellstart: Supabase Setup

## 📋 Schritt-für-Schritt Anleitung

### 1️⃣ Supabase Dashboard öffnen

```
1. Gehe zu: https://app.supabase.com
2. Logge dich ein (oder erstelle Account)
3. Öffne dein Projekt "foodspot-ranking"
```

### 2️⃣ SQL Editor öffnen

```
1. Klicke links auf "SQL Editor" (das <> Symbol)
2. Klicke oben auf "+ New Query"
3. Ein neuer Tab öffnet sich
```

### 3️⃣ SQL-Code kopieren

**Öffne die Datei: `COMPLETE_RESET.sql`**

**Kopiere ALLEN Code** (STRG+A, STRG+C)

Das Script erstellt die Tabellen `lists` und `foodspots` komplett neu

### 4️⃣ SQL-Code einfügen

```
1. Klicke in den leeren SQL-Editor
2. STRG+A (Alles markieren)
3. STRG+V (Code einfügen)
```

### 5️⃣ Code ausführen

```
1. Klicke oben rechts auf "Run" (oder drücke CMD/Ctrl + Enter)
2. Warte 5-10 Sekunden
3. Du siehst: "Success. No rows returned" ✅
```

### 6️⃣ Tabellen überprüfen

```
1. Klicke links auf "Table Editor"
2. Du solltest jetzt sehen:
   - ✅ lists
   - ✅ foodspots
```

### 7️⃣ Storage Bucket erstellen

```
1. Klicke links auf "Storage"
2. Klicke auf "New Bucket"
3. Name: list-covers (WICHTIG: Mit Minuszeichen!)
4. ✅ Public bucket: AN
5. Klicke "Create Bucket"
```

### 8️⃣ Storage Policies hinzufügen

**Zurück im SQL Editor:**

```
1. Erstelle neue Query (wenn nicht schon offen)
2. Öffne die Datei: supabase_storage_policies.sql
3. Kopiere ALLEN Code und füge ein
4. Führe aus (Run)
```

### 9️⃣ Testen!

```
1. Öffne deine App: http://localhost:5173
2. (Login funktioniert bereits ✅)
3. Klicke "Erstelle deine erste Liste"
4. Fülle Formular aus:
   - Listenname: z.B. "Beste Burger Münchens"
   - Stadt: z.B. "München"
   - Beschreibung: Optional
   - Cover Bild: Optional (kann jetzt auch hochgeladen werden!)
5. Klicke "🍽️ Liste erstellen"
```

### ✅ Erfolg-Check

In Supabase → Table Editor → `lists`:
- Du solltest deine neue Liste sehen! 🎉

---

## 🐛 Falls etwas nicht funktioniert

### Error: "relation 'lists' already exists"
**Lösung:** Tabelle existiert schon, das ist OK! Weiter zu Storage.

### Error: "permission denied"
**Lösung:** RLS Policies fehlen. Führe ALLEN SQL-Code erneut aus.

### Error: "bucket already exists"
**Lösung:** Bucket existiert schon, das ist OK! Nur Policies hinzufügen.

### Liste wird nicht gespeichert
**Lösung:** 
- Prüfe Browser Console (F12) für Fehler
- Prüfe ob user eingeloggt ist
- Prüfe ob Tabellen existieren

### Bilder werden nicht hochgeladen
**Lösung:**
- Prüfe ob Bucket "list-covers" existiert
- Prüfe ob Bucket "Public" ist
- Prüfe Storage Policies

---

## 📞 Hilfe

**Komplette SQL-Anleitung:** Siehe `SETUP_DATABASE.md`

**Supabase Docs:** https://supabase.com/docs

