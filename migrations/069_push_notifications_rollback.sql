-- Rollback zu Migration 069 + 070: entfernt Push-Benachrichtigungen komplett aus
-- der Datenbank. Danach verhaelt sich alles wie vor 069.
--
-- ACHTUNG: loescht die gespeicherten Geraete-Tokens und die
-- Benachrichtigungs-Einstellungen aller Nutzer.
--
-- Nur die Trigger abschalten (Daten behalten) geht auch einzeln: die ersten
-- drei DROP-TRIGGER-Zeilen plus der DO-Block reichen, dann wird nichts mehr
-- verschickt.

-- 070: taeglichen Erinnerungs-Job stoppen (pg_cron bleibt installiert).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'push-inactivity-reminder';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.send_inactivity_reminders(integer);

DROP TRIGGER IF EXISTS trg_push_friendship ON public.friendships;
DROP TRIGGER IF EXISTS trg_push_list_invitation ON public.list_invitations;
DROP TRIGGER IF EXISTS trg_push_rating ON public.foodspot_ratings;

DROP FUNCTION IF EXISTS public.trg_push_friendship();
DROP FUNCTION IF EXISTS public.trg_push_list_invitation();
DROP FUNCTION IF EXISTS public.trg_push_rating();
DROP FUNCTION IF EXISTS public.send_push(uuid[], uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.push_display_name(uuid);
DROP FUNCTION IF EXISTS public.register_push_token(text, text);
DROP FUNCTION IF EXISTS public.unregister_push_token(text);

DROP TABLE IF EXISTS public.push_tokens;
DROP TABLE IF EXISTS public.notification_prefs;

DELETE FROM vault.secrets WHERE name IN ('push_function_url', 'push_webhook_secret');

-- pg_net wurde erst mit 069 aktiviert und wird sonst nirgends benutzt.
DROP EXTENSION IF EXISTS pg_net;
