-- Migration 070: „Willkommen zurueck"-Push nach 30 Tagen Inaktivitaet.
--
-- Baut auf 069 auf. „Zuletzt aktiv" ist push_tokens.updated_at: die App
-- meldet ihr Geraete-Token bei jedem Start neu an (register_push_token).
-- Ein taeglicher pg_cron-Job schickt jedem Nutzer, dessen Geraete alle seit
-- 30 Tagen still sind, genau EINE Erinnerung. Erst nach dem naechsten
-- App-Start beginnt die Frist neu.
--
-- Abschaltbar ueber den Schalter „Erinnerungen" (notification_prefs.reminders).

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;
ALTER TABLE public.notification_prefs ADD COLUMN IF NOT EXISTS reminders boolean NOT NULL DEFAULT true;

-- send_push kennt jetzt zusaetzlich p_kind = 'reminders'.
CREATE OR REPLACE FUNCTION public.send_push(
  p_recipients uuid[],
  p_actor      uuid,
  p_kind       text,
  p_title      text,
  p_body       text,
  p_route      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    text;
  v_secret text;
  v_tokens text[];
BEGIN
  SELECT decrypted_secret INTO v_url    FROM vault.decrypted_secrets WHERE name = 'push_function_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN;
  END IF;

  SELECT array_agg(pt.token) INTO v_tokens
  FROM public.push_tokens pt
  LEFT JOIN public.notification_prefs np ON np.user_id = pt.user_id
  WHERE pt.user_id = ANY(p_recipients)
    AND pt.user_id IS DISTINCT FROM p_actor
    AND CASE p_kind
          WHEN 'new_ratings'     THEN COALESCE(np.new_ratings, true)
          WHEN 'shared_lists'    THEN COALESCE(np.shared_lists, true)
          WHEN 'friend_requests' THEN COALESCE(np.friend_requests, true)
          WHEN 'reminders'       THEN COALESCE(np.reminders, true)
          ELSE true
        END
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.blocker_id = pt.user_id AND b.blocked_id = p_actor)
         OR (b.blocker_id = p_actor AND b.blocked_id = pt.user_id)
    );

  IF v_tokens IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := jsonb_build_object(
      'tokens', to_jsonb(v_tokens),
      'title', p_title,
      'body', p_body,
      'route', p_route,
      'kind', p_kind
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Push darf den ausloesenden Schreibvorgang nie scheitern lassen.
  RAISE WARNING 'send_push failed: %', SQLERRM;
END;
$$;

-- Gibt die Zahl der erinnerten Nutzer zurueck.
CREATE OR REPLACE FUNCTION public.send_inactivity_reminders(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users uuid[];
  -- Ein zufaelliger Text pro Lauf, damit die Erinnerung nicht immer gleich klingt.
  v_texts text[][] := ARRAY[
    ['🍔 Lange nicht gesehen!', 'Deine Listen vermissen dich. Welchen Spot hast du zuletzt entdeckt?'],
    ['👀 Was gab’s Gutes?', 'Neuer Lieblingsspot seit dem letzten Mal? Trag ihn ein, bevor du ihn vergisst.'],
    ['🔥 Dein Ranking wartet', 'Zeit für ein Update: Wer ist aktuell deine Nummer 1?'],
    ['🍕 Hunger auf was Neues?', 'Schau, was deine Freunde zuletzt bewertet haben.']
  ];
  v_pick integer := 1 + floor(random() * 4)::integer;
BEGIN
  SELECT array_agg(user_id) INTO v_users
  FROM (
    SELECT user_id
    FROM public.push_tokens
    GROUP BY user_id
    HAVING max(updated_at) < now() - make_interval(days => p_days)
       AND (max(last_reminded_at) IS NULL OR max(last_reminded_at) < max(updated_at))
  ) inactive;

  IF v_users IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM public.send_push(
    v_users, NULL, 'reminders',
    v_texts[v_pick][1],
    v_texts[v_pick][2],
    '/dashboard'
  );

  UPDATE public.push_tokens SET last_reminded_at = now() WHERE user_id = ANY(v_users);
  RETURN array_length(v_users, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.send_inactivity_reminders(integer) FROM PUBLIC, anon, authenticated;

-- Taeglich 17:00 UTC (18 Uhr Winterzeit / 19 Uhr Sommerzeit in Deutschland).
SELECT cron.schedule(
  'push-inactivity-reminder',
  '0 17 * * *',
  $$SELECT public.send_inactivity_reminders()$$
);
