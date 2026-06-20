import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addActivity,
  deleteActivity,
  fetchActivities,
  fetchCategories,
  fetchFamilySettings,
  fetchMyFamilyIds,
  updateActivity,
  SUBCATEGORIES,
  type Activity,
  type Category,
} from "@/lib/db";
import { getCurrentFamilyId, setCurrentFamilyId } from "@/lib/family";
import { useSession } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Activity management lives on its own page (linked from the parent home), keeping
// the home a clean control center. Mobile-first: each activity is a card, new ones
// are added via a floating "+" that opens a dialog.
export const Route = createFileRoute("/aktiviteter")({
  component: ActivitiesPage,
});

// Same category order as the child view.
const GOAL_ORDER = ["rorelse", "hemmafix", "kreativitet"];

// Parse a points field into a non-negative int, or null when the toggle is off.
function parsePoints(on: boolean, value: string): number | null {
  return on ? Math.max(0, Math.floor(Number(value) || 0)) : null;
}

function ActivitiesPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  // Resolve the active family from membership (same approach as parent.tsx).
  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    (async () => {
      const ids = await fetchMyFamilyIds();
      const id = ids[0] ?? getCurrentFamilyId();
      if (!active) return;
      if (id) setCurrentFamilyId(id);
      setFamilyId(id);
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const settingsQ = useQuery({ queryKey: ["family-settings"], queryFn: fetchFamilySettings });
  const pointsEnabled = settingsQ.data?.points_enabled ?? false;
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const actsQ = useQuery({
    queryKey: ["activities"],
    queryFn: fetchActivities,
    enabled: !!familyId,
  });

  const orderedCats = useMemo(() => {
    if (!catsQ.data) return [] as Category[];
    return [...catsQ.data].sort((a, b) => GOAL_ORDER.indexOf(a.slug) - GOAL_ORDER.indexOf(b.slug));
  }, [catsQ.data]);

  if (loading || !session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/70" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-28 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/parent"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/80 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl">Aktiviteter</h1>
      </div>

      <div className="space-y-7">
        {orderedCats.map((cat) => {
          const acts = (actsQ.data ?? []).filter((a) => a.category_id === cat.id);
          return (
            <section key={cat.id}>
              <h2 className="mb-3 px-1 text-lg">{cat.name}</h2>
              {cat.slug === "kreativitet" ? (
                <div className="space-y-4">
                  {SUBCATEGORIES.map((sub) => {
                    const subActs = acts.filter((a) => a.subcategory === sub.slug);
                    if (subActs.length === 0) return null;
                    return (
                      <div key={sub.slug}>
                        <div className="mb-2 px-1 text-xs font-bold text-muted-foreground">
                          {sub.emoji} {sub.label}
                        </div>
                        <div className="space-y-2.5">
                          {subActs.map((a) => (
                            <ActivityCard key={a.id} a={a} pointsEnabled={pointsEnabled} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {acts.map((a) => (
                    <ActivityCard key={a.id} a={a} pointsEnabled={pointsEnabled} />
                  ))}
                  {acts.length === 0 && (
                    <p className="px-1 text-sm text-muted-foreground">Inga aktiviteter än.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Floating add button, aligned to the centered column. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40">
        <div className="mx-auto flex max-w-md justify-end px-5">
          <button
            onClick={() => setAdding(true)}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95"
            aria-label="Lägg till aktivitet"
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>
      </div>

      <AddActivityDialog
        open={adding}
        onOpenChange={setAdding}
        categories={orderedCats}
        pointsEnabled={pointsEnabled}
      />
    </main>
  );
}

// One activity as a card, with inline edit and delete. Self-contained.
function ActivityCard({ a, pointsEnabled }: { a: Activity; pointsEnabled: boolean }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["activities"] });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(a.name);
  const [emoji, setEmoji] = useState(a.emoji);
  const [givePoints, setGivePoints] = useState(a.points != null);
  const [points, setPoints] = useState(String(a.points ?? 10));

  const startEdit = () => {
    setName(a.name);
    setEmoji(a.emoji);
    setGivePoints(a.points != null);
    setPoints(String(a.points ?? 10));
    setEditing(true);
  };

  const updM = useMutation({
    mutationFn: () =>
      updateActivity(a.id, name.trim(), emoji.trim(), parsePoints(givePoints, points)),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      toast.success("Sparat");
    },
  });
  const delM = useMutation({
    mutationFn: () => deleteActivity(a.id),
    onSuccess: () => {
      invalidate();
      toast.success("Borttagen");
    },
  });

  if (editing) {
    return (
      <div className="card-soft space-y-2 p-3">
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            aria-label="Emoji"
            className="w-14 shrink-0 rounded-xl bg-muted px-2 py-2 text-center text-xl outline-none"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aktivitetens namn"
            className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none"
          />
        </div>
        {pointsEnabled && (
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <span className="flex-1 text-sm font-semibold">Ge poäng</span>
            {givePoints && (
              <input
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="w-20 rounded-xl bg-white px-2 py-1.5 text-center text-sm outline-none"
                aria-label="Antal poäng"
              />
            )}
            <Switch checked={givePoints} onCheckedChange={setGivePoints} aria-label="Ge poäng" />
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => name.trim() && updM.mutate()}
            disabled={!name.trim()}
            className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Spara
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-xl bg-white px-4 text-xs shadow-sm"
          >
            Avbryt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-soft flex items-center gap-3 p-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sun-soft to-mint-soft text-2xl shadow-inner">
        {a.emoji}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.name}</span>
      {pointsEnabled && a.points != null && (
        <span className="shrink-0 rounded-full bg-sun-soft px-2.5 py-1 text-xs font-bold text-foreground">
          +{a.points} p
        </span>
      )}
      <button
        onClick={startEdit}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-peach-soft"
        aria-label="Ändra"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={() => {
          if (confirm(`Ta bort "${a.name}"?`)) delM.mutate();
        }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10"
        aria-label="Ta bort"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// Add a new activity: pick a category (and subcategory for "Kreativitet"), emoji,
// name, and optionally points. Opened from the floating "+".
function AddActivityDialog({
  open,
  onOpenChange,
  categories,
  pointsEnabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  pointsEnabled: boolean;
}) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [subcategory, setSubcategory] = useState(SUBCATEGORIES[0].slug);
  const [emoji, setEmoji] = useState("✨");
  const [name, setName] = useState("");
  const [givePoints, setGivePoints] = useState(false);
  const [points, setPoints] = useState("10");

  // Reset to sensible defaults each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCategoryId(categories[0]?.id ?? "");
    setSubcategory(SUBCATEGORIES[0].slug);
    setEmoji("✨");
    setName("");
    setGivePoints(pointsEnabled);
    setPoints("10");
  }, [open, categories, pointsEnabled]);

  const subcategorized = categories.find((c) => c.id === categoryId)?.slug === "kreativitet";

  const addM = useMutation({
    mutationFn: () =>
      addActivity(
        categoryId,
        name.trim(),
        emoji.trim(),
        subcategorized ? subcategory : null,
        parsePoints(givePoints, points),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      onOpenChange(false);
      toast.success("Aktivitet tillagd");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Ny aktivitet</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
            aria-label="Kategori"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {subcategorized && (
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
              aria-label="Underkategori"
            >
              {SUBCATEGORIES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.emoji} {s.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              aria-label="Emoji"
              className="w-14 shrink-0 rounded-xl bg-muted px-2 py-2 text-center text-xl outline-none"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aktivitetens namn"
              autoFocus
              className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none"
            />
          </div>

          {pointsEnabled && (
            <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
              <span className="flex-1 text-sm font-semibold">Ge poäng</span>
              {givePoints && (
                <input
                  type="number"
                  min={0}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="w-20 rounded-xl bg-white px-2 py-1.5 text-center text-sm outline-none"
                  aria-label="Antal poäng"
                />
              )}
              <Switch checked={givePoints} onCheckedChange={setGivePoints} aria-label="Ge poäng" />
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-xl bg-white px-4 py-2 text-sm shadow-sm"
          >
            <X className="mr-1 inline h-4 w-4" />
            Avbryt
          </button>
          <button
            onClick={() => name.trim() && categoryId && addM.mutate()}
            disabled={!name.trim() || !categoryId || addM.isPending}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Lägg till
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
