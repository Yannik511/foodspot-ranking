-- Migration 069: Push-Benachrichtigungen (APNs).
--
-- Ablauf: Trigger auf friendships / list_invitations / foodspot_ratings
-- bauen Titel + Text, filtern Empfaenger (Einstellungen, Blockierungen) und
-- schicken die Geraete-Tokens per pg_net an die Edge Function `send-push`,
-- die sie an Apple weiterreicht.
--
-- Fail-open: Fehlen die Vault-Secrets oder schlaegt der Versand fehl, laeuft
-- der eigentliche Schreibvorgang (Anfrage, Einladung, Bewertung) unveraendert
-- durch. Push darf nie einen Insert blockieren.
--
-- Einmalig NACH dieser Migration im SQL-Editor ausfuehren (Werte einsetzen):
--   select vault.create_secret('https://<projekt>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<zufaelliger langer String>', 'push_webhook_secret');
-- Derselbe String muss als PUSH_WEBHOOK_SECRET bei der Edge Function liegen.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================================
-- push_tokens: ein Geraete-Token gehoert genau einem Nutzer
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.push_tokens (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform   text NOT NULL DEFAULT 'ios',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_select_own" ON public.push_tokens;
CREATE POLICY "push_tokens_select_own" ON public.push_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Schreiben nur ueber die RPCs unten (ein Token kann den Besitzer wechseln,
-- wenn sich auf demselben Geraet ein anderer Account anmeldet).

-- =====================================================================
-- notification_prefs: die drei Schalter aus den Einstellungen
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_ratings     boolean NOT NULL DEFAULT true,
  shared_lists    boolean NOT NULL DEFAULT true,
  friend_requests boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_prefs_select_own" ON public.notification_prefs;
CREATE POLICY "notification_prefs_select_own" ON public.notification_prefs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_prefs_insert_own" ON public.notification_prefs;
CREATE POLICY "notification_prefs_insert_own" ON public.notification_prefs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_prefs_update_own" ON public.notification_prefs;
CREATE POLICY "notification_prefs_update_own" ON public.notification_prefs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- RPC: register_push_token / unregister_push_token
-- =====================================================================
CREATE OR REPLACE FUNCTION public.register_push_token(p_token text, p_platform text DEFAULT 'ios')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_token IS NULL OR length(p_token) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.push_tokens (token, user_id, platform)
  VALUES (p_token, auth.uid(), COALESCE(p_platform, 'ios'))
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.push_tokens
  WHERE token = p_token AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_token(text) TO authenticated;

-- =====================================================================
-- Versand: Empfaenger filtern, Tokens sammeln, an die Edge Function geben
-- p_kind ∈ 'new_ratings' | 'shared_lists' | 'friend_requests'
-- =====================================================================
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

REVOKE ALL ON FUNCTION public.send_push(uuid[], uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Anzeigename fuer den Push-Text.
CREATE OR REPLACE FUNCTION public.push_display_name(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT username FROM public.user_profiles WHERE id = p_user), 'Jemand');
$$;

REVOKE ALL ON FUNCTION public.push_display_name(uuid) FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- Trigger: Freundschaftsanfrage gestellt / angenommen
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_push_friendship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    PERFORM public.send_push(
      ARRAY[NEW.addressee_id], NEW.requester_id, 'friend_requests',
      '👋 Neue Freundschaftsanfrage',
      public.push_display_name(NEW.requester_id) || ' möchte sich mit dir vernetzen. Schau mal rein!',
      '/social'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    PERFORM public.send_push(
      ARRAY[NEW.requester_id], NEW.addressee_id, 'friend_requests',
      '🎉 Ihr seid jetzt befreundet',
      public.push_display_name(NEW.addressee_id) || ' hat deine Anfrage angenommen. Vergleicht eure Rankings!',
      '/friend/' || NEW.addressee_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_friendship ON public.friendships;
CREATE TRIGGER trg_push_friendship
  AFTER INSERT OR UPDATE OF status ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_friendship();

-- =====================================================================
-- Trigger: Einladung zu einer geteilten Liste
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_push_list_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT list_name INTO v_list FROM public.lists WHERE id = NEW.list_id;
    PERFORM public.send_push(
      ARRAY[NEW.invitee_id], NEW.inviter_id, 'shared_lists',
      '📋 Neue Listen-Einladung',
      public.push_display_name(NEW.inviter_id) || ' will mit dir „' || COALESCE(v_list, 'eine Liste') || '“ ranken. Bist du dabei?',
      '/social'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_list_invitation ON public.list_invitations;
CREATE TRIGGER trg_push_list_invitation
  AFTER INSERT ON public.list_invitations
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_list_invitation();

-- =====================================================================
-- Trigger: neue Bewertung in einer geteilten Liste
-- Geht an Owner + Mitglieder, nicht an den Bewertenden selbst.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_push_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipients uuid[];
  v_list       text;
  v_spot       text;
BEGIN
  SELECT array_agg(DISTINCT uid) INTO v_recipients
  FROM (
    SELECT user_id AS uid FROM public.list_members WHERE list_id = NEW.list_id
    UNION
    SELECT user_id AS uid FROM public.lists WHERE id = NEW.list_id
  ) members
  WHERE uid IS DISTINCT FROM NEW.user_id;

  IF v_recipients IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT list_name INTO v_list FROM public.lists WHERE id = NEW.list_id;
  SELECT name INTO v_spot FROM public.foodspots WHERE id = NEW.foodspot_id;

  PERFORM public.send_push(
    v_recipients, NEW.user_id, 'new_ratings',
    '⭐ ' || COALESCE(v_list, 'Geteilte Liste'),
    public.push_display_name(NEW.user_id) || ' hat ' || COALESCE(v_spot, 'einen Spot') || ' bewertet. Siehst du das genauso?',
    '/shared/tierlist/' || NEW.list_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_rating ON public.foodspot_ratings;
CREATE TRIGGER trg_push_rating
  AFTER INSERT ON public.foodspot_ratings
  FOR EACH ROW EXECUTE FUNCTION public.trg_push_rating();
