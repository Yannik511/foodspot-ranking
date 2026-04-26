# 🔔 Notifications-Analyse für Rankify

## 📊 Aktuelle Architektur-Übersicht

### Vorhanden ✅
- **Vite + React** Web-App
- **PWA Manifest** (`manifest.webmanifest`)
- **Supabase Backend** mit Real-time Subscriptions
- **Tabellen:** `lists`, `foodspots`, `list_invitations`, `friendships`
- **Real-time Updates** bereits implementiert (für Listen-Sync)

### Fehlend ❌
- **Service Worker** (nicht implementiert)
- **Push Notification Infrastructure**
- **Notification-Tabelle** in Supabase
- **Cron Jobs / Scheduled Tasks** für Streak-Tracking
- **E-Mail Service** Integration

---

## 🎯 Benachrichtigungs-Typen & Machbarkeit

### 1. "Jemand hat dich zu einer geteilten Liste eingeladen"

#### ✅ **In-App Notifications** (SOFORT MACHBAR)
- **Status:** Bereits teilweise implementiert (Social Tab zeigt unread notifications)
- **Technik:** Real-time Subscription auf `list_invitations` Tabelle
- **Aufwand:** ⭐⭐ (2/5) - Niedrig
- **Voraussetzungen:**
  - Notification-Badge im UI (bereits vorhanden)
  - Toast/Modal für neue Invitations
  - Optional: Notification-Center-Komponente

#### ✅ **Browser Push Notifications** (MIT SERVICE WORKER)
- **Status:** Machbar, benötigt Setup
- **Technik:** Web Push API + Service Worker
- **Aufwand:** ⭐⭐⭐⭐ (4/5) - Mittel-Hoch
- **Voraussetzungen:**
  - Service Worker registrieren
  - Push Subscription in Supabase speichern
  - VAPID Keys generieren (Supabase oder selbst)
  - Edge Function zum Senden von Push-Notifications

#### ✅ **E-Mail Notifications** (MIT EDGE FUNCTION)
- **Status:** Machbar über Supabase
- **Technik:** Supabase Edge Functions + E-Mail Service (Resend/SendGrid)
- **Aufwand:** ⭐⭐⭐ (3/5) - Mittel
- **Voraussetzungen:**
  - Supabase Edge Function erstellen
  - E-Mail Service API Key (Resend empfohlen, kostenlos bis 3k/Monat)
  - Database Trigger auf `list_invitations` INSERT

---

### 2. "Heute geht deine Streak verloren, wenn du keinen Foodspot bewertest"

#### ⚠️ **Streak-Tracking** (NEUE FUNKTIONALITÄT)
- **Status:** Benötigt neue Infrastruktur
- **Technik:** 
  - Neue Tabelle `user_streaks` oder Feld in User-Metadata
  - Cron Job / Scheduled Edge Function (täglich um 23:59)
  - Prüft: Letzte Bewertung < 24h → Streak verloren
- **Aufwand:** ⭐⭐⭐⭐ (4/5) - Mittel-Hoch
- **Voraussetzungen:**
  - `user_streaks` Tabelle oder User-Metadata erweitern
  - Supabase Cron Job (pg_cron Extension) ODER
  - Supabase Edge Function mit Scheduled Execution
  - Notification-Logik (Push/E-Mail/In-App)

#### ✅ **In-App Reminder** (EINFACHER)
- **Status:** Machbar ohne Backend-Änderungen
- **Technik:** Client-seitige Prüfung beim App-Start
- **Aufwand:** ⭐⭐ (2/5) - Niedrig
- **Voraussetzungen:**
  - LocalStorage für Streak-State
  - Prüfung: "Letzte Bewertung > 20h her?" → Toast anzeigen

---

### 3. "In einer deiner Listen gab es neue Bewertungen"

#### ✅ **In-App Notifications** (SOFORT MACHBAR)
- **Status:** Bereits möglich mit Real-time
- **Technik:** Real-time Subscription auf `foodspot_ratings` Tabelle
- **Aufwand:** ⭐⭐ (2/5) - Niedrig
- **Voraussetzungen:**
  - Subscription auf `foodspot_ratings` für User's Listen
  - Notification-Badge im Dashboard
  - Toast bei neuer Bewertung

#### ✅ **Browser Push Notifications** (MIT SERVICE WORKER)
- **Status:** Machbar, benötigt Setup
- **Technik:** Wie bei List Invitations
- **Aufwand:** ⭐⭐⭐⭐ (4/5) - Mittel-Hoch
- **Voraussetzungen:**
  - Gleiche wie bei List Invitations

