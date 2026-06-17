-- Backfill support: let a logged-in parent "claim" a family that has no members
-- yet (i.e. families created before auth, or a brand-new family during
-- onboarding). This also closes a hole: previously any authenticated user could
-- add themselves to ANY family by id. Now you can only join a member-less family.

CREATE OR REPLACE FUNCTION public.family_has_members(p_family UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_id = p_family);
$$;

DROP POLICY IF EXISTS "user adds self as member" ON public.family_members;
DROP POLICY IF EXISTS "claim memberless family" ON public.family_members;
CREATE POLICY "claim memberless family" ON public.family_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.family_has_members(family_id));
