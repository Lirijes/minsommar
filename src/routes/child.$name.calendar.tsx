import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchActivities,
  fetchAllCompletions,
  fetchBucketItems,
  fetchCategories,
  fetchChildByName,
} from "@/lib/db";
import { ArrowLeft, Check } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/child/$name/calendar")({
  component: CalendarPage,
});

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Local (sv) date string from an ISO timestamp.
function isoToLocalDate(iso: string) {
  return ymd(new Date(iso));
}

function CalendarPage() {
  const { name } = Route.useParams();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(() => ymd(new Date()));

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

  const totalCategories = catsQ.data?.length ?? 3;

  const activityCat = useMemo(() => {
    const map = new Map<string, string>();
    actsQ.data?.forEach((a) => map.set(a.id, a.category_id));
    return map;
  }, [actsQ.data]);

  // date -> set of distinct category ids cleared that day
  const catsByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    compsQ.data?.forEach((c) => {
      const cat = activityCat.get(c.activity_id);
      if (!cat) return;
      if (!map.has(c.completed_date)) map.set(c.completed_date, new Set());
      map.get(c.completed_date)!.add(cat);
    });
    return map;
  }, [compsQ.data, activityCat]);

  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    compsQ.data?.forEach((c) => map.set(c.completed_date, (map.get(c.completed_date) ?? 0) + 1));
    return map;
  }, [compsQ.data]);

  // date -> bucket goals completed that day
  const bucketByDate = useMemo(() => {
    const map = new Map<string, { title: string; emoji: string }[]>();
    bucketQ.data?.forEach((b) => {
      if (!b.done || !b.done_at) return;
      const d = isoToLocalDate(b.done_at);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push({ title: b.title, emoji: b.emoji });
    });
    return map;
  }, [bucketQ.data]);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const offset = (first.getDay() + 6) % 7; // Monday = 0
    const arr: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++)
      arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return arr;
  }, [cursor]);

  const selectedComps = compsQ.data?.filter((c) => c.completed_date === selected) ?? [];
  const selectedCats = catsByDate.get(selected) ?? new Set<string>();
  const selectedBucket = bucketByDate.get(selected) ?? [];
  const allGoals = selectedCats.size >= totalCategories && totalCategories > 0;

  const orderedCats = catsQ.data ?? [];

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
        <h1 className="text-2xl">Kalender</h1>
      </div>

      <p className="mb-4 px-1 text-sm text-muted-foreground">Din dagbok över sommarlovet 📖</p>

      <div className="card-soft p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="grid h-9 w-9 place-items-center rounded-full bg-sky-soft text-foreground"
          >
            ‹
          </button>
          <div className="font-bold capitalize">
            {cursor.toLocaleDateString("sv-SE", { month: "long", year: "numeric" })}
          </div>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="grid h-9 w-9 place-items-center rounded-full bg-sky-soft text-foreground"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
          {["M", "T", "O", "T", "F", "L", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = ymd(d);
            const nCats = catsByDate.get(key)?.size ?? 0;
            const hasBucket = (bucketByDate.get(key)?.length ?? 0) > 0;
            const isSel = key === selected;
            const isToday = key === ymd(new Date());
            // Color coding: green = all goals, yellow = 1-2, white = none
            const tone =
              nCats >= totalCategories && totalCategories > 0
                ? "bg-mint text-foreground"
                : nCats > 0
                  ? "bg-peach-soft text-foreground"
                  : "bg-white/60 text-foreground/60";
            return (
              <button
                key={i}
                onClick={() => setSelected(key)}
                className={`relative aspect-square rounded-2xl text-sm font-semibold transition ${
                  isSel ? "bg-primary text-primary-foreground shadow" : tone
                } ${isToday && !isSel ? "ring-2 ring-pink" : ""}`}
              >
                {d.getDate()}
                {hasBucket && (
                  <span className="absolute left-1 top-1 text-[9px]" aria-hidden>
                    🏖️
                  </span>
                )}
                {nCats > 0 && !isSel && (
                  <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                    {Array.from({ length: Math.min(nCats, 3) }).map((_, k) => (
                      <span key={k} className="h-1 w-1 rounded-full bg-foreground/50" />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-3 text-[10px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-mint" /> Alla 3 mål
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-peach-soft ring-1 ring-peach" /> 1–2 mål
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-white ring-1 ring-border" /> Inga
          </span>
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-lg">
            {new Date(selected).toLocaleDateString("sv-SE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              allGoals ? "bg-mint text-foreground" : "bg-sky-soft text-foreground"
            }`}
          >
            {selectedCats.size}/{totalCategories} mål
          </span>
        </div>

        {/* Category goal chips */}
        {orderedCats.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {orderedCats.map((cat) => {
              const cleared = selectedCats.has(cat.id);
              return (
                <span
                  key={cat.id}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    cleared ? "bg-mint-soft text-foreground" : "bg-white/70 text-muted-foreground"
                  }`}
                >
                  {cleared && <Check className="h-3 w-3" strokeWidth={3} />}
                  {cat.name}
                </span>
              );
            })}
          </div>
        )}

        {allGoals && (
          <div className="mb-3 rounded-2xl bg-gradient-to-br from-sky-soft via-turquoise-soft to-mint-soft p-3 text-center text-sm font-bold shadow-sm">
            Alla tre mål klara den här dagen! 🎉
          </div>
        )}

        {/* Bucket goals completed that day */}
        {selectedBucket.length > 0 && (
          <div className="mb-3 space-y-2">
            {selectedBucket.map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-mint-soft to-peach-soft p-3 shadow-sm"
              >
                <span className="text-2xl">{b.emoji}</span>
                <span className="flex-1 text-sm font-semibold">{b.title}</span>
                <span className="text-xs font-semibold text-foreground/70">🏖️ sommarmål</span>
              </div>
            ))}
          </div>
        )}

        {selectedComps.length === 0 && selectedBucket.length === 0 ? (
          <p className="card-soft p-5 text-center text-sm text-muted-foreground">
            Inga aktiviteter den här dagen.
          </p>
        ) : (
          <div className="space-y-2">
            {selectedComps.map((c) => {
              const act = actsQ.data?.find((a) => a.id === c.activity_id);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
                >
                  <span className="text-2xl">{act?.emoji ?? "✨"}</span>
                  <span className="flex-1 text-sm font-semibold">{act?.name ?? "Aktivitet"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.completed_at).toLocaleTimeString("sv-SE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
