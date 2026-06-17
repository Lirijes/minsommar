-- Auth Phase 1 (additive). Adds parent accounts, family membership, and
-- secure child-access tokens. Does NOT change RLS on the existing data tables
-- (families/children/activities/completions/bucket_items) — that lockdown is a
-- separate, later step so current functionality keeps working.

-- ---------------------------------------------------------------------------
-- profiles: one row per Supabase Auth user (parent account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Auto-create a profile row when a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- family_members: links auth users to the families they administer
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'parent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER membership check, used by policies (avoids RLS recursion).
CREATE OR REPLACE FUNCTION public.is_family_member(p_family UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members m
    WHERE m.family_id = p_family AND m.user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "members read memberships" ON public.family_members;
CREATE POLICY "members read memberships" ON public.family_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_family_member(family_id));
DROP POLICY IF EXISTS "user adds self as member" ON public.family_members;
CREATE POLICY "user adds self as member" ON public.family_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "members remove memberships" ON public.family_members;
CREATE POLICY "members remove memberships" ON public.family_members
  FOR DELETE TO authenticated USING (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- family_access_tokens: the secure child link (256-bit random token)
-- Stored RLS-protected (only the family's parents can read it) so it can be
-- shown/copied/QR-displayed again. Children never read this table directly —
-- they redeem via the SECURITY DEFINER function below.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_access_tokens TO authenticated;
ALTER TABLE public.family_access_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS family_access_tokens_active_idx
  ON public.family_access_tokens(family_id) WHERE revoked_at IS NULL;

DROP POLICY IF EXISTS "family parents read tokens" ON public.family_access_tokens;
CREATE POLICY "family parents read tokens" ON public.family_access_tokens
  FOR SELECT TO authenticated USING (public.is_family_member(family_id));
DROP POLICY IF EXISTS "family parents create tokens" ON public.family_access_tokens;
CREATE POLICY "family parents create tokens" ON public.family_access_tokens
  FOR INSERT TO authenticated WITH CHECK (public.is_family_member(family_id));
DROP POLICY IF EXISTS "family parents revoke tokens" ON public.family_access_tokens;
CREATE POLICY "family parents revoke tokens" ON public.family_access_tokens
  FOR UPDATE TO authenticated USING (public.is_family_member(family_id))
  WITH CHECK (public.is_family_member(family_id));

-- Child redemption: anon-callable, bypasses RLS, returns only the family id for
-- a valid, non-revoked token (and stamps last_used_at). Never exposes the table.
CREATE OR REPLACE FUNCTION public.redeem_family_token(p_token TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  fam UUID;
BEGIN
  SELECT family_id INTO fam
  FROM public.family_access_tokens
  WHERE token = p_token AND revoked_at IS NULL
  LIMIT 1;

  IF fam IS NOT NULL THEN
    UPDATE public.family_access_tokens SET last_used_at = now() WHERE token = p_token;
  END IF;

  RETURN fam;
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_family_token(TEXT) TO anon, authenticated;
