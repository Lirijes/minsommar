-- Optional points & rewards system (off by default per family).
-- Additive and backwards-compatible: with points_enabled = false nothing in the
-- app changes. Follows the same per-family + strict-RLS patterns as the existing
-- tables (see strict_rls.sql): member-scoped policies, grants to authenticated
-- (never anon), service_role for the server-mediated child reads.

-- Family-level switch. Default OFF so existing families are unaffected.
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS points_enabled BOOLEAN NOT NULL DEFAULT false;

-- Per-activity points. NULL = activity gives no points ("Ge poäng" toggle off).
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS points INTEGER;

-- ---------------------------------------------------------------------------
-- rewards: parent-defined rewards a child can save points toward.
-- The child's balance is derived from completions (no balance table); rewards
-- only store the cost. Redemption is intentionally out of scope for now.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points_required INTEGER NOT NULL CHECK (points_required >= 0),
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rewards_family_idx ON public.rewards(family_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rewards members" ON public.rewards;
CREATE POLICY "rewards members" ON public.rewards
  FOR ALL TO authenticated
  USING (public.is_family_member(family_id))
  WITH CHECK (public.is_family_member(family_id));
