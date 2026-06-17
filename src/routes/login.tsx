import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { sendMagicLink, useSession } from "@/lib/auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  // Already signed in → go to the parent view.
  useEffect(() => {
    if (!loading && session) navigate({ to: "/parent", replace: true });
  }, [loading, session, navigate]);

  const submit = async () => {
    if (!email.trim()) return;
    setSending(true);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch {
      toast.error("Kunde inte skicka länken. Kontrollera adressen och försök igen.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <section className="card-soft p-6 text-center">
        <div className="text-5xl">{sent ? "📬" : "👋"}</div>
        <h1 className="mt-3 text-3xl">{sent ? "Kolla din mejl!" : "Logga in"}</h1>

        {sent ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Vi har skickat en inloggningslänk till <span className="font-semibold">{email}</span>.
            Öppna den på den här enheten för att fortsätta.

            <span className="font-semibold">Om du inte ser mejlet, kolla din skräppost.</span>
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              För föräldrar. Vi mejlar en inloggningslänk – inget lösenord behövs.
            </p>
            <div className="mt-6 text-left">
              <label className="mb-1.5 block px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                E-post
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="namn@exempel.se"
                  autoFocus
                  className="w-full rounded-2xl bg-white py-3 pl-11 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <button
              onClick={submit}
              disabled={!email.trim() || sending}
              className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow transition active:scale-95 disabled:opacity-40"
            >
              {sending ? "Skickar..." : "Skicka inloggningslänk"}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
