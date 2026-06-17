import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addCompletion,
  fetchActivities,
  fetchCategories,
  fetchChildByName,
  fetchCompletionsForDate,
  randomCheer,
  removeCompletion,
  todayDate,
  toggleFavorite,
  type Activity,
  type Completion,
} from "@/lib/db";
import { ArrowLeft, Check, Star } from "lucide-react";
import { ChildTabs } from "@/components/ChildTabs";
import { toast } from "sonner";
import { useMemo } from "react";

export const Route = createFileRoute("/child/$name/favorites")({
  component: FavoritesPage,
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function FavoritesPage() {
  const { name } = Route.useParams();
  const qc = useQueryClient();
  const date = todayDate();

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

  const add = useMutation({
    mutationFn: (activityId: string) => addCompletion(child!.id, activityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["completions", child!.id] });
      toast.success(randomCheer(child!.name));
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeCompletion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["completions", child!.id] }),
  });
  const favorite = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => toggleFavorite(id, value),
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

  const favorites = useMemo(
    () => (actsQ.data ?? []).filter((a) => a.is_favorite),
    [actsQ.data],
  );

  // Group favorites under the same main categories as the Aktiviteter view.
  const groups = useMemo(() => {
    const cats = [...(catsQ.data ?? [])].sort(
      (a, b) => GOAL_ORDER.indexOf(a.slug) - GOAL_ORDER.indexOf(b.slug),
    );
    return cats
      .map((cat) => ({
        cat,
        color: CATEGORY_COLORS[cat.slug] ?? "pink",
        acts: favorites
          .filter((a) => a.category_id === cat.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .filter((g) => g.acts.length > 0);
  }, [catsQ.data, favorites]);

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

      <ChildTabs name={name} active="favorites" />

      <div className="mb-5 flex items-center justify-between px-1">
        <h1 className="text-2xl">⭐ Favoriter</h1>
        {favorites.length > 0 && (
          <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-bold">
            {favorites.length} st
          </span>
        )}
      </div>

      {actsQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-3xl bg-white/60" />
          <div className="h-28 animate-pulse rounded-3xl bg-white/60" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-3xl bg-gradient-to-br from-gold-soft via-sun-soft to-sand-soft p-8 text-center shadow-sm">
          <div className="text-6xl">🌟</div>
          <p className="mt-4 text-sm font-semibold text-foreground/80">
            Markera dina favoritaktiviteter med ⭐ så hamnar de här.
          </p>
          <Link
            to="/child/$name"
            params={{ name }}
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow"
          >
            Till aktiviteter
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ cat, color, acts }) => (
            <section key={cat.id}>
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-lg">{cat.name}</h2>
                <span
                  className={`rounded-full bg-${color}-soft px-3 py-1 text-xs font-bold text-foreground`}
                >
                  {acts.length} st
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {acts.map((act) => {
                  const done = completionByActivity.get(act.id);
                  return (
                    <button
                      key={act.id}
                      disabled={!child}
                      onClick={() => {
                        if (done) remove.mutate(done.id);
                        else add.mutate(act.id);
                      }}
                      className={`group relative flex min-h-[110px] flex-col items-start justify-between rounded-3xl p-4 text-left shadow-sm transition active:scale-95 ${
                        done ? `bg-${color} text-foreground ring-2 ring-${color}` : "bg-white hover:bg-white/90"
                      }`}
                    >
                      <span className="text-3xl">{act.emoji}</span>
                      <span className="pr-6 text-sm font-semibold leading-tight">{act.name}</span>

                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          favorite.mutate({ id: act.id, value: false });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            favorite.mutate({ id: act.id, value: false });
                          }
                        }}
                        className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white/70 shadow-sm transition hover:scale-110"
                        aria-label="Ta bort favorit"
                      >
                        <Star className="h-4 w-4 fill-gold text-gold" strokeWidth={2.5} />
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
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
