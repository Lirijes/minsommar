-- Phase 2a: per-family activity catalog.
-- The existing seeded categories/activities become shared TEMPLATES
-- (family_id IS NULL). Each family gets its own editable clone. RLS is left
-- unchanged here (locked down in step 2c).

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS categories_family_idx ON public.categories(family_id);
CREATE INDEX IF NOT EXISTS activities_family_idx ON public.activities(family_id);

-- Replace the global single-column UNIQUE(name)/UNIQUE(slug) on categories with
-- per-family uniqueness (found by shape so the exact constraint name doesn't matter).
DO $$
DECLARE con TEXT;
BEGIN
  FOR con IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.categories'::regclass
      AND c.contype = 'u' AND array_length(c.conkey, 1) = 1
      AND a.attname IN ('name', 'slug')
  LOOP
    EXECUTE format('ALTER TABLE public.categories DROP CONSTRAINT %I', con);
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS categories_family_slug_key
  ON public.categories(family_id, slug);

-- Clone the template catalog (family_id IS NULL) into a family. SECURITY DEFINER
-- so it can read templates even after the 2c lockdown. Idempotent.
CREATE OR REPLACE FUNCTION public.clone_catalog_for_family(p_family UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.categories WHERE family_id = p_family) THEN
    RETURN; -- already cloned
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
GRANT EXECUTE ON FUNCTION public.clone_catalog_for_family(UUID) TO anon, authenticated;

-- Backfill existing families: give each its own catalog, then point their
-- completions at the family's cloned activities (instead of the template rows).
DO $$
DECLARE fam UUID;
BEGIN
  FOR fam IN SELECT id FROM public.families LOOP
    PERFORM public.clone_catalog_for_family(fam);
  END LOOP;

  UPDATE public.completions c
  SET activity_id = fa.id
  FROM public.children ch, public.activities ta, public.activities fa
  WHERE c.child_id = ch.id
    AND c.activity_id = ta.id AND ta.family_id IS NULL
    AND fa.family_id = ch.family_id
    AND fa.name = ta.name
    AND COALESCE(fa.subcategory, '') = COALESCE(ta.subcategory, '');
END $$;
