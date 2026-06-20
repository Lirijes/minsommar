import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyFamilyIds } from "@/lib/db";
import { clearCurrentFamilyId, getCurrentFamilyId, setCurrentFamilyId } from "@/lib/family";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

// Establish the session from the redirect URL. supabase-js (detectSessionInUrl,
// on by default) handles the implicit/hash flow (#access_token=…) during client
// init, so awaiting getSession() is enough for that. For the PKCE flow
// (?code=…) we exchange explicitly as a fallback if no session exists yet.
async function establishSession(): Promise<boolean> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session) return true;

  const code = new URLSearchParams(window.location.search).get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return false;
    return !!data.session;
  }
  return false;
}

function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await establishSession();
      if (!active) return;
      if (!ok) {
        setFailed(true);
        return;
      }
      // Session is fully established. Decide where to go. A user may belong to
      // several families — keep the cached active one if it's still a membership,
      // otherwise default to any membership.
      const ids = await fetchMyFamilyIds();
      if (!active) return;
      if (ids.length > 0) {
        const cached = getCurrentFamilyId();
        setCurrentFamilyId(cached && ids.includes(cached) ? cached : ids[0]);
        navigate({ to: "/parent", replace: true });
      } else {
        // No family for this user → make sure no stale cache lingers.
        clearCurrentFamilyId();
        navigate({ to: "/onboarding", replace: true });
      }
    })().catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
      {failed ? (
        <div className="card-soft p-8">
          <div className="text-5xl">🔑</div>
          <h1 className="mt-3 text-2xl">Inloggningen gick inte att slutföra</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Länken kan ha gått ut eller redan använts. Försök logga in igen.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow"
          >
            Till inloggning
          </Link>
        </div>
      ) : (
        <>
          <div className="h-12 w-12 animate-pulse rounded-full bg-white/70" />
          <p className="mt-4 text-sm text-muted-foreground">Loggar in...</p>
        </>
      )}
    </main>
  );
}
