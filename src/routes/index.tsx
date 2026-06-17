import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchActivities,
  fetchAllCompletions,
  fetchChildren,
  todayDate,
  type Activity,
  type Completion,
} from "@/lib/db";
import { getCurrentFamilyId } from "@/lib/family";
import { Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// Child cards keep their original personal gradients (pinned to fixed colours
// so the summer re-theme of --pink/--purple does not affect them).
const COLOR_MAP: Record<string, { bg: string; ring: string; emoji: string }> = {
  pink: {
    bg: "from-[oklch(0.82_0.12_350)]/60 to-[oklch(0.86_0.09_50)]/50",
    ring: "ring-[oklch(0.82_0.12_350)]",
    emoji: "🌸",
  },
  purple: {
    bg: "from-[oklch(0.78_0.1_305)]/60 to-[oklch(0.85_0.09_170)]/50",
    ring: "ring-[oklch(0.78_0.1_305)]",
    emoji: "🦄",
  },
};

function HomePage() {
  const navigate = useNavigate();
  // Onboarding gate: no family set up yet → go to onboarding.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (getCurrentFamilyId()) setReady(true);
    else navigate({ to: "/onboarding", replace: true });
  }, [navigate]);

  const { data: children, isLoading } = useQuery({
    queryKey: ["children"],
    queryFn: fetchChildren,
    enabled: ready,
  });
  const { data: activities } = useQuery({
    queryKey: ["activities"],
    queryFn: fetchActivities,
    enabled: ready,
  });

  if (!ready) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/70" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-10 pt-10">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-xs font-semibold text-purple shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          Sommarlovsaktiviteter
        </div>
        <h1 className="mt-4 text-4xl">Hej! Vem är du?</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tryck på ditt namn för att börja</p>
      </header>

      <div className="space-y-5">
        {isLoading && (
          <>
            <div className="h-56 animate-pulse rounded-3xl bg-white/60" />
            <div className="h-56 animate-pulse rounded-3xl bg-white/60" />
          </>
        )}
        {children?.map((child) => {
          const style = COLOR_MAP[child.color] ?? COLOR_MAP.pink;
          return (
            <Link
              key={child.id}
              to="/child/$name"
              params={{ name: child.name.toLowerCase() }}
              className={`group block rounded-3xl bg-gradient-to-br ${style.bg} p-1 shadow-lg shadow-pink/20 transition hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div className="rounded-[1.4rem] bg-white/85 p-5 backdrop-blur">
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white to-white/40 text-4xl shadow-inner">
                    {child.emoji || style.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-2xl font-bold text-foreground">{child.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Dagens aktiviteter</div>
                  </div>
                  <div className="text-2xl text-foreground/40 transition group-hover:translate-x-1">
                    →
                  </div>
                </div>
                <ChildStats childId={child.id} activities={activities ?? []} />
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        to="/parent"
        className="mt-10 flex items-center justify-center gap-2 rounded-2xl border border-border bg-white/60 px-5 py-3 text-sm font-semibold text-muted-foreground shadow-sm transition hover:bg-white"
      >
        <Users className="h-4 w-4" />
        Föräldravy
      </Link>
    </main>
  );
}

function ChildStats({ childId, activities }: { childId: string; activities: Activity[] }) {
  const { data: completions } = useQuery({
    queryKey: ["completions-all", childId],
    queryFn: () => fetchAllCompletions(childId),
  });

  const stats = computeStats(completions ?? [], activities);

  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <Stat label="Dagens mål" value={`${stats.goalsToday}/3`} bg="bg-purple-soft" />
      <Stat label="Idag" value={String(stats.today)} bg="bg-pink-soft" />
      <Stat label="Senaste 7 dagarna" value={String(stats.last7)} bg="bg-mint-soft" />
      <Stat label="Aktivaste veckan" value={String(stats.bestWeek)} bg="bg-peach-soft" />
    </div>
  );
}

function Stat({ label, value, bg }: { label: string; value: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} px-3 py-2`}>
      <div className="text-lg font-bold leading-tight text-foreground">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function computeStats(completions: Completion[], activities: Activity[]) {
  const today = todayDate();
  const activityCat = new Map(activities.map((a) => [a.id, a.category_id]));

  const todayComps = completions.filter((c) => c.completed_date === today);
  const goalCats = new Set<string>();
  todayComps.forEach((c) => {
    const cat = activityCat.get(c.activity_id);
    if (cat) goalCats.add(cat);
  });

  // Last 7 days (inclusive of today)
  const now = new Date();
  const start7 = new Date(now);
  start7.setDate(now.getDate() - 6);
  const start7Str = toDateStr(start7);
  const last7 = completions.filter((c) => c.completed_date >= start7Str).length;

  // Best ISO-week count
  const weekCounts = new Map<string, number>();
  completions.forEach((c) => {
    const key = isoWeekKey(c.completed_date);
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  });
  const bestWeek = weekCounts.size ? Math.max(...weekCounts.values()) : 0;

  return {
    goalsToday: goalCats.size,
    today: todayComps.length,
    last7,
    bestWeek,
  };
}

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeekKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
