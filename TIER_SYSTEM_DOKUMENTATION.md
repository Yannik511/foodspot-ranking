# 📊 Tier System Dokumentation

## 💾 Question 2: Datenbank-Persistenz

### ✅ JA - Tiers werden pro User gespeichert!

**Wie es funktioniert:**

1. **Struktur:**
   - Jedes Foodspot hat 3 wichtige Felder:
     - `user_id` → Verknüpfung zum User
     - `list_id` → Verknüpfung zur Liste (z.B. "Beste Burger Münchens")
     - `tier` → Das Tier (S, A, B, C, D)

2. **Beispiel:**
   ```
   User: "Max Mustermann"
   Liste: "Beste Burger Münchens" (list_id: abc-123)
   
   Foodspot 1:
   - name: "BLN Burger"
   - tier: "S"
   - user_id: "max-user-id"
   - list_id: "abc-123"
   
   Foodspot 2:
   - name: "McDonald's"
   - tier: "C"
   - user_id: "max-user-id"
   - list_id: "abc-123"
   ```

3. **Persistenz:**
   - ✅ **Pro User:** Jeder User hat seine eigenen Foodspots
   - ✅ **Pro Liste:** Tiers sind pro Liste gespeichert (eine Liste kann S-Tier Burger haben, eine andere S-Tier Pizza)
   - ✅ **Automatisch:** Beim Speichern wird das Tier automatisch basierend auf dem Rating berechnet und gespeichert
   - ✅ **Dauerhaft:** Alle Daten bleiben in Supabase gespeichert, auch nach App-Neustart

4. **Abfrage:**
   ```sql
   -- Beispiel: Alle S-Tier Foodspots eines Users
   SELECT * FROM foodspots 
   WHERE user_id = 'user-id' 
   AND tier = 'S'
   ```

---

## 💡 Question 1: 5 Tiers optimal?

### Meinung: 5 Tiers (S, A, B, C, D) sind gut, aber optional anpassbar

**Vorteile von 5 Tiers:**
- ✅ Klare Hierarchie (S = Best, D = Am wenigsten gut)
- ✅ Genug Differenzierung für verschiedene Qualitätsstufen
- ✅ Standard in Gaming/Anime (S-Tier System)
- ✅ Intuitiv für User

**Alternative: 3 Tiers (S, A, B)**
- Pro: Einfacher, weniger Entscheidungen
- Contra: Weniger Differenzierung

**Empfehlung:** 
5 Tiers beibehalten, da sie:
- Genug Granularität bieten
- International bekannt sind
- Gut mit dem Rating-System (0-10) funktionieren

**Falls du ändern möchtest:**
- Kann einfach in `TIERS` Array angepasst werden
- Datenbank unterstützt aktuell S, A, B, C, D, E (E ist reserviert, aber nicht verwendet)






















