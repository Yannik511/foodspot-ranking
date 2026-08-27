-- Migration 067: Login per Zugangsname (Username) ODER E-Mail.
--
-- Der Login-Screen erlaubt künftig E-Mail ODER Zugangsname. Supabase-Auth
-- kennt aber nur die E-Mail. Diese Funktion löst einen Zugangsnamen
-- serverseitig zur E-Mail auf (aus auth.users, der Quelle der Wahrheit).
--
-- SECURITY DEFINER: läuft mit Owner-Rechten, damit auf auth.users gelesen
-- werden kann. Ausführbar für anon (Login passiert vor der Anmeldung) und
-- authenticated. Gegen User-Enumeration: der Client zeigt bei "nicht
-- gefunden" dieselbe generische Fehlermeldung wie bei falschem Passwort.

CREATE OR REPLACE FUNCTION public.get_email_for_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RETURN NULL;
  END IF;

  SELECT au.email INTO v_email
  FROM public.user_profiles up
  JOIN auth.users au ON au.id = up.id
  WHERE lower(up.username) = lower(btrim(p_username))
  LIMIT 1;

  RETURN v_email;
END;
$$;

-- Nur die Funktion darf auf auth.users; das Ausführungsrecht bekommen
-- anon + authenticated, damit der Login-Screen sie aufrufen kann.
REVOKE ALL ON FUNCTION public.get_email_for_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(text) TO anon, authenticated;
