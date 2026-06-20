import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendMagicLink } from "@/lib/auth";
import { acceptFamilyInvite, getInvitePreview, type InvitePreview } from "@/lib/db";
import { setCurrentFamilyId } from "@/lib/family";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

// Establish a session from the redirect URL when the user arrives here straight
// from a magic link (#access_token=… or ?code=…). Mirrors /auth/callback so the
// invite can be accepted in the same hop. Returns true if a session is active.
async function establishSession(): Promise<boolean> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session) return true;
  if (typeof window === "undefined") return false;
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return false;
    return !!data.session;
  }
  return false;
}

type State =
  | { kind: "loading" }
  | { kind: "needsLogin"; preview: InvitePreview }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [sending, setSending] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let active = true;

    (async () => {
      const hasSession = await establishSession();
      const preview = await getInvitePreview(token);
      if (!active) return;

      if (!preview) {
        setState({ kind: "error", message: "Inbjudan kunde inte hittas." });
        return;
      }
      if (preview.status === "revoked") {
        setState({ kind: "error", message: "Inbjudan har återkallats." });
        return;
      }
      if (preview.status === "accepted") {
        setState({ kind: "error", message: "Inbjudan har redan använts." });
        return;
      }
      if (preview.expired) {
        setState({ kind: "error", message: "Inbjudan har gått ut. Be om en ny." });
        return;
      }

      // Pending + valid. If logged in, accept right away; else ask to log in.
      if (hasSession) {
        try {
          const familyId = await acceptFamilyInvite(token);
          if (!active) return;
          setCurrentFamilyId(familyId);
          await qc.invalidateQueries();
          toast.success("Du är nu med i familjen!");
          navigate({ to: "/parent", replace: true });
        } catch (e) {
          if (!active) return;
          const message =
            e instanceof Error && /different email/i.test(e.message)
              ? `Inbjudan gäller ${preview.invite_email}. Logga in med den adressen för att gå med.`
              : "Det gick inte att gå med i familjen. Försök igen.";
          setState({ kind: "error", message });
        }
      } else {
        setState({ kind: "needsLogin", preview });
      }
    })().catch(() => {
      if (active) setState({ kind: "error", message: "Något gick fel. Försök igen." });
    });

    return () => {
      active = false;
    };
  }, [token, navigate, qc]);

  const requestLogin = async (email: string) => {
    setSending(true);
    try {
      // Return to THIS invite page after login so acceptance finishes in one hop.
      const redirectTo = `${window.location.origin}/invite/${token}`;
      await sendMagicLink(email, redirectTo);
      setState({ kind: "sent", email });
    } catch {
      toast.error("Kunde inte skicka länken. Försök igen.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
      {state.kind === "loading" && (
        <>
          <div className="h-12 w-12 animate-pulse rounded-full bg-white/70" />
          <p className="mt-4 text-sm text-muted-foreground">Öppnar inbjudan...</p>
        </>
      )}

      {state.kind === "needsLogin" && (
        <NeedsLogin preview={state.preview} sending={sending} onContinue={requestLogin} />
      )}

      {state.kind === "sent" && (
        <div className="card-soft p-8">
          <div className="text-5xl">📬</div>
          <h1 className="mt-3 text-2xl">Kolla din mejl!</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Vi har skickat en länk till <span className="font-semibold">{state.email}</span>. Öppna
            den på den här enheten så ansluts du till familjen automatiskt.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Hittar du inte mejlet? Kolla skräpposten.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="card-soft p-8">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-3 text-2xl">Inbjudan</h1>
          <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
          <Link
            to="/login"
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow"
          >
            Till inloggning
          </Link>
        </div>
      )}
    </main>
  );
}

function NeedsLogin({
  preview,
  sending,
  onContinue,
}: {
  preview: InvitePreview;
  sending: boolean;
  onContinue: (email: string) => void;
}) {
  // The invited address is fixed (acceptance requires an exact match), so we show
  // it rather than letting the user type a different one.
  const inviter = preview.inviter_email ?? "En förälder";
  return (
    <div className="card-soft p-8">
      <div className="text-5xl">☀️</div>
      <h1 className="mt-3 text-2xl">Du är inbjuden!</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-semibold">{inviter}</span> har bjudit in dig att hantera familjen{" "}
        <span className="font-semibold">{preview.family_name}</span>.
      </p>
      <div className="mt-5 rounded-2xl bg-muted px-4 py-3 text-sm">{preview.invite_email}</div>
      <button
        onClick={() => onContinue(preview.invite_email)}
        disabled={sending}
        className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow transition active:scale-95 disabled:opacity-40"
      >
        {sending ? "Skickar..." : "Fortsätt med e-postlänk"}
      </button>
      <p className="mt-3 text-xs text-muted-foreground">
        Vi mejlar en inloggningslänk – inget lösenord behövs. Har du inget konto skapas det
        automatiskt.
      </p>
    </div>
  );
}
