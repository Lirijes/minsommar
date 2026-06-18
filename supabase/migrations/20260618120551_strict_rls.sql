-- Phase 2c: strict RLS lockdown on all family-data tables.
-- Replaces the open `USING(true)` policies with membership-scoped policies,
-- revokes anon access, and hardens the catalog-clone function.
-- Child data access goes through server functions (service role, which bypasses
-- RLS); these policies govern authenticated parents and block everyone else.

-- Map a child to its family without triggering children's RLS (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.child_family(p_child UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM public.children WHERE id = p_child;
$$;

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "open families" ON public.families;
DROP POLICY IF EXISTS "families select members" ON public.families;
DROP POLICY IF EXISTS "families insert authed" ON public.families;
DROP POLICY IF EXISTS "families update members" ON public.families;
DROP POLICY IF EXISTS "families delete members" ON public.families;
-- INSERT allows any signed-in user (the creator adds their membership right
-- after; createFamily inserts without RETURNING so no SELECT is needed here).
CREATE POLICY "families insert authed" ON public.families
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "families select members" ON public.families
  FOR SELECT TO authenticated USING (public.is_family_member(id));
CREATE POLICY "families update members" ON public.families
  FOR UPDATE TO authenticated USING (public.is_family_member(id)) WITH CHECK (public.is_family_member(id));
CREATE POLICY "families delete members" ON public.families
  FOR DELETE TO authenticated USING (public.is_family_member(id));

-- ---------------------------------------------------------------------------
-- children
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "open children" ON public.children;
DROP POLICY IF EXISTS "children members" ON public.children;
CREATE POLICY "children members" ON public.children
  FOR ALL TO authenticated
  USING (public.is_family_member(family_id))
  WITH CHECK (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "open categories" ON public.categories;
DROP POLICY IF EXISTS "categories members" ON public.categories;
CREATE POLICY "categories members" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_family_member(family_id))
  WITH CHECK (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "open activities" ON public.activities;
DROP POLICY IF EXISTS "activities members" ON public.activities;
CREATE POLICY "activities members" ON public.activities
  FOR ALL TO authenticated
  USING (public.is_family_member(family_id))
  WITH CHECK (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- completions (scoped via child -> family)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "open completions" ON public.completions;
DROP POLICY IF EXISTS "completions members" ON public.completions;
CREATE POLICY "completions members" ON public.completions
  FOR ALL TO authenticated
  USING (public.is_family_member(public.child_family(child_id)))
  WITH CHECK (public.is_family_member(public.child_family(child_id)));

-- ---------------------------------------------------------------------------
-- bucket_items (scoped via child -> family)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "open bucket_items" ON public.bucket_items;
DROP POLICY IF EXISTS "bucket_items members" ON public.bucket_items;
CREATE POLICY "bucket_items members" ON public.bucket_items
  FOR ALL TO authenticated
  USING (public.is_family_member(public.child_family(child_id)))
  WITH CHECK (public.is_family_member(public.child_family(child_id)));

-- ---------------------------------------------------------------------------
-- Revoke anon access entirely on family tables (RLS already denies anon since
-- no anon policy exists; this removes the table grants too, defense-in-depth).
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.families FROM anon;
REVOKE ALL ON public.children FROM anon;
REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.activities FROM anon;
REVOKE ALL ON public.completions FROM anon;
REVOKE ALL ON public.bucket_items FROM anon;

-- These functions are now invoked server-side (service role) only.
REVOKE EXECUTE ON FUNCTION public.redeem_family_token(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.clone_catalog_for_family(UUID) FROM anon;

-- Harden the catalog clone: only a member may seed their own family's catalog.
CREATE OR REPLACE FUNCTION public.clone_catalog_for_family(p_family UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_family_member(p_family) THEN
    RAISE EXCEPTION 'Not a member of this family';
  END IF;
  IF EXISTS (SELECT 1 FROM public.categories WHERE family_id = p_family) THEN
    RETURN;
  END IF;
  INSERT INTO public.categories (family_id, name, slug, icon, sort_order)
  SELECT p_family, name, slug, icon, sort_order
  FROM public.categories WHERE family_id IS NULL;
  INSERT INTO public.activities (family_id, category_id, name, emoji, sort_order, subcategory, is_favorite)
  SELECT p_family, fc.id, a.name, a.emoji, a.sort_order, a.subcategory, false
  FROM public.activities a
  JOIN public.categories tc ON tc.id = a.category_id AND tc.family_id IS NULL
  JOIN public.categories fc ON fc.family_id = p_family AND fc.slug = tc.slug
  WHERE a.family_id IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.clone_catalog_for_family(UUID) TO authenticated;