#### ✅ **E-Mail Digest** (OPTIONAL)
- **Status:** Machbar, aber komplexer
- **Technik:** Täglicher/Stündlicher Digest per Edge Function
- **Aufwand:** ⭐⭐⭐⭐ (4/5) - Mittel-Hoch
- **Voraussetzungen:**
  - Cron Job für tägliche Zusammenfassung
  - E-Mail Template für Digest

---

## 🛠️ Technische Roadmap

### Phase 1: In-App Notifications (Schnell & Einfach) ⭐⭐

**Ziel:** Visuelle Benachrichtigungen innerhalb der App

#### Schritte:
1. **Notification Context erstellen**
   - `src/contexts/NotificationContext.jsx`
   - State für unread notifications
   - Funktionen zum Markieren als gelesen

2. **Notification Center Komponente**
   - `src/components/NotificationCenter.jsx`
   - Dropdown/Modal mit Notification-Liste
   - Badge mit Anzahl unread

3. **Real-time Subscriptions erweitern**
   - Bereits vorhanden für `list_invitations`
   - Erweitern für `foodspot_ratings`
   - In `Dashboard.jsx` und `Social.jsx` integrieren

4. **Notification Toast Component**
   - `src/components/NotificationToast.jsx`
   - Zeigt neue Notifications als Toast an
   - Auto-dismiss nach 5 Sekunden

**Dateien:**
- `src/contexts/NotificationContext.jsx` (neu)
- `src/components/NotificationCenter.jsx` (neu)
- `src/components/NotificationToast.jsx` (neu)
- `src/App.jsx` (erweitern)

**Aufwand:** 4-6 Stunden

---

### Phase 2: Browser Push Notifications ⭐⭐⭐⭐

**Ziel:** Push-Benachrichtigungen auch wenn App geschlossen

#### Schritte:
1. **Service Worker Setup**
   - `public/sw.js` erstellen
   - Push-Event Handler
   - Notification Display Logic
   - Vite Plugin für Service Worker (z.B. `vite-plugin-pwa`)

2. **Push Subscription Management**
   - `src/services/pushNotifications.js`
   - Funktionen: `requestPermission()`, `subscribe()`, `unsubscribe()`
   - Subscription in Supabase speichern

3. **Supabase Tabelle für Push Subscriptions**
   ```sql
   CREATE TABLE push_subscriptions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     endpoint TEXT NOT NULL,
     p256dh TEXT NOT NULL,
     auth TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(user_id, endpoint)
   );
   ```

4. **Supabase Edge Function für Push**
   - `supabase/functions/send-push-notification/index.ts`
   - Web Push Library (z.B. `web-push`)
   - VAPID Keys in Supabase Secrets speichern

5. **Database Triggers**
   - Trigger auf `list_invitations` INSERT → Edge Function aufrufen
   - Trigger auf `foodspot_ratings` INSERT → Edge Function aufrufen

**Dateien:**
- `public/sw.js` (neu)
- `src/services/pushNotifications.js` (neu)
- `migrations/XXX_create_push_subscriptions.sql` (neu)
- `supabase/functions/send-push-notification/index.ts` (neu)
- `vite.config.js` (erweitern mit PWA Plugin)

**Dependencies:**
- `vite-plugin-pwa` (Dev)
- `web-push` (Edge Function)

**Aufwand:** 8-12 Stunden

---

### Phase 3: E-Mail Notifications ⭐⭐⭐

**Ziel:** E-Mail-Benachrichtigungen für wichtige Events

#### Schritte:
1. **E-Mail Service Setup**
   - Account bei Resend erstellen (kostenlos bis 3k/Monat)
   - API Key in Supabase Secrets speichern

2. **Supabase Edge Function für E-Mails**
   - `supabase/functions/send-email/index.ts`
   - Resend SDK Integration
   - E-Mail Templates (HTML)

3. **Database Triggers**
   - Trigger auf `list_invitations` INSERT → Edge Function
   - Optional: User-Einstellung für E-Mail-Präferenzen

