import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addBucketItem,
  addBucketItems,
  deleteBucketItem,
  fetchBucketItems,
  fetchChildByName,
  randomBucketCheer,
  setBucketItemDone,
  updateBucketItem,
  BUCKET_SUGGESTIONS,
  type BucketItem,
  type BucketSuggestion,
} from "@/lib/db";
import { ArrowLeft, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { ChildTabs } from "@/components/ChildTabs";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import confetti from "canvas-confetti";

export const Route = createFileRoute("/child/$name/bucketlist")({
  component: BucketListPage,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p>Barnet hittades inte.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Tillbaka
      </Link>
    </div>
  ),
});

function fireConfetti() {
  const end = Date.now() + 900;
  const colors = ["#fbbf24", "#34d399", "#60a5fa", "#f9a8d4", "#fb923c"];
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 75, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 5, angle: 120, spread: 75, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

// Circular progress ring ("framstegsring").
function ProgressRing({ pct }: { pct: number }) {
  const size = 76;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--turquoise)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-lg font-bold">{pct}%</div>
    </div>
  );
}

function BucketListPage() {
  const { name } = Route.useParams();
  const qc = useQueryClient();

  const childQ = useQuery({ queryKey: ["child", name], queryFn: () => fetchChildByName(name) });
  const child = childQ.data;
  if (childQ.isFetched && !child) throw notFound();

  const itemsQ = useQuery({
    queryKey: ["bucket", child?.id],
    queryFn: () => fetchBucketItems(child!.id),
    enabled: !!child,
  });
  const items = itemsQ.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bucket", child!.id] });

  const isWelcome = itemsQ.isFetched && items.length === 0;

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-24 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/child/$name"
          params={{ name }}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-foreground shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </div>

      <ChildTabs name={name} active="bucketlist" />

      {isWelcome ? (
        <Welcome childId={child!.id} childName={child!.name} onSaved={invalidate} />
      ) : (
        <BucketBoard items={items} childId={child?.id} onChange={invalidate} loading={itemsQ.isLoading} />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// First-time welcome: pick goals to start with
// ---------------------------------------------------------------------------
function Welcome({
  childId,
  childName,
  onSaved,
}: {
  childId: string;
  childName: string;
  onSaved: () => void;
}) {
  const [picks, setPicks] = useState<BucketSuggestion[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customEmoji, setCustomEmoji] = useState("🌟");

  const MAX_PICKS = 10;
  const isPicked = (s: BucketSuggestion) => picks.some((p) => p.title === s.title);
  const toggle = (s: BucketSuggestion) =>
    setPicks((ps) => {
      if (isPicked(s)) return ps.filter((p) => p.title !== s.title);
      if (ps.length >= MAX_PICKS) {
        toast("Du kan välja upp till 10 nu – fler kan du lägga till sen! 🌞");
        return ps;
      }
      return [...ps, s];
    });

  const addCustom = () => {
    const t = customTitle.trim();
    if (!t || picks.some((p) => p.title === t)) return;
    if (picks.length >= MAX_PICKS) {
      toast("Du kan välja upp till 10 nu – fler kan du lägga till sen! 🌞");
      return;
    }
    setPicks((ps) => [...ps, { title: t, emoji: customEmoji.trim() || "🌟" }]);
    setCustomTitle("");
    setCustomEmoji("🌟");
  };

  const save = useMutation({
    mutationFn: () => addBucketItems(childId, picks),
    onSuccess: () => {
      onSaved();
      fireConfetti();
      toast.success("Din sommarbucketlist är skapad! 🌞");
    },
  });

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-turquoise-soft via-sky-soft to-sand-soft p-6 text-center shadow-sm">
        <div className="text-5xl">🌞</div>
        <h1 className="mt-3 text-2xl">Välj upp till 10 saker du vill hinna göra i sommar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hej {childName}! Tryck på det du drömmer om – eller lägg till egna mål.
        </p>
      </div>

      <div className="sticky top-2 z-10 flex items-center justify-between rounded-2xl bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
        <span className="text-sm font-semibold">
          {picks.length} / {MAX_PICKS} valda {picks.length >= 1 ? "🎉" : ""}
        </span>
        <button
          onClick={() => save.mutate()}
          disabled={picks.length === 0 || save.isPending}
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow disabled:opacity-40"
        >
          {save.isPending ? "Sparar..." : "Skapa min lista"}
        </button>
      </div>

      {/* Add own goal */}
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base">Lägg till ett eget mål</h2>
        <div className="flex gap-2">
          <input
            value={customEmoji}
            onChange={(e) => setCustomEmoji(e.target.value)}
            className="w-14 rounded-xl bg-pink-soft px-2 py-2 text-center text-xl"
            maxLength={4}
          />
          <input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="T.ex. Bygga en sandslott"
            className="flex-1 rounded-xl bg-pink-soft px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={addCustom}
            disabled={!customTitle.trim()}
            className="grid w-11 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Lägg till"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Suggestion library */}
      <div>
        <h2 className="mb-3 px-1 text-lg">Förslag att välja bland</h2>
        <div className="grid grid-cols-2 gap-3">
          {BUCKET_SUGGESTIONS.map((s) => {
            const picked = isPicked(s);
            return (
              <button
                key={s.title}
                onClick={() => toggle(s)}
                className={`relative flex min-h-[96px] flex-col items-start justify-between rounded-3xl p-4 text-left shadow-sm transition active:scale-95 ${
                  picked
                    ? "bg-gradient-to-br from-turquoise to-sky text-foreground ring-2 ring-turquoise"
                    : "bg-white hover:bg-white/90"
                }`}
              >
                <span className="text-3xl">{s.emoji}</span>
                <span className="text-sm font-semibold leading-tight">{s.title}</span>
                {picked && (
                  <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white shadow">
                    <Check className="h-4 w-4 text-foreground" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main board with progress + cards
// ---------------------------------------------------------------------------
function BucketBoard({
  items,
  childId,
  onChange,
  loading,
}: {
  items: BucketItem[];
  childId?: string;
  onChange: () => void;
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEmoji, setNewEmoji] = useState("🌟");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editEmoji, setEditEmoji] = useState("");

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, remaining: total - done, pct };
  }, [items]);

  const toggleDone = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setBucketItemDone(id, done),
    onSuccess: (_d, vars) => {
      onChange();
      if (vars.done) {
        fireConfetti();
        toast.success(randomBucketCheer());
      }
    },
  });
  const addM = useMutation({
    mutationFn: () => addBucketItem(childId!, newTitle.trim(), newEmoji.trim()),
    onSuccess: () => {
      onChange();
      setNewTitle("");
      setNewEmoji("🌟");
      setAdding(false);
    },
  });
  const updM = useMutation({
    mutationFn: (id: string) => updateBucketItem(id, editTitle.trim(), editEmoji.trim()),
    onSuccess: () => {
      onChange();
      setEditingId(null);
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteBucketItem(id),
    onSuccess: () => onChange(),
  });

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="rounded-3xl bg-gradient-to-br from-turquoise-soft via-sky-soft to-mint-soft p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-4">
          <ProgressRing pct={stats.pct} />
          <div>
            <h1 className="text-2xl">🏖️ Min sommar</h1>
            <p className="text-sm text-muted-foreground">
              {stats.remaining > 0
                ? `${stats.remaining} mål kvar att uppleva`
                : "Alla mål klara – vilken sommar! 🎉"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 rounded-2xl bg-white/80 px-3 py-2 text-center">
            <div className="text-xl font-bold">{stats.done}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Avklarade
            </div>
          </div>
          <div className="flex-1 rounded-2xl bg-white/80 px-3 py-2 text-center">
            <div className="text-xl font-bold">{stats.remaining}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Kvar
            </div>
          </div>
          <div className="flex-1 rounded-2xl bg-white/80 px-3 py-2 text-center">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Totalt
            </div>
          </div>
        </div>
      </div>

      {/* Add goal */}
      {adding ? (
        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex gap-2">
            <input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="w-14 rounded-xl bg-pink-soft px-2 py-2 text-center text-xl"
              maxLength={4}
            />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && addM.mutate()}
              placeholder="Vad vill du hinna göra?"
              autoFocus
              className="flex-1 rounded-xl bg-pink-soft px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => newTitle.trim() && addM.mutate()}
              disabled={!newTitle.trim()}
              className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              Lägg till mål
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-xl bg-white px-4 text-sm font-semibold shadow-sm"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-peach bg-white/60 py-4 text-sm font-bold text-foreground shadow-sm transition hover:bg-white"
        >
          <Plus className="h-5 w-5" /> Lägg till eget mål
        </button>
      )}

      {/* Cards */}
      {loading ? (
        <div className="h-24 animate-pulse rounded-3xl bg-white/60" />
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div
              key={it.id}
              className={`rounded-3xl p-4 shadow-sm transition ${
                it.done
                  ? "bg-gradient-to-br from-mint-soft to-peach-soft ring-2 ring-mint"
                  : "bg-white"
              }`}
            >
              {editingId === it.id ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      className="w-14 rounded-xl bg-purple-soft px-2 py-2 text-center text-xl"
                      maxLength={4}
                    />
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex-1 rounded-xl bg-purple-soft px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => editTitle.trim() && updM.mutate(it.id)}
                      className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground"
                    >
                      Spara
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-xl bg-white px-4 text-sm font-semibold shadow-sm"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDone.mutate({ id: it.id, done: !it.done })}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-2xl shadow-inner transition ${
                      it.done ? "bg-mint" : "bg-pink-soft"
                    }`}
                    aria-label={it.done ? "Markera som ej klar" : "Markera som klar"}
                  >
                    {it.done ? <Check className="h-6 w-6" strokeWidth={3} /> : it.emoji}
                  </button>
                  <span
                    className={`flex-1 text-sm font-semibold ${
                      it.done ? "text-foreground/60 line-through" : ""
                    }`}
                  >
                    {it.title}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(it.id);
                      setEditTitle(it.title);
                      setEditEmoji(it.emoji);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-pink-soft"
                    aria-label="Ändra"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Ta bort "${it.title}"?`)) delM.mutate(it.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                    aria-label="Ta bort"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="pt-2 text-center text-sm text-muted-foreground">
        Bocka av dina sommaräventyr ett efter ett 🌈
      </p>
    </div>
  );
}
