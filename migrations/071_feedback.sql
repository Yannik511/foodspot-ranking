-- Migration 071: In-App-Feedback (Einstellungen / Über Rankify → "Feedback senden").
--
-- Nutzer können nur EINFÜGEN, nichts lesen. Gelesen wird im Supabase-Dashboard
-- (Table Editor → feedback). Ein Trigger bremst Spam: max. 5 Nachrichten pro
-- Nutzer in 10 Minuten.

CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('idea','bug','praise','other')),
  message     text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  app_version text,
  platform    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user_created ON public.feedback(user_id, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_insert_own" ON public.feedback;
CREATE POLICY "feedback_insert_own" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.feedback_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM public.feedback
    WHERE user_id = NEW.user_id AND created_at > now() - interval '10 minutes'
  ) >= 5 THEN
    RAISE EXCEPTION 'feedback rate limit' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_rate_limit ON public.feedback;
CREATE TRIGGER trg_feedback_rate_limit
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_rate_limit();
