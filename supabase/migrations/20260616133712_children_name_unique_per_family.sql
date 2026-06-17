-- children.name should be unique within a family, not globally, so two
-- different families can each have e.g. a child named "Lea".

-- 1. Drop the old global UNIQUE(name) constraint (named children_name_key by
--    the inline UNIQUE in the first migration). The DO block finds it by shape
--    so it works regardless of the exact constraint name.
DO $$
DECLARE
  con TEXT;
BEGIN
  SELECT c.conname INTO con
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.conrelid = 'public.children'::regclass
    AND c.contype = 'u'
    AND array_length(c.conkey, 1) = 1
    AND a.attname = 'name'
  LIMIT 1;
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.children DROP CONSTRAINT %I', con);
  END IF;
END $$;

-- 2. Add a composite UNIQUE(family_id, name): names only need to be unique
--    within the same family.
ALTER TABLE public.children DROP CONSTRAINT IF EXISTS children_family_id_name_key;
ALTER TABLE public.children ADD CONSTRAINT children_family_id_name_key UNIQUE (family_id, name);
