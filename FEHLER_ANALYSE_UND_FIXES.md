# 🔍 Fehler-Analyse und Fixes

## 📋 Übersicht der Fehler

Basierend auf den Terminal-Logs wurden folgende Fehler identifiziert:

### 1. ❌ Storage Upload Fehler (RLS)
```
ERROR Upload error: [StorageApiError: new row violates row-level security policy]
ERROR Upload error details: {
  "name": "StorageApiError",
  "message": "new row violates row-level security policy",
  "status": 400,
  "statusCode": "403"
}
```

**Problem:**
- Die Storage Policy für `list-covers` Bucket erlaubt den Upload nicht
- Die Policy prüft, ob der Dateiname im Format `{user_id}/{filename}` ist
- Möglicherweise ist die Policy nicht korrekt konfiguriert oder der Dateiname entspricht nicht dem erwarteten Format

**Lösung:**
- ✅ SQL-Fix erstellt: `FIX_RLS_POLICIES.sql`
- ✅ Storage Policies korrigiert (beide Formate unterstützt: `foldername` und `split_part`)
- ✅ Policy prüft jetzt beide möglichen Dateinamen-Formate

### 2. ❌ Lists Insert Fehler (RLS)
```
ERROR Insert error details: {
  "code": "42501",
  "details": null,
  "hint": null,
  "message": "new row violates row-level security policy for table \"lists\""
}
```

**Problem:**
- Die RLS Policy für `lists` Tabelle erlaubt den INSERT nicht
- Die Policy prüft `auth.uid() = user_id`, aber möglicherweise ist `auth.uid()` `NULL` oder die Session ist nicht korrekt

**Lösung:**
- ✅ SQL-Fix erstellt: `FIX_RLS_POLICIES.sql`
- ✅ Lists RLS Policies korrigiert
- ✅ `WITH CHECK` Policy prüft jetzt explizit `auth.uid() IS NOT NULL`
- ✅ Policy erstellt für `authenticated` Role (nicht `public`)

### 3. ❌ Auth Refresh Token Fehler
```
ERROR Custom fetch error: [TypeError: Network request failed]
ERROR URL: https://cvkyvhkwsylmzlrdlbxz.supabase.co/auth/v1/token?grant_type=refresh_token
ERROR [TypeError: Network request failed]
ERROR [AuthApiError: Invalid Refresh Token: Refresh Token Not Found]
```

**Problem:**
- Der Refresh Token wird nicht gefunden
- Möglicherweise ist die Session abgelaufen oder nicht richtig in AsyncStorage gespeichert
- Network request failed könnte auch ein Simulator-Problem sein

**Lösung:**
- ✅ Supabase Client Konfiguration verbessert
- ✅ `storageKey` explizit gesetzt: `'supabase.auth.token'`
- ✅ `flowType: 'pkce'` für bessere Session-Handling
- ✅ Custom fetch verbessert (Header werden explizit gesetzt)

## 🔧 Durchgeführte Fixes

### 1. SQL-Fix: `FIX_RLS_POLICIES.sql`

**Storage Policies:**
```sql
-- Unterstützt beide Dateinamen-Formate:
-- 1. {user_id}/{filename}
-- 2. Dateiname beginnt mit {user_id}/
CREATE POLICY "Users can upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'list-covers' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    split_part(name, '/', 1) = auth.uid()::text
  )
);
```

**Lists RLS Policies:**
```sql
-- Explizite Prüfung auf authenticated User
CREATE POLICY "Users can create own lists"
ON lists
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() IS NOT NULL
);
```

### 2. Supabase Client Fix: `supabase.js`

**Verbesserungen:**
- ✅ `storageKey` explizit gesetzt
- ✅ `flowType: 'pkce'` für besseres Session-Handling
- ✅ Custom fetch mit expliziten Headers

## 📝 Nächste Schritte

### 1. SQL-Fix ausführen
1. Öffne Supabase Dashboard → SQL Editor
2. Kopiere den Inhalt von `FIX_RLS_POLICIES.sql`
3. Führe die SQL-Queries aus
4. Prüfe die Verification Queries am Ende der Datei

### 2. Mobile App neu starten
```bash
cd foodspot-ranking-mobile
npm start
```

### 3. User neu einloggen
- Logge dich aus
- Logge dich wieder ein (um Session zu aktualisieren)

### 4. Liste erstellen testen
- Erstelle eine neue Liste
- Prüfe, ob Upload und Insert funktionieren

## 🐛 Troubleshooting

### Wenn Storage Upload immer noch fehlschlägt:
1. Prüfe, ob der Bucket `list-covers` existiert
2. Prüfe, ob der Bucket `public` ist
3. Prüfe die Storage Policies in Supabase Dashboard
4. Prüfe, ob der Dateiname im Format `{user_id}/{filename}` ist

### Wenn Lists Insert immer noch fehlschlägt:
1. Prüfe, ob der User eingeloggt ist (`auth.uid()` sollte nicht NULL sein)
2. Prüfe die RLS Policies in Supabase Dashboard
3. Prüfe, ob `user_id` im Insert-Data korrekt gesetzt ist

### Wenn Auth Refresh Token immer noch fehlschlägt:
1. Lösche AsyncStorage: `AsyncStorage.clear()` (nur für Testing!)
2. Logge dich neu ein
3. Prüfe, ob Network-Requests funktionieren (Simulator vs. echtes Gerät)

## ✅ Erfolg-Checkliste

- [ ] SQL-Fix ausgeführt (keine Errors)
- [ ] Storage Policies korrigiert
- [ ] Lists RLS Policies korrigiert
- [ ] Mobile App neu gestartet
- [ ] User neu eingeloggt
- [ ] Liste erstellt (ohne Fehler)
- [ ] Bild-Upload funktioniert
- [ ] Liste erscheint im Dashboard

## 📚 Weitere Ressourcen

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)
- [React Native Supabase Auth](https://supabase.com/docs/guides/auth/auth-helpers/react-native)




