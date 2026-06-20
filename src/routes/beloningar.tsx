import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addReward,
  deleteReward,
  fetchFamilySettings,
  fetchMyFamilyIds,
  fetchRewards,
  updateReward,
  type Reward,
} from "@/lib/db";
import { getCurrentFamilyId, setCurrentFamilyId } from "@/lib/family";
import { useSession } from "@/lib/auth";
import { ArrowLeft, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Parent-only page to create/edit/delete rewards. Gated by the family's
// points_enabled setting (redirects away when off).
export const Route = createFileRoute("/beloningar")({
  component: RewardsPage,
});

function RewardsPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [familyId, setFamilyId] = useState<string | null>(null);

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
  const rewardsQ = useQuery({
    queryKey: ["rewards"],
    queryFn: fetchRewards,
    enabled: !!familyId,
  });

  // If the points system is off, this page shouldn't exist — go back.
  useEffect(() => {
    if (settingsQ.data && !settingsQ.data.points_enabled) {
      navigate({ to: "/parent", replace: true });
    }
  }, [settingsQ.data, navigate]);

  if (loading || !session || !settingsQ.data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/70" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-10 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/parent"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/80 shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl">Belöningar</h1>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Skapa egna belöningar som barnen kan spara poäng till. Exempel (baserat på 3 aktiviteter om dagen): Glass – 100 poäng (ca 3–4 dagar), Biobesök – 500 poäng (ca 2–3 veckor) eller en ny fotboll – 1&nbsp;500 poäng (ca 1,5–2 månader). Anpassa poängen efter det som passar din familj.
      </p>

      <AddRewardCard />

      <div className="mt-5 space-y-3">
        {rewardsQ.data?.map((r) => (
          <RewardRow key={r.id} reward={r} />
        ))}
        {rewardsQ.data?.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Inga belöningar än.</p>
        )}
      </div>
    </main>
  );
}

// Shared editable form for adding and editing a reward.
function RewardForm({
  name,
  points,
  description,
  onName,
  onPoints,
  onDescription,
  onSave,
  onCancel,
  saveLabel,
}: {
  name: string;
  points: string;
  description: string;
  onName: (v: string) => void;
  onPoints: (v: string) => void;
  onDescription: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-peach-soft p-3">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Belöningens namn"
          className="flex-1 rounded-xl bg-white px-3 py-2 text-sm outline-none"
        />
        <input
          type="number"
          min={0}
          value={points}
          onChange={(e) => onPoints(e.target.value)}
          placeholder="Poäng"
          aria-label="Antal poäng"
          className="w-24 rounded-xl bg-white px-2 py-2 text-center text-sm outline-none"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => onDescription(e.target.value)}
        placeholder="Beskrivning (valfri)"
        rows={2}
        className="rounded-xl bg-white px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={!name.trim()}
          className="flex-1 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saveLabel}
        </button>
        <button onClick={onCancel} className="rounded-xl bg-white px-4 text-xs shadow-sm">
          Avbryt
        </button>
      </div>
    </div>
  );
}

function AddRewardCard() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [points, setPoints] = useState("50");
  const [description, setDescription] = useState("");

  const reset = () => {
    setName("");
    setPoints("50");
    setDescription("");
    setAdding(false);
  };

  const addM = useMutation({
    mutationFn: () =>
      addReward(name.trim(), Math.max(0, Math.floor(Number(points) || 0)), description.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      reset();
      toast.success("Belöning tillagd");
    },
  });

  if (adding) {
    return (
      <div className="card-soft p-3">
        <RewardForm
          name={name}
          points={points}
          description={description}
          onName={setName}
          onPoints={setPoints}
          onDescription={setDescription}
          onSave={() => name.trim() && addM.mutate()}
          onCancel={reset}
          saveLabel="Lägg till"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary/40 bg-white/60 py-4 text-sm font-bold text-foreground shadow-sm transition hover:bg-white"
    >
      <Plus className="h-5 w-5" /> Lägg till belöning
    </button>
  );
}

function RewardRow({ reward }: { reward: Reward }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(reward.name);
  const [points, setPoints] = useState(String(reward.points_required));
  const [description, setDescription] = useState(reward.description ?? "");

  const updM = useMutation({
    mutationFn: () =>
      updateReward(
        reward.id,
        name.trim(),
        Math.max(0, Math.floor(Number(points) || 0)),
        description.trim(),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      setEditing(false);
      toast.success("Sparat");
    },
  });
  const delM = useMutation({
    mutationFn: () => deleteReward(reward.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      toast.success("Borttagen");
    },
  });

  if (editing) {
    return (
      <div className="card-soft p-3">
        <RewardForm
          name={name}
          points={points}
          description={description}
          onName={setName}
          onPoints={setPoints}
          onDescription={setDescription}
          onSave={() => name.trim() && updM.mutate()}
          onCancel={() => {
            setEditing(false);
            setName(reward.name);
            setPoints(String(reward.points_required));
            setDescription(reward.description ?? "");
          }}
          saveLabel="Spara"
        />
      </div>
    );
  }

  return (
    <div className="card-soft flex items-center gap-3 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sun-soft to-mint-soft text-2xl shadow-inner">
        <Gift className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{reward.name}</div>
        {reward.description && (
          <div className="truncate text-xs text-muted-foreground">{reward.description}</div>
        )}
      </div>
      <span className="shrink-0 rounded-full bg-peach-soft px-3 py-1 text-xs font-bold">
        {reward.points_required} p
      </span>
      <button
        onClick={() => {
          setName(reward.name);
          setPoints(String(reward.points_required));
          setDescription(reward.description ?? "");
          setEditing(true);
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-peach-soft"
        aria-label="Ändra"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => {
          if (confirm(`Ta bort "${reward.name}"?`)) delM.mutate();
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-destructive hover:bg-destructive/10"
        aria-label="Ta bort"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
