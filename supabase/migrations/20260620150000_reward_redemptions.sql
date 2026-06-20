-- Reward redemptions: a child asks to spend points on a reward; a parent then
-- approves or rejects. Approved redemptions are what "spend" the child's points.
--
-- Points stay fully derived (no balance column, matching points_and_rewards.sql):
--   total earned     = SUM(activities.points) over completions  (only ever grows)
--   available        = total earned − SUM(points of APPROVED redemptions)
-- A pending request does not lower the displayed balance, but it is "reserved":
-- a child can't queue more pending requests than the available balance covers,
-- and approval re-checks the balance under a per-child lock so two parents
-- approving at once (multi-parent) can never push a child below zero.
--
-- Children have no auth.uid() (cookie session only), so they create requests via
-- the service-role server functions. Parents are authenticated and decide through
-- the SECURITY DEFINER functions below — the same pattern as accept_family_invite.

CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Denormalized family_id keeps RLS/scoping identical to the rewards table
  -- (is_family_member(family_id)) without a join in every policy.
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  -- Keep history if the reward is later edited or deleted: the id may go null,
  -- but the snapshotted name + cost keep the redemption (and stats) intact.
  reward_id UUID REFERENCES public.rewards(id) ON DELETE SET NULL,
  reward_name TEXT NOT NULL,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS reward_redemptions_family_status_idx
  ON public.reward_redemptions(family_id, status);
CREATE INDEX IF NOT EXISTS reward_redemptions_child_idx
  ON public.reward_redemptions(child_id);
-- A child can have at most one live (pending) request per reward.
CREATE UNIQUE INDEX IF NOT EXISTS reward_redemptions_one_pending
  ON public.reward_redemptions(child_id, reward_id) WHERE status = 'pending';

GRANT SELECT ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Parents read their family's requests (for the dashboard). Inserts come from the
-- service role (child path); status transitions go through the DEFINER functions
-- below, so no direct INSERT/UPDATE policy is granted to authenticated.
DROP POLICY IF EXISTS "redemptions members read" ON public.reward_redemptions;
CREATE POLICY "redemptions members read" ON public.reward_redemptions
  FOR SELECT TO authenticated
  USING (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- approve_reward_redemption: parent approves a pending request.
-- Locks the row, confirms membership + pending status, then re-derives the
-- balance under a per-child advisory lock and refuses if it no longer covers the
-- cost. The advisory lock serializes approvals for the same child so two
-- concurrent approvals can't both pass the check and overspend.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_reward_redemption(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.reward_redemptions;
  v_earned INTEGER;
  v_spent INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO r FROM public.reward_redemptions WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF NOT public.is_family_member(r.family_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already decided';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(r.child_id::text));

  SELECT COALESCE(SUM(a.points), 0) INTO v_earned
  FROM public.completions c
  JOIN public.activities a ON a.id = c.activity_id
  WHERE c.child_id = r.child_id;

  SELECT COALESCE(SUM(points), 0) INTO v_spent
  FROM public.reward_redemptions
  WHERE child_id = r.child_id AND status = 'approved';

  IF v_earned - v_spent < r.points THEN
    RAISE EXCEPTION 'Barnet har inte tillräckligt med poäng';
  END IF;

  UPDATE public.reward_redemptions
  SET status = 'approved', decided_at = now(), decided_by = auth.uid()
  WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_reward_redemption(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_reward_redemption(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- reject_reward_redemption: parent rejects a pending request. No points move;
-- the child can try again later.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_reward_redemption(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.reward_redemptions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO r FROM public.reward_redemptions WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF NOT public.is_family_member(r.family_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already decided';
  END IF;

  UPDATE public.reward_redemptions
  SET status = 'rejected', decided_at = now(), decided_by = auth.uid()
  WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_reward_redemption(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_reward_redemption(UUID) TO authenticated;
