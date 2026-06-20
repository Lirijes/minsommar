-- Multi-parent support. Lets several authenticated users co-manage one family.
--
-- The data layer is already membership-scoped (is_family_member drives RLS on
-- every family table), so a second family_members row grants full access to
-- children/activities/rewards/etc. automatically. This migration adds the parts
-- that were missing: a real owner role, a secure invite flow, and owner-only
-- administration. Entry into an already-staffed family happens ONLY through the
-- SECURITY DEFINER accept function below — never via client-side INSERT.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Roles: owner | parent. Exactly one owner per family.
-- ---------------------------------------------------------------------------

-- Backfill: the earliest member of each family becomes its owner. (Today every
-- row defaults to 'parent', so no family has an owner yet.)
WITH first_member AS (
  SELECT DISTINCT ON (family_id) id
  FROM public.family_members
  ORDER BY family_id, created_at ASC, id ASC
)
UPDATE public.family_members m
SET role = 'owner'
FROM first_member fm
WHERE m.id = fm.id AND m.role <> 'owner';

ALTER TABLE public.family_members
  DROP CONSTRAINT IF EXISTS family_members_role_check;
ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_role_check CHECK (role IN ('owner', 'parent'));

-- At most one owner per family (enables future ownership transfer as a two-row
-- swap inside one transaction).
CREATE UNIQUE INDEX IF NOT EXISTS family_members_one_owner
  ON public.family_members(family_id) WHERE role = 'owner';

-- Owner-membership check, mirroring is_family_member (SECURITY DEFINER avoids
-- RLS recursion when used inside policies).
CREATE OR REPLACE FUNCTION public.is_family_owner(p_family UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members m
    WHERE m.family_id = p_family AND m.user_id = auth.uid() AND m.role = 'owner'
  );
$$;

-- Harden member removal: the old policy let ANY member delete ANY membership
-- (a parent could remove the owner). Removal now goes through remove_family_member
-- (owner-only); no direct client DELETE is permitted.
DROP POLICY IF EXISTS "members remove memberships" ON public.family_members;

-- ---------------------------------------------------------------------------
-- family_invites: pending invitations to join a family.
-- Only a SHA-256 hash of the token is stored — the raw token lives only in the
-- emailed link, so a DB leak yields no usable invitations.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('parent')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ
);
GRANT SELECT ON public.family_invites TO authenticated;
GRANT ALL ON public.family_invites TO service_role;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS family_invites_family_idx ON public.family_invites(family_id);
-- Block duplicate live invitations to the same address within a family.
CREATE UNIQUE INDEX IF NOT EXISTS family_invites_pending_email
  ON public.family_invites(family_id, lower(email)) WHERE status = 'pending';

-- Only the owner may read their family's invites (token_hash is a hash, not a
-- usable secret). Creation/revocation/resend run server-side (service role).
DROP POLICY IF EXISTS "owner reads invites" ON public.family_invites;
CREATE POLICY "owner reads invites" ON public.family_invites
  FOR SELECT TO authenticated USING (public.is_family_owner(family_id));

-- ---------------------------------------------------------------------------
-- accept_family_invite: the only path into an already-staffed family.
-- Verifies the token, that it is pending + unexpired, and that the signed-in
-- user's email matches the invited address, then creates the membership.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_family_invite(p_token TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  inv public.family_invites;
  uemail TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv FROM public.family_invites
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
  LIMIT 1;

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer valid';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  IF uemail IS NULL OR lower(uemail) <> lower(inv.email) THEN
    RAISE EXCEPTION 'This invite is for a different email address';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (inv.family_id, auth.uid(), 'parent')
  ON CONFLICT (family_id, user_id) DO NOTHING;

  UPDATE public.family_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = inv.id;

  RETURN inv.family_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_family_invite(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_family_invite(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_invite_preview: minimal, non-sensitive context for the /invite page.
-- Callable before login (the token itself is the secret). Never exposes the row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_token TEXT)
RETURNS TABLE (family_name TEXT, inviter_email TEXT, invite_email TEXT, status TEXT, expired BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT f.name, p.email, i.email, i.status, (i.expires_at < now())
  FROM public.family_invites i
  JOIN public.families f ON f.id = i.family_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE i.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_invite_preview(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_family_members: members + their email for the parent UI. Guarded so only
-- a member of the family gets rows. (profiles RLS is own-row-only, so a plain
-- join from the client can't read co-parents' emails — hence this function.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_family_members(p_family UUID)
RETURNS TABLE (id UUID, user_id UUID, role TEXT, email TEXT, created_at TIMESTAMPTZ, is_self BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.user_id, m.role, p.email, m.created_at, (m.user_id = auth.uid())
  FROM public.family_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.family_id = p_family AND public.is_family_member(p_family)
  ORDER BY (m.role = 'owner') DESC, m.created_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.list_family_members(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- remove_family_member: owner-only. Cannot remove an owner (ownership must be
-- transferred first — a separate feature).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_family_member(p_member_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target public.family_members;
BEGIN
  SELECT * INTO target FROM public.family_members WHERE id = p_member_id;
  IF target.id IS NULL THEN
    RETURN;
  END IF;
  IF NOT public.is_family_owner(target.family_id) THEN
    RAISE EXCEPTION 'Only the owner can remove members';
  END IF;
  IF target.role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove the owner';
  END IF;
  DELETE FROM public.family_members WHERE id = p_member_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_family_member(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_family_member(UUID) TO authenticated;
