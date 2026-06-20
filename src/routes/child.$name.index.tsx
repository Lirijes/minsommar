import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCompletion,
  fetchActivities,
  fetchCategories,
  fetchChildByName,
  fetchChildPoints,
  fetchCompletionsForDate,
  fetchFamilySettings,
  randomCheer,
  removeCompletion,
  todayDate,
  toggleFavorite,
  SUBCATEGORIES,
  type Activity,
  type Category,
  type Completion,
} from "@/lib/db";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  History,
  Search,
  Star,
  X,
} from "lucide-react";
import { ChildTabs } from "@/components/ChildTabs";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";

export const Route = createFileRoute("/child/$name/")({
  component: ChildDayPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p>Barnet hittades inte.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Tillbaka
      </Link>
    </div>
  ),
});

const CATEGORY_COLORS: Record<string, string> = {
  rorelse: "mint",
  hemmafix: "peach",
  kreativitet: "purple",
};

const GOAL_ORDER = ["rorelse", "hemmafix", "kreativitet"];

function formatToday() {
  return new Date().toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function fireConfetti() {
  const end = Date.now() + 800;
  const colors = ["#f9a8d4", "#c4b5fd", "#a7f3d0", "#fed7aa"];
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

function ChildDayPage() {
  const { name } = Route.useParams();
  const qc = useQueryClient();
  const date = todayDate();
  const [search, setSearch] = useState("");

  const childQ = useQuery({ queryKey: ["child", name], queryFn: () => fetchChildByName(name) });
  const child = childQ.data;

  if (childQ.isFetched && !child) throw notFound();

  const catsQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const actsQ = useQuery({ queryKey: ["activities"], queryFn: fetchActivities });
  const compsQ = useQuery({
    queryKey: ["completions", child?.id, date],
    queryFn: () => fetchCompletionsForDate(child!.id, date),
    enabled: !!child,
  });
  const settingsQ = useQuery({ queryKey: ["family-settings"], queryFn: fetchFamilySettings });
  const pointsEnabled = settingsQ.data?.points_enabled ?? false;
  const pointsQ = useQuery({
    queryKey: ["child-points", child?.id],
    queryFn: () => fetchChildPoints(child!.id),
    enabled: !!child && pointsEnabled,
  });

  const add = useMutation({
    mutationFn: (activityId: string) => addCompletion(child!.id, activityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["completions", child!.id] });
      qc.invalidateQueries({ queryKey: ["child-points", child!.id] });
      toast.success(randomCheer(child!.name));
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeCompletion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["completions", child!.id] });
      qc.invalidateQueries({ queryKey: ["child-points", child!.id] });
    },
  });
  const favorite = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => toggleFavorite(id, value),
    // Optimistic: flip the star instantly, roll back if the save fails.
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: ["activities"] });
      const prev = qc.getQueryData<Activity[]>(["activities"]);
      qc.setQueryData<Activity[]>(["activities"], (old) =>
        old?.map((a) => (a.id === id ? { ...a, is_favorite: value } : a)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["activities"], ctx.prev);
      toast.error("Kunde inte spara favoriten");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });

  const completionByActivity = useMemo(() => {
    const map = new Map<string, Completion>();
    compsQ.data?.forEach((c) => map.set(c.activity_id, c));
    return map;
  }, [compsQ.data]);

  const activitiesByCat = useMemo(() => {
    const map = new Map<string, Activity[]>();
    actsQ.data?.forEach((a) => {
      if (!map.has(a.category_id)) map.set(a.category_id, []);
      map.get(a.category_id)!.push(a);
    });
    return map;
  }, [actsQ.data]);

  const countByCat = useMemo(() => {
    const map = new Map<string, number>();
    compsQ.data?.forEach((c) => {
      const act = actsQ.data?.find((a) => a.id === c.activity_id);
      if (act) map.set(act.category_id, (map.get(act.category_id) ?? 0) + 1);
    });
    return map;
  }, [compsQ.data, actsQ.data]);

  const totalToday = compsQ.data?.length ?? 0;

  const orderedCats = useMemo(() => {
    if (!catsQ.data) return [] as Category[];
    return [...catsQ.data].sort((a, b) => GOAL_ORDER.indexOf(a.slug) - GOAL_ORDER.indexOf(b.slug));
  }, [catsQ.data]);

  const goalsDone = orderedCats.filter((c) => (countByCat.get(c.id) ?? 0) > 0).length;
  const allGoalsReached = orderedCats.length === 3 && goalsDone === 3;

  // Trigger confetti once when all 3 goals are reached
  const celebratedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!child || !allGoalsReached) return;
    const key = `${child.id}-${date}`;
    if (celebratedKey.current === key) return;
    celebratedKey.current = key;
    fireConfetti();
  }, [allGoalsReached, child, date]);

  const q = search.trim().toLowerCase();
  const matches = (a: Activity) => q === "" || a.name.toLowerCase().includes(q);

  const onToggle = (act: Activity) => {
    const existing = completionByActivity.get(act.id);
    if (existing) remove.mutate(existing.id);
    else add.mutate(act.id);
  };
  const onToggleFav = (act: Activity) => favorite.mutate({ id: act.id, value: !act.is_favorite });

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-24 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-foreground shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex gap-2">
          <Link
            to="/child/$name/calendar"
            params={{ name }}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-foreground shadow-sm"
            aria-label="Kalender"
          >
            <CalendarDays className="h-5 w-5" />
          </Link>
          <Link
            to="/child/$name/history"
            params={{ name }}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-foreground shadow-sm"
            aria-label="Historik"
          >
            <History className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <ChildTabs name={name} active="activities" />

      <header className="card-soft mb-5 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {formatToday()}
        </p>
        <h1 className="mt-1 text-3xl">Hej {child?.name ?? "..."}! 💖</h1>
        <div className="mt-4 flex items-center justify-center gap-2">
          <div className="rounded-2xl bg-pink-soft px-4 py-2">
            <div className="text-2xl font-bold text-foreground">{totalToday}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Aktiviteter idag
            </div>
          </div>
          <div className="rounded-2xl bg-purple-soft px-4 py-2">
            <div className="text-2xl font-bold text-foreground">{goalsDone}/3</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dagens mål
            </div>
          </div>
          {pointsEnabled && (
            <div className="rounded-2xl bg-sun-soft px-4 py-2">
              <div className="text-2xl font-bold text-foreground">{pointsQ.data ?? 0}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Poäng
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Daily goals */}
      <section className="mb-6">
        <h2 className="mb-3 px-1 text-lg">Dagens mål</h2>
        <div className="space-y-2">
          {orderedCats.map((cat) => {
            const done = (countByCat.get(cat.id) ?? 0) > 0;
            return (
              <div
                key={cat.id}
                className={`flex items-center gap-3 rounded-2xl p-3 shadow-sm transition ${
                  done ? "bg-mint-soft ring-2 ring-mint" : "bg-white"
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full ${
                    done ? "bg-mint text-foreground" : "bg-pink text-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-5 w-5" strokeWidth={3} />
                  ) : (
                    <X className="h-5 w-5" strokeWidth={3} />
                  )}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{cat.name}</div>
                  <div className="text-xs text-muted-foreground">{done ? "Klar" : "Ej klar"}</div>
                </div>
                <span
                  className={`h-3 w-3 rounded-full ${done ? "bg-mint" : "bg-pink"}`}
                  aria-hidden
                />
              </div>
            );
          })}
        </div>
        {allGoalsReached && (
          <div className="mt-3 animate-fade-in rounded-2xl bg-gradient-to-br from-pink-soft via-purple-soft to-mint-soft p-4 text-center shadow-sm">
            <p className="text-base font-bold">Fantastiskt jobbat! Du har klarat dagens mål! 🎉</p>
          </div>
        )}
      </section>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök aktivitet..."
          className="w-full rounded-2xl bg-white py-3 pl-11 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-pink-soft"
            aria-label="Rensa sökning"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-6">
        {orderedCats.map((cat) => {
          const acts = (activitiesByCat.get(cat.id) ?? []).filter(matches);
          const color = CATEGORY_COLORS[cat.slug] ?? "pink";
          if (q !== "" && acts.length === 0) return null;
          if (cat.slug === "kreativitet") {
            return (
              <SubcategorizedCategory
                key={cat.id}
                category={cat}
                activities={acts}
                color={color}
                completionByActivity={completionByActivity}
                onToggle={onToggle}
                onToggleFav={onToggleFav}
                disabled={!child}
                searching={q !== ""}
                pointsEnabled={pointsEnabled}
              />
            );
          }
          return (
            <FlatCategory
              key={cat.id}
              category={cat}
              activities={acts}
              color={color}
              completionByActivity={completionByActivity}
              onToggle={onToggle}
              onToggleFav={onToggleFav}
              disabled={!child}
              pointsEnabled={pointsEnabled}
            />
          );
        })}
      </div>
    </main>
  );
}

function ActivityCard({
  act,
  done,
  color,
  onToggle,
  onToggleFav,
  disabled,
  pointsEnabled,
}: {
  act: Activity;
  done: Completion | undefined;
  color: string;
  onToggle: (a: Activity) => void;
  onToggleFav: (a: Activity) => void;
  disabled?: boolean;
  pointsEnabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => onToggle(act)}
      className={`group relative flex min-h-[110px] flex-col items-start justify-between rounded-3xl p-4 text-left shadow-sm transition active:scale-95 ${
        done ? `bg-${color} text-foreground ring-2 ring-${color}` : "bg-white hover:bg-white/90"
      }`}
    >
      <span className="text-3xl">{act.emoji}</span>
      <span className="pr-6 text-sm font-semibold leading-tight">{act.name}</span>
      {pointsEnabled && act.points != null && (
        <span className="mt-1 rounded-full bg-sun-soft px-2 py-0.5 text-[10px] font-bold text-foreground">
          +{act.points} p
        </span>
      )}

      {/* Favorite toggle */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav(act);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onToggleFav(act);
          }
        }}
        className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/70 shadow-sm transition hover:scale-110"
        aria-label={act.is_favorite ? "Ta bort favorit" : "Spara som favorit"}
      >
        <Star
          className={`h-4 w-4 ${act.is_favorite ? "fill-gold text-gold" : "text-muted-foreground"}`}
          strokeWidth={2.5}
        />
      </span>

      {done && (
        <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white shadow">
          <Check className="h-4 w-4 text-foreground" strokeWidth={3} />
        </span>
      )}
      {done && (
        <span className="absolute bottom-2 right-3 text-[10px] font-semibold text-foreground/70">
          {formatTime(done.completed_at)}
        </span>
      )}
    </button>
  );
}

function FlatCategory({
  category,
  activities,
  color,
  completionByActivity,
  onToggle,
  onToggleFav,
  disabled,
  pointsEnabled,
}: {
  category: Category;
  activities: Activity[];
  color: string;
  completionByActivity: Map<string, Completion>;
  onToggle: (a: Activity) => void;
  onToggleFav: (a: Activity) => void;
  disabled?: boolean;
  pointsEnabled?: boolean;
}) {
  const doneCount = activities.filter((a) => completionByActivity.has(a.id)).length;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-lg">{category.name}</h2>
        <span
          className={`rounded-full bg-${color}-soft px-3 py-1 text-xs font-bold text-foreground`}
        >
          {doneCount}/{activities.length} klart
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {activities.map((act) => (
          <ActivityCard
            key={act.id}
            act={act}
            done={completionByActivity.get(act.id)}
            color={color}
            onToggle={onToggle}
            onToggleFav={onToggleFav}
            disabled={disabled}
            pointsEnabled={pointsEnabled}
          />
        ))}
      </div>
    </section>
  );
}

function SubcategorizedCategory({
  category,
  activities,
  color,
  completionByActivity,
  onToggle,
  onToggleFav,
  disabled,
  searching,
  pointsEnabled,
}: {
  category: Category;
  activities: Activity[];
  color: string;
  completionByActivity: Map<string, Completion>;
  onToggle: (a: Activity) => void;
  onToggleFav: (a: Activity) => void;
  disabled?: boolean;
  searching: boolean;
  pointsEnabled?: boolean;
}) {
  // Collapsed by default; track which subcategories the user opened.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const totalDone = activities.filter((a) => completionByActivity.has(a.id)).length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-lg">{category.name}</h2>
        <span
          className={`rounded-full bg-${color}-soft px-3 py-1 text-xs font-bold text-foreground`}
        >
          {totalDone}/{activities.length} klart
        </span>
      </div>

      <div className="space-y-3">
        {SUBCATEGORIES.map((sub) => {
          const subActs = activities.filter((a) => a.subcategory === sub.slug);
          if (subActs.length === 0) return null;
          const doneCount = subActs.filter((a) => completionByActivity.has(a.id)).length;
          const hasDone = doneCount > 0;
          // Auto-expand while searching so matches are visible.
          const isOpen = searching || !!open[sub.slug];

          return (
            <div
              key={sub.slug}
              className={`overflow-hidden rounded-3xl shadow-sm transition ${
                hasDone ? "bg-mint-soft ring-2 ring-mint" : "bg-white"
              }`}
            >
              <button
                onClick={() => setOpen((s) => ({ ...s, [sub.slug]: !s[sub.slug] }))}
                disabled={searching}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span className="text-2xl">{sub.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold">{sub.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {subActs.length} aktiviteter • {doneCount} klara
                  </div>
                </div>
                {hasDone && (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-mint text-foreground">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                )}
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="grid grid-cols-2 gap-3 p-4 pt-0">
                  {subActs.map((act) => (
                    <ActivityCard
                      key={act.id}
                      act={act}
                      done={completionByActivity.get(act.id)}
                      color={color}
                      onToggle={onToggle}
                      onToggleFav={onToggleFav}
                      disabled={disabled}
                      pointsEnabled={pointsEnabled}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