4. **User Preferences Tabelle** (Optional)
   ```sql
   CREATE TABLE user_notification_preferences (
     user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     email_list_invitations BOOLEAN DEFAULT true,
     email_new_ratings BOOLEAN DEFAULT false,
     email_streak_reminders BOOLEAN DEFAULT true,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

**Dateien:**
- `supabase/functions/send-email/index.ts` (neu)
- `migrations/XXX_create_notification_preferences.sql` (neu, optional)
- E-Mail Templates (HTML)

**Dependencies:**
- `@resend/node` (Edge Function)

**Aufwand:** 6-8 Stunden

---

### Phase 4: Streak-Tracking & Reminders ⭐⭐⭐⭐

**Ziel:** Tägliche Streak-Erinnerungen

#### Schritte:
1. **Streak-Tracking Tabelle**
   ```sql
   CREATE TABLE user_streaks (
     user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     current_streak INTEGER DEFAULT 0,
     longest_streak INTEGER DEFAULT 0,
     last_activity_date DATE,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. **Streak-Update Logic**
   - Funktion: Prüft letzte Bewertung
   - Update bei neuer Bewertung
   - Reset bei >24h Pause

3. **Scheduled Cron Job**
   - Option A: Supabase pg_cron Extension
     ```sql
     SELECT cron.schedule(
       'check-streaks',
       '0 23 * * *', -- Täglich um 23:00
       $$SELECT check_and_reset_streaks()$$
     );
     ```
   - Option B: Supabase Edge Function mit Scheduled Execution
     - Supabase Dashboard → Edge Functions → Schedule

4. **Reminder Notification**
   - Cron Job prüft: Streak > 0 && letzte Aktivität > 20h
   - Sendet Push/E-Mail/In-App Reminder

**Dateien:**
- `migrations/XXX_create_user_streaks.sql` (neu)
- `migrations/XXX_create_streak_functions.sql` (neu)
- `supabase/functions/check-streaks/index.ts` (neu, wenn Edge Function)

**Aufwand:** 8-10 Stunden

---

## 📋 Zusammenfassung: Machbarkeit

### ✅ **SOFORT MACHBAR (ohne große Änderungen):**
- ✅ In-App Notifications für List Invitations
- ✅ In-App Notifications für neue Bewertungen
- ✅ Client-seitige Streak-Reminder (ohne Backend)

### ⚠️ **MACHBAR MIT SETUP (mittlerer Aufwand):**
- ⚠️ Browser Push Notifications (Service Worker + Edge Function)
- ⚠️ E-Mail Notifications (Edge Function + E-Mail Service)
- ⚠️ Streak-Tracking mit Backend (Cron Job)

### ❌ **NICHT MACHBAR (ohne größere Änderungen):**
- ❌ Native iOS/Android Push (benötigt native Apps)
- ❌ SMS Notifications (benötigt Twilio/ähnlich, teuer)

---

## 🎯 Empfohlene Implementierungs-Reihenfolge

1. **Phase 1: In-App Notifications** (4-6h)
   - Schneller ROI
   - Keine externen Dependencies
   - Funktioniert sofort

2. **Phase 2: Browser Push** (8-12h)
   - Größter Impact für User Engagement
   - Funktioniert auch wenn App geschlossen
   - Benötigt Service Worker Setup

3. **Phase 3: E-Mail** (6-8h)
   - Backup für User ohne Push
   - Professioneller Eindruck
   - Relativ einfach mit Resend

4. **Phase 4: Streak-Tracking** (8-10h)
   - Gamification-Element
   - Erhöht User Retention
   - Benötigt Cron Jobs

**Gesamtaufwand:** ~26-36 Stunden für alle Phasen

---

## 🔧 Technische Voraussetzungen

### Für Push Notifications:
- ✅ Service Worker Support (alle modernen Browser)
- ✅ HTTPS (erforderlich für Push)
- ✅ VAPID Keys (kostenlos generierbar)
- ✅ Supabase Edge Functions (kostenlos in Free Tier)

### Für E-Mail:
- ✅ E-Mail Service Account (Resend: kostenlos bis 3k/Monat)
- ✅ Supabase Edge Functions
- ✅ HTML E-Mail Templates

### Für Streak-Tracking:
- ✅ pg_cron Extension (Supabase Pro) ODER
- ✅ Scheduled Edge Functions (Supabase)
- ✅ Neue Datenbank-Tabellen

---

## 💡 Alternative: Vereinfachte Lösung

**Nur In-App + Client-seitige Streaks:**
- In-App Notifications (Phase 1)
- Client-seitiges Streak-Tracking (LocalStorage)
- Reminder beim App-Start

**Aufwand:** ~4-6 Stunden
**Vorteil:** Funktioniert sofort, keine Backend-Änderungen

---

## 📝 Nächste Schritte

Wenn du mit der Implementierung starten möchtest:

1. **Entscheide:** Welche Phasen willst du implementieren?
2. **Starte mit Phase 1** (In-App) für schnellen Erfolg
3. **Dann Phase 2** (Push) für maximalen Impact
4. **Optional:** Phase 3 & 4 für vollständiges Feature-Set

Soll ich mit einer bestimmten Phase starten?





