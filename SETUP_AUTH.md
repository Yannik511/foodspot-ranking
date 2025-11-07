# 🔐 Authentication Setup Guide

## Schritt 1: Supabase Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com)
2. Erstelle einen kostenlosen Account (falls noch nicht vorhanden)
3. Klicke auf "New Project"
4. Wähle einen Projektnamen (z.B. "foodspot-ranking")
5. Wähle ein starkes Passwort für die Datenbank
6. Wähle eine Region (z.B. Frankfurt für Deutschland)
7. Warte ca. 2 Minuten bis das Projekt erstellt ist

## Schritt 2: Supabase API Keys holen

1. In deinem Supabase Dashboard:
   - Gehe zu **Settings** → **API**
2. Du findest dort:
   - **Project URL** (z.B. `https://xxxxx.supabase.co`)
   - **anon/public key** (ein langer JWT Token)

## Schritt 3: .env Datei erstellen

1. Erstelle eine `.env` Datei im Root-Verzeichnis des Projekts:

```bash
# Im Projekt-Root-Verzeichnis
touch .env
```

2. Füge folgende Zeilen ein (ersetze mit deinen eigenen Werten):

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**WICHTIG:** 
- Die Variablen MÜSSEN mit `VITE_` beginnen (Vite Requirement)
- Kopiere die Werte direkt aus dem Supabase Dashboard
- Speichere die Datei

## Schritt 4: Email Confirmation deaktivieren (für schnelles Testen)

Standardmäßig sendet Supabase eine Bestätigungs-Email. Für schnelles Testen kannst du das deaktivieren:

1. Gehe zu **Authentication** → **Providers** → **Email**
2. Deaktiviere "Confirm email"
3. Klicke "Save"

**WICHTIG für Produktion:** Email Confirmation sollte aktiviert bleiben!

## Schritt 5: Dev Server starten

```bash
npm run dev
```

**WICHTIG:** Nach dem Erstellen der `.env` Datei, starte den Dev Server NEU (falls er bereits läuft).

## Schritt 6: Testen

1. Öffne http://localhost:5173
2. Du wirst automatisch zur Landing Page weitergeleitet
3. Klicke auf "Sign Up"
4. Erstelle einen Account:
   - Username: dein-username
   - E-Mail: test@example.com
   - Passwort: mindestens 6 Zeichen
5. Nach erfolgreicher Registrierung wirst du **automatisch eingeloggt** und zum Dashboard weitergeleitet
6. Falls du dich später anmelden möchtest, nutze die Login-Funktion

## ✅ Erfolg-Checkliste

- [ ] Supabase Projekt erstellt
- [ ] `.env` Datei mit korrekten Werten erstellt
- [ ] Dev Server läuft (nach .env Erstellung)
- [ ] Registrierung funktioniert
- [ ] Login funktioniert
- [ ] Dashboard wird nach Login angezeigt
- [ ] User-Informationen werden angezeigt
- [ ] Logout funktioniert

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Prüfe, ob `.env` im Root-Verzeichnis existiert
- Prüfe, ob die Variablen mit `VITE_` beginnen
- Starte den Dev Server NEU nach `.env` Änderungen

### "Invalid API key"
- Kopiere den **anon/public** Key (nicht der service_role key!)
- Stelle sicher, dass kein Leerzeichen vor/nach dem Key ist

### "Email not confirmed"
- Deaktiviere Email Confirmation in Supabase (für Testen)
- Oder checke dein Email-Postfach für Bestätigungs-Link

### CORS Errors
- Supabase sollte automatisch localhost erlauben
- Prüfe Supabase Dashboard → Settings → API → CORS

## 📚 Weitere Ressourcen

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)

