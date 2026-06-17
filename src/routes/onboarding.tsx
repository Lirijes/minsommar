import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addChildrenToFamily,
  addFamilyMember,
  createFamily,
  fetchMyFamilyIds,
  type NewChild,
} from "@/lib/db";
import { getCurrentFamilyId, setCurrentFamilyId } from "@/lib/family";
import { useSession } from "@/lib/auth";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

// Cards on the start page only style these two colours; cycle through them.
const CHILD_COLORS = ["pink", "purple"];

type ChildDraft = { name: string; emoji: string };

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session, loading } = useSession();

  // Family already set up → skip onboarding. Otherwise parents must be logged
  // in; if a logged-in parent already has a family (e.g. on another device),
  // adopt it instead of onboarding again.
  useEffect(() => {
    if (getCurrentFamilyId()) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    let active = true;
    fetchMyFamilyIds().then((ids) => {
      if (active && ids.length > 0) {
        setCurrentFamilyId(ids[0]);
        navigate({ to: "/", replace: true });
      }
    });
    return () => {
      active = false;
    };
  }, [navigate, loading, session]);

  const [step, setStep] = useState<1 | 2>(1);
  const [familyName, setFamilyName] = useState("");
  const [children, setChildren] = useState<ChildDraft[]>([{ name: "", emoji: "" }]);

  const updateChild = (i: number, patch: Partial<ChildDraft>) =>
    setChildren((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addChild = () => setChildren((cs) => [...cs, { name: "", emoji: "" }]);
  const removeChild = (i: number) => setChildren((cs) => cs.filter((_, idx) => idx !== i));

  const namedChildren = children.filter((c) => c.name.trim());

  const create = useMutation({
    mutationFn: async () => {
      const familyId = await createFamily(familyName.trim());
      // Link this family to the signed-in parent.
      if (session?.user) await addFamilyMember(familyId, session.user.id);
      const payload: NewChild[] = namedChildren.map((c, i) => ({
        name: c.name.trim(),
        emoji: c.emoji.trim() || "🙂",
        color: CHILD_COLORS[i % CHILD_COLORS.length],
      }));
      await addChildrenToFamily(familyId, payload);
      return familyId;
    },
    onSuccess: (familyId) => {
      setCurrentFamilyId(familyId);
      qc.invalidateQueries();
      navigate({ to: "/", replace: true });
    },
    onError: () => toast.error("Kunde inte skapa familjen. Försök igen."),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      {/* Step indicator */}
      <div className="mb-5 flex justify-center gap-2">
        {[1, 2].map((s) => (
          <span
            key={s}
            className={`h-2 rounded-full transition-all ${
              step === s ? "w-8 bg-primary" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>

      {step === 1 ? (
        <section className="card-soft p-6 text-center">
          <div className="text-5xl">👋</div>
          <h1 className="mt-3 text-3xl">Välkommen!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Skapa din familj för att komma igång.
          </p>

          <div className="mt-6 text-left">
            <label className="mb-1.5 block px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Familjens namn
            </label>
            <input
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && familyName.trim() && setStep(2)}
              placeholder="T.ex. Familjen Andersson"
              autoFocus
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={() => familyName.trim() && setStep(2)}
            disabled={!familyName.trim()}
            className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow transition active:scale-95 disabled:opacity-40"
          >
            Nästa
          </button>
        </section>
      ) : (
        <section className="card-soft p-6">
          <h1 className="text-2xl">Lägg till barn</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Skriv namn och välj en emoji – använd gärna tangentbordets emojier.
          </p>

          <div className="mt-5 space-y-4">
            {children.map((child, i) => (
              <div key={i} className="rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-sun-soft to-mint-soft text-4xl shadow-inner">
                    {child.emoji.trim() || "🙂"}
                  </div>
                  {children.length > 1 && (
                    <button
                      onClick={() => removeChild(i)}
                      className="grid h-9 w-9 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                      aria-label="Ta bort barn"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={child.name}
                    onChange={(e) => updateChild(i, { name: e.target.value })}
                    placeholder="Barnets namn"
                    className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    value={child.emoji}
                    onChange={(e) => updateChild(i, { emoji: e.target.value })}
                    placeholder="🙂"
                    maxLength={8}
                    inputMode="text"
                    aria-label="Emoji"
                    className="w-16 rounded-xl bg-muted px-2 py-2 text-center text-2xl outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addChild}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-white/60 py-3 text-sm font-bold text-foreground shadow-sm transition hover:bg-white"
          >
            <Plus className="h-5 w-5" /> Lägg till barn
          </button>

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold shadow-sm transition active:scale-95"
            >
              Tillbaka
            </button>
            <button
              onClick={() => create.mutate()}
              disabled={namedChildren.length === 0 || create.isPending}
              className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow transition active:scale-95 disabled:opacity-40"
            >
              {create.isPending ? "Skapar..." : "Skapa familj"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
