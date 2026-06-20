import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearCurrentFamilyId } from "@/lib/family";

// Parent auth via Supabase (magic link). Children never use this — they use a
// family access token instead (see lib/family.ts + redeemFamilyToken).

export function useSession(): { session: Session | null; user: User | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // getSession() is the authoritative initial read: it awaits client init and
    // returns the persisted session (or null only when genuinely signed out).
    // It only *ends* loading on resolve; a rejection (e.g. auth-lock contention)
    // leaves loading true and we let onAuthStateChange settle it instead.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        /* transient lock/refresh error — do not flip to a null session */
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        return;
      }
      // Only adopt a real session. INITIAL_SESSION can be emitted as null under
      // auth-lock contention (auth-js _emitInitialSession catch path); ignoring
      // that transient null prevents a spurious "logged out" redirect.
      if (s) {
        setSession(s);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

// `redirectTo` overrides the post-login landing page (used by the invite flow to
// return to /invite/<token> and finish accepting). Defaults to /auth/callback.
export async function sendMagicLink(email: string, redirectTo?: string) {
  const fallback =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo ?? fallback },
  });
  if (error) throw error;
}

export async function signOut() {
  // Clear the family cache while the session still resolves the user-scoped key,
  // then sign out. (User-scoping already prevents cross-user reuse; this is hygiene.)
  clearCurrentFamilyId();
  await supabase.auth.signOut();
}
