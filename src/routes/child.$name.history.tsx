import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchActivities,
  fetchAllCompletions,
  fetchBucketItems,
  fetchCategories,
  fetchChildByName,
  type Activity,
  type Category,
  type Completion,
} from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/child/$name/history")({
  component: HistoryPage,
});

function isoWeekKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function HistoryPage() {
  const { name } = Route.useParams();
  const childQ = useQuery({ queryKey: ["child", name], queryFn: () => fetchChildByName(name) });
  const compsQ = useQuery({
    queryKey: ["all-completions", childQ.data?.id],
    queryFn: () => fetchAllCompletions(childQ.data!.id),
    enabled: !!childQ.data,
  });
  const actsQ = useQuery({ queryKey: ["activities"], queryFn: fetchActivities });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const bucketQ = useQuery({
    queryKey: ["bucket", childQ.data?.id],
    queryFn: () => fetchBucketItems(childQ.data!.id),
    enabled: !!childQ.data,
  });

  const stats = useMemo(
    () =>
      computeStats(
        compsQ.data ?? [],
        actsQ.data ?? [],
        catsQ.data ?? [],
        bucketQ.data?.length ?? 0,
        bucketQ.data?.filter((b) => b.done).length ?? 0,
      ),
    [compsQ.data, actsQ.data, catsQ.data, bucketQ.data],
  );

  const totalCats = catsQ.data?.length ?? 3;

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-10 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/child/$name"
          params={{ name }}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/80 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl">Min historik</h1>
      </div>

      <p className="mb-5 px-1 text-sm text-muted-foreground">
        Titta vad mycket roligt du gjort i sommar, {childQ.data?.name}! 💖
      </p>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3">
        <BigStat emoji="🌟" value={stats.total} label="Aktiviteter totalt" bg="bg-pink-soft" />
        <BigStat emoji="🔥" value={stats.longestStreak} label="Dagar i rad" bg="bg-peach-soft" />
        <BigStat
          emoji="🏆"
          value={`${stats.daysAllGoals}`}
          label="Dagar med alla 3 mål"
          bg="bg-mint-soft"
        />
        <BigStat emoji="📅" value={stats.bestWeek} label="Mest aktiva veckan" bg="bg-purple-soft" />
      </div>

      {/* Favorite category + distribution */}
      {stats.catBars.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 px-1 text-lg">Dina kategorier</h2>
          <div className="card-soft space-y-3 p-4">
            {stats.favoriteCategory && (
              <p className="text-sm">
                Favoritkategori:{" "}
                <span className="font-bold">{stats.favoriteCategory}</span> 🌿
              </p>
            )}
            {stats.catBars.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.count} st</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-mint to-turquoise transition-all"
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Most done activity */}
      {stats.topActivity && (
        <section className="mt-6">
          <h2 className="mb-3 px-1 text-lg">Mest gjorda aktivitet</h2>
          <div className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-pink-soft text-3xl">
              {stats.topActivity.emoji}
            </div>
            <div className="flex-1">
              <div className="text-base font-bold">{stats.topActivity.name}</div>
              <div className="text-xs text-muted-foreground">
                gjord {stats.topActivity.count} gånger
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Goal days progress */}
      <section className="mt-6">
        <h2 className="mb-3 px-1 text-lg">Dagar med alla mål</h2>
        <div className="card-soft p-4">
          <div className="mb-1 flex justify-between text-xs font-semibold">
            <span>{stats.daysAllGoals} av {stats.activeDays} aktiva dagar</span>
            <span className="text-muted-foreground">{stats.goalDayPct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint to-peach transition-all"
              style={{ width: `${stats.goalDayPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Alla {totalCats} kategorier klara samma dag.
          </p>
        </div>
      </section>

      {/* Bucket list */}
      {stats.bucketTotal > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 px-1 text-lg">🏖️ Sommarbucketlist</h2>
          <div className="card-soft p-4">
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span>{stats.bucketDone} av {stats.bucketTotal} mål klara</span>
              <span className="text-muted-foreground">{stats.bucketPct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-turquoise to-sky transition-all"
                style={{ width: `${stats.bucketPct}%` }}
              />
            </div>
          </div>
        </section>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Du gör det så bra, {childQ.data?.name}! 🌈
      </p>
    </main>
  );
}

function BigStat({
  emoji,
  value,
  label,
  bg,
}: {
  emoji: string;
  value: number | string;
  label: string;
  bg: string;
}) {
  return (
    <div className={`rounded-3xl ${bg} p-4 shadow-sm`}>
      <div className="text-2xl">{emoji}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function computeStats(
  completions: Completion[],
  activities: Activity[],
  categories: Category[],
  bucketTotal: number,
  bucketDone: number,
) {
  const total = completions.length;
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const totalCats = categories.length || 3;

  // Per-category counts
  const catCount = new Map<string, number>();
  // Per-activity counts
  const actCount = new Map<string, number>();
  // Per-date set of categories
  const catsByDate = new Map<string, Set<string>>();
  const dateSet = new Set<string>();

  completions.forEach((c) => {
    dateSet.add(c.completed_date);
    actCount.set(c.activity_id, (actCount.get(c.activity_id) ?? 0) + 1);
    const act = activityById.get(c.activity_id);
    if (act) {
      catCount.set(act.category_id, (catCount.get(act.category_id) ?? 0) + 1);
      if (!catsByDate.has(c.completed_date)) catsByDate.set(c.completed_date, new Set());
      catsByDate.get(c.completed_date)!.add(act.category_id);
    }
  });

  // Favorite category
  let favoriteCategory: string | null = null;
  let favMax = 0;
  const catBars = categories
    .map((cat) => ({ name: cat.name, count: catCount.get(cat.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  catBars.forEach((c) => {
    if (c.count > favMax) {
      favMax = c.count;
      favoriteCategory = c.name;
    }
  });
  const maxCatCount = Math.max(1, ...catBars.map((c) => c.count));
  const catBarsWithPct = catBars
    .filter((c) => c.count > 0)
    .map((c) => ({ ...c, pct: Math.round((c.count / maxCatCount) * 100) }));

  // Most done activity
  let topActivity: { name: string; emoji: string; count: number } | null = null;
  let topMax = 0;
  actCount.forEach((count, id) => {
    if (count > topMax) {
      const act = activityById.get(id);
      if (act) {
        topMax = count;
        topActivity = { name: act.name, emoji: act.emoji, count };
      }
    }
  });

  // Days with all goals
  let daysAllGoals = 0;
  catsByDate.forEach((set) => {
    if (set.size >= totalCats) daysAllGoals++;
  });
  const activeDays = dateSet.size;
  const goalDayPct = activeDays === 0 ? 0 : Math.round((daysAllGoals / activeDays) * 100);

  // Longest streak of consecutive days
  const sortedDates = [...dateSet].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  sortedDates.forEach((ds) => {
    const d = new Date(ds + "T00:00:00");
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = d;
  });

  // Best ISO-week count
  const weekCounts = new Map<string, number>();
  completions.forEach((c) => {
    const key = isoWeekKey(c.completed_date);
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  });
  const bestWeek = weekCounts.size ? Math.max(...weekCounts.values()) : 0;

  return {
    total,
    longestStreak,
    daysAllGoals,
    activeDays,
    goalDayPct,
    bestWeek,
    favoriteCategory: favoriteCategory as string | null,
    catBars: catBarsWithPct,
    topActivity: topActivity as { name: string; emoji: string; count: number } | null,
    bucketTotal,
    bucketDone,
    bucketPct: bucketTotal === 0 ? 0 : Math.round((bucketDone / bucketTotal) * 100),
  };
}
