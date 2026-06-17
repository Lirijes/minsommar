-- Families: each family owns its children. (Auth is added later; for now the
-- active family is tracked client-side in localStorage.)

CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO anon, authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open families" ON public.families;
CREATE POLICY "open families" ON public.families FOR ALL USING (true) WITH CHECK (true);

-- Children belong to a family and carry their own emoji.
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '🙂';

CREATE INDEX IF NOT EXISTS children_family_idx ON public.children(family_id);

-- Backfill: attach any pre-existing children (e.g. seeded Lea/Nora) to a
-- default family so legacy data keeps working.
DO $$
DECLARE
  fam UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.children WHERE family_id IS NULL) THEN
    INSERT INTO public.families (name) VALUES ('Min familj') RETURNING id INTO fam;
    UPDATE public.children SET family_id = fam WHERE family_id IS NULL;
  END IF;
END $$;
