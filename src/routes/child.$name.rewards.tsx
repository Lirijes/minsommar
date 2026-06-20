import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchChildByName, fetchChildPoints, fetchFamilySettings, fetchRewards } from "@/lib/db";
import { ArrowLeft, Check, Gift } from "lucide-react";
import { ChildTabs } from "@/components/ChildTabs";
import { useMemo } from "react";

// Child-facing rewards view: current balance + the family's rewards, marking
// which are already affordable and how many points are missing for the rest.
// Redemption is intentionally not available yet (a later version).
export const Route = createFileRoute("/child/$name/rewards")({
  component: RewardsPage,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p>Barnet hittades inte.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Tillbaka
      </Link>
    </div>
  ),
});

function RewardsPage() {
  const { name } = Route.useParams();

  const childQ = useQuery({ queryKey: ["child", name], queryFn: () => fetchChildByName(name) });
  const child = childQ.data;
  if (childQ.isFetched && !child) throw notFound();

  const settingsQ = useQuery({ queryKey: ["family-settings"], queryFn: fetchFamilySettings });
  const pointsEnabled = settingsQ.data?.points_enabled ?? false;

  const rewardsQ = useQuery({
    queryKey: ["rewards"],
    queryFn: fetchRewards,
    enabled: pointsEnabled,
  });
  const pointsQ = useQuery({
    queryKey: ["child-points", child?.id],
    queryFn: () => fetchChildPoints(child!.id),
    enabled: !!child && pointsEnabled,
  });

  const balance = pointsQ.data ?? 0;
  const rewards = useMemo(
    () => [...(rewardsQ.data ?? [])].sort((a, b) => a.points_required - b.points_required),
    [rewardsQ.data],
  );

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

      <ChildTabs name={name} active="rewards" />

      {/* Balance */}
      <header className="card-soft mb-5 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dina poäng
        </p>
        <div className="mt-1 text-4xl font-bold text-foreground">{balance} p</div>
      </header>

      <h1 className="mb-3 px-1 text-lg">🎁 Belöningar</h1>

      {rewardsQ.isLoading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-3xl bg-white/60" />
          <div className="h-20 animate-pulse rounded-3xl bg-white/60" />
        </div>
      ) : rewards.length === 0 ? (
        <div className="rounded-3xl bg-gradient-to-br from-sun-soft via-peach-soft to-sand-soft p-8 text-center shadow-sm">
          <div className="text-6xl">🎁</div>
          <p className="mt-4 text-sm font-semibold text-foreground/80">
            Inga belöningar än. Be en förälder lägga till några!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map((r) => {
            const affordable = balance >= r.points_required;
            const missing = Math.max(0, r.points_required - balance);
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 rounded-3xl p-4 shadow-sm transition ${
                  affordable ? "bg-mint-soft ring-2 ring-mint" : "bg-white"
                }`}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sun-soft to-mint-soft text-2xl shadow-inner">
                  <Gift className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{r.name}</div>
                  {r.description && (
                    <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                  )}
                  <div className="mt-0.5 text-xs font-semibold text-foreground/70">
                    {r.points_required} poäng
                  </div>
                </div>
                {affordable ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-mint px-3 py-1 text-xs font-bold text-foreground">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} /> Kan lösas in
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-peach-soft px-3 py-1 text-xs font-bold text-foreground">
                    {missing} p kvar
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
