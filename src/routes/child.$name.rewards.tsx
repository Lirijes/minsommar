import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchChildByName,
  fetchChildPointsSummary,
  fetchChildRedemptions,
  fetchFamilySettings,
  fetchRewards,
  requestRedemption,
  type RewardRedemption,
} from "@/lib/db";
import { ArrowLeft, Check, Clock, Gift } from "lucide-react";
import { ChildTabs } from "@/components/ChildTabs";
import { toast } from "sonner";
import { useMemo } from "react";

// Child-facing rewards view: total earned (statistics) + available balance, the
// family's rewards with a "Lös in" action, plus the child's waiting requests and
// a history of redeemed rewards. Spending a reward creates a request a parent
// approves; points only leave once a parent approves.
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
}

function RewardsPage() {
  const { name } = Route.useParams();
  const qc = useQueryClient();

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
  const summaryQ = useQuery({
    queryKey: ["child-points-summary", child?.id],
    queryFn: () => fetchChildPointsSummary(child!.id),
    enabled: !!child && pointsEnabled,
  });
  const redemptionsQ = useQuery({
    queryKey: ["child-redemptions", child?.id],
    queryFn: () => fetchChildRedemptions(child!.id),
    enabled: !!child && pointsEnabled,
  });

  const summary = summaryQ.data ?? { earned: 0, available: 0, pending: 0 };
  const available = summary.available;
  // What a new request can draw on: available minus what pending requests reserve.
  const free = summary.available - summary.pending;

  const redemptions = useMemo(() => redemptionsQ.data ?? [], [redemptionsQ.data]);
  const pendingByReward = useMemo(() => {
    const s = new Set<string>();
    redemptions.forEach((r) => {
      if (r.status === "pending" && r.reward_id) s.add(r.reward_id);
    });
    return s;
  }, [redemptions]);
  const approved = useMemo(() => redemptions.filter((r) => r.status === "approved"), [redemptions]);

  const rewards = useMemo(
    () => [...(rewardsQ.data ?? [])].sort((a, b) => a.points_required - b.points_required),
    [rewardsQ.data],
  );

  const redeem = useMutation({
    mutationFn: (rewardId: string) => requestRedemption(child!.id, rewardId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["child-redemptions", child!.id] });
      qc.invalidateQueries({ queryKey: ["child-points-summary", child!.id] });
      toast.success("Skickat! En förälder behöver godkänna 🌟");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kunde inte skicka önskemålet"),
  });

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

      {/* Balance: available is the spendable number; total earned is the stat. */}
      <header className="card-soft mb-5 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tillgängliga poäng
        </p>
        <div className="mt-1 text-4xl font-bold text-foreground">{available} p</div>
        <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="rounded-full bg-sun-soft px-3 py-1 text-foreground">
            Totalt intjänade: {summary.earned} p
          </span>
          {summary.pending > 0 && (
            <span className="rounded-full bg-peach-soft px-3 py-1 text-foreground">
              {summary.pending} p reserverat
            </span>
          )}
        </div>
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
            const waiting = pendingByReward.has(r.id);
            const affordable = free >= r.points_required;
            const missing = Math.max(0, r.points_required - free);
            const highlight = waiting || affordable;
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 rounded-3xl p-4 shadow-sm transition ${
                  highlight ? "bg-mint-soft ring-2 ring-mint" : "bg-white"
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
                {waiting ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-peach-soft px-3 py-1.5 text-xs font-bold text-foreground">
                    <Clock className="h-3.5 w-3.5" /> Väntar
                  </span>
                ) : affordable ? (
                  <button
                    onClick={() => redeem.mutate(r.id)}
                    disabled={redeem.isPending}
                    className="shrink-0 rounded-full bg-mint px-4 py-1.5 text-xs font-bold text-foreground shadow-sm transition active:scale-95 disabled:opacity-50"
                  >
                    Lös in
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-peach-soft px-3 py-1.5 text-xs font-bold text-foreground">
                    {missing} p kvar
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Redeemed history */}
      {approved.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 px-1 text-lg">✅ Inlösta belöningar</h2>
          <div className="space-y-2">
            {approved.map((r: RewardRedemption) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint text-foreground">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1 truncate text-sm font-semibold">{r.reward_name}</div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {r.decided_at ? formatDate(r.decided_at) : ""} · {r.points} p
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
