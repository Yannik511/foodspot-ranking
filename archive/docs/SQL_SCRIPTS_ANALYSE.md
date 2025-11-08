# 📋 SQL-Scripts Analyse & Empfehlung

## ✅ BEHALTEN & BEARBEITEN:

### 1. **COMPLETE_RESET.sql** ⭐ HAUPT-SCRIPT
**Status:** ✅ Aktuell, aber fehlt `ratings` Spalte
**Aktion:** **BEARBEITEN** - `ratings` Spalte hinzufügen

Das ist dein Haupt-Script, das du verwendest. Es muss nur um die `ratings` Spalte erweitert werden.

---

## ✅ BEHALTEN (Wird benötigt):

### 2. **supabase_storage_policies.sql**
**Status:** ✅ Aktuell und benötigt
**Aktion:** **BEHALTEN**

Wird für das Storage-Bucket (`list-covers`) benötigt, um Bilder hochzuladen.

---

## ❌ LÖSCHEN (Duplikate/Unnötig):

### 3. **add_ratings_column.sql**
**Status:** ❌ Duplikat von FIX_RATINGS_SPALTE.sql
**Aktion:** **LÖSCHEN**

### 4. **FIX_RATINGS_SPALTE.sql**
**Status:** ❌ Wird in COMPLETE_RESET.sql integriert
**Aktion:** **LÖSCHEN** (nachdem COMPLETE_RESET.sql aktualisiert wurde)

### 5. **add_gluehwein_category.sql**
**Status:** ❌ Nicht nötig - Kategorien sind im Code, nicht in DB
**Aktion:** **LÖSCHEN**

### 6. **supabase_setup.sql**
**Status:** ❌ Veraltet - COMPLETE_RESET.sql ist neuer
**Aktion:** **LÖSCHEN**

---

## 📝 Zusammenfassung:

**BEHALTEN:**
- ✅ COMPLETE_RESET.sql (BEARBEITEN - ratings hinzufügen)
- ✅ supabase_storage_policies.sql

**LÖSCHEN:**
- ❌ add_ratings_column.sql
- ❌ FIX_RATINGS_SPALTE.sql
- ❌ add_gluehwein_category.sql
- ❌ supabase_setup.sql










