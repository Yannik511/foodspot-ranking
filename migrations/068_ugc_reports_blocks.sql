-- Migration 068: UGC-Schutz (Apple App Review 1.2) — Melden + Blockieren.
--
-- Zwei Tabellen + RPCs:
--   reports        : gemeldete Inhalte/Nutzer (nur einfügen/eigene lesen)
--   blocked_users  : wer wen blockiert hat
-- block_user() legt Block an UND löscht die Freundschaft beidseitig.
-- Ein Trigger verhindert neue Freundschaftsanfragen zwischen blockierten Paaren.
-- Discover bleibt bewusst UNBERÜHRT (dort werden Namen ohnehin nur bei
-- Freundschaft angezeigt).

-- =====================================================================
-- reports
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('user','spot','photo','list')),
  target_id   text NOT NULL,
  reason      text NOT NULL,
  note        text,
  status      text NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_select_own" ON public.reports;
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

-- =====================================================================
-- blocked_users
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_select_own" ON public.blocked_users;
CREATE POLICY "blocks_select_own" ON public.blocked_users
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_insert_own" ON public.blocked_users;
CREATE POLICY "blocks_insert_own" ON public.blocked_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_delete_own" ON public.blocked_users;
CREATE POLICY "blocks_delete_own" ON public.blocked_users
  FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- =====================================================================
-- RPC: report_content
-- =====================================================================
CREATE OR REPLACE FUNCTION public.report_content(
  p_target_type text,
  p_target_id   text,
  p_reason      text,
  p_note        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  INSERT INTO public.reports (reporter_id, target_type, target_id, reason, note)
  VALUES (auth.uid(), p_target_type, p_target_id, p_reason, p_note);
END;
$$;

-- =====================================================================
-- RPC: block_user  (Block anlegen + Freundschaft beidseitig löschen)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.block_user(p_blocked uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_blocked = auth.uid() THEN
    RAISE EXCEPTION 'cannot block yourself';
  END IF;

  INSERT INTO public.blocked_users (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.friendships
  WHERE (requester_id = auth.uid() AND addressee_id = p_blocked)
     OR (requester_id = p_blocked  AND addressee_id = auth.uid());
END;
$$;

-- =====================================================================
-- RPC: unblock_user
-- =====================================================================
CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.blocked_users
  WHERE blocker_id = auth.uid() AND blocked_id = p_blocked;
END;
$$;

-- =====================================================================
-- Trigger: keine neue Freundschaft zwischen blockierten Paaren
-- =====================================================================
CREATE OR REPLACE FUNCTION public.prevent_blocked_friendship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = NEW.requester_id AND b.blocked_id = NEW.addressee_id)
       OR (b.blocker_id = NEW.addressee_id AND b.blocked_id = NEW.requester_id)
  ) THEN
    RAISE EXCEPTION 'friendship blocked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_blocked_friendship ON public.friendships;
CREATE TRIGGER trg_prevent_blocked_friendship
  BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_friendship();

-- =====================================================================
-- Rechte
-- =====================================================================
REVOKE ALL ON FUNCTION public.report_content(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_user(uuid)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_content(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
