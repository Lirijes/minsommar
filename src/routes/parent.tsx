import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addActivity,
  addChild,
  createFamilyToken,
  deleteActivity,
  deleteChild,
  ensureFamilyMembership,
  fetchActiveFamilyToken,
  fetchActivities,
  fetchCategories,
  fetchChildren,
  fetchCompletionsForDate,
  fetchFamily,
  fetchMyFamilyIds,
  todayDate,
  updateActivity,
  updateChild,
  updateFamilyName,
  SUBCATEGORIES,
  type Activity,
  type Child,
} from "@/lib/db";
import { getCurrentFamilyId, setCurrentFamilyId } from "@/lib/family";
import { useSession, signOut } from "@/lib/auth";
import { ArrowLeft, Copy, LogOut, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Start-page cards style only these colours; cycle through them for new kids.
const CHILD_COLORS = ["pink", "purple"];

export const Route = createFileRoute("/parent")({
  component: ParentPage,
});

function ParentPage() {
  const date = todayDate();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session, loading } = useSession();
  // Active family id (client-only; resolved after mount to avoid SSR mismatch).
  const [familyId, setFamilyId] = useState<string | null>(null);

  // Parent view requires login.
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  // Resolve the active family from MEMBERSHIP (auth.uid()) — authoritative — and
  // only fall back to the (user-scoped) cache for a legacy pre-auth family the
  // parent can still claim. Then backfill/claim membership so token admin works.
  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    (async () => {
      const ids = await fetchMyFamilyIds();
      let id: string | null = ids[0] ?? getCurrentFamilyId();
      if (!active) return;
      if (id) setCurrentFamilyId(id);
      setFamilyId(id);
      if (id) {
        const ok = await ensureFamilyMembership(id, session.user.id);
        if (ok && active) qc.invalidateQueries({ queryKey: ["family-token", id] });
      }
    })();
    return () => {
      active = false;
    };
  }, [session, qc]);

  const childrenQ = useQuery({ queryKey: ["children"], queryFn: fetchChildren });
  const catsQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const actsQ = useQuery({ queryKey: ["activities"], queryFn: fetchActivities });

  if (loading || !session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/70" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-10 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/" className="grid h-11 w-11 place-items-center rounded-full bg-white/80 shadow-sm">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl">Föräldravy</h1>
        <button
          onClick={() => signOut().then(() => navigate({ to: "/login", replace: true }))}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-muted-foreground shadow-sm"
          aria-label="Logga ut"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {familyId && <ManageFamily familyId={familyId} />}

      {familyId && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg">Barnens åtkomst</h2>
          <ChildAccess familyId={familyId} />
        </section>
      )}

      {familyId && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg">Barn</h2>
          <div className="space-y-4">
            {childrenQ.data?.map((c) => (
              <ChildCard key={c.id} child={c} date={date} />
            ))}
            {childrenQ.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">Inga barn än.</p>
            )}
            <AddChildCard familyId={familyId} childCount={childrenQ.data?.length ?? 0} />
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg">Aktiviteter</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Lägg till, ändra eller ta bort aktiviteter.
        </p>
        <div className="space-y-5">
          {catsQ.data?.map((cat) => (
            <ManageCategory
              key={cat.id}
              categoryId={cat.id}
              categoryName={cat.name}
              categorySlug={cat.slug}
              activities={actsQ.data?.filter((a) => a.category_id === cat.id) ?? []}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ManageFamily({ familyId }: { familyId: string }) {
  const qc = useQueryClient();
  const familyQ = useQuery({
    queryKey: ["family", familyId],
    queryFn: () => fetchFamily(familyId),
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const save = useMutation({
    mutationFn: () => updateFamilyName(familyId, name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family", familyId] });
      setEditing(false);
      toast.success("Familjenamn sparat");
    },
  });

  const family = familyQ.data;

  return (
    <div className="card-soft mb-6 p-4">
      {editing ? (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Familjens namn"
            autoFocus
            className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={() => name.trim() && save.mutate()}
            disabled={!name.trim()}
            className="rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Spara
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-xl bg-white px-2 text-xs shadow-sm"
          >
            Avbryt
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Familj
            </div>
            <div className="text-lg font-bold">{family?.name ?? "..."}</div>
          </div>
          <button
            onClick={() => {
              setName(family?.name ?? "");
              setEditing(true);
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-peach-soft"
            aria-label="Ändra familjenamn"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// "Barnens åtkomst": show / copy / QR / regenerate the secure family link.
function ChildAccess({ familyId }: { familyId: string }) {
  const qc = useQueryClient();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const tokenQ = useQuery({
    queryKey: ["family-token", familyId],
    queryFn: () => fetchActiveFamilyToken(familyId),
  });

  const regenerate = useMutation({
    mutationFn: () => createFamilyToken(familyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-token", familyId] });
      toast.success("Ny familjelänk skapad. Den gamla fungerar inte längre.");
    },
    onError: () => toast.error("Kunde inte skapa länk. Är du inloggad som förälder?"),
  });

  const token = tokenQ.data?.token;
  const link = token && origin ? `${origin}/f/${token}` : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Länk kopierad");
    } catch {
      toast.error("Kunde inte kopiera");
    }
  };

  return (
    <div className="card-soft space-y-4 p-4">
      <p className="text-sm text-muted-foreground">
        Barn loggar inte in. Ge dem den här länken (eller QR-koden) så öppnas familjen direkt på
        deras telefon.
      </p>

      {tokenQ.isLoading ? (
        <div className="h-10 animate-pulse rounded-xl bg-muted" />
      ) : link ? (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-xl bg-muted px-3 py-2 text-xs outline-none"
            />
            <button
              onClick={copy}
              className="flex items-center gap-1 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
            >
              <Copy className="h-3.5 w-3.5" /> Kopiera
            </button>
          </div>

          <div className="flex justify-center rounded-2xl bg-white p-4">
            <QRCodeSVG value={link} size={160} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Ingen familjelänk ännu – skapa en nedan.</p>
      )}

      <button
        onClick={() => {
          if (!link || confirm("Skapa en ny länk? Den nuvarande slutar fungera direkt.")) {
            regenerate.mutate();
          }
        }}
        disabled={regenerate.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold shadow-sm transition active:scale-95 disabled:opacity-50"
      >
        <RefreshCw className="h-4 w-4" />
        {link ? "Skapa ny familjelänk" : "Skapa familjelänk"}
      </button>
    </div>
  );
}

// Shared editable row for adding and editing a child (same UI as activities).
function ChildEditRow({
  emoji,
  name,
  onEmoji,
  onName,
  onSave,
  onCancel,
  saveLabel,
}: {
  emoji: string;
  name: string;
  onEmoji: (v: string) => void;
  onName: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <div className="mb-3 rounded-2xl bg-peach-soft p-2">
      <div className="flex items-center gap-2">
        <input
          value={emoji}
          onChange={(e) => onEmoji(e.target.value)}
          placeholder="🙂"
          maxLength={8}
          aria-label="Emoji"
          className="h-11 w-14 shrink-0 rounded-xl bg-white px-2 text-center text-2xl shadow-inner outline-none"
        />
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Barnets namn"
          className="flex-1 rounded-xl bg-white px-3 py-1.5 text-sm outline-none"
        />
      </div>
      <div className="mt-2 flex gap-2">
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

// One card per child: emoji, name, edit/delete, plus today's activities.
// Combines what used to be the "Barn" row and the "Idag" card.
function ChildCard({ child, date }: { child: Child; date: string }) {
  const qc = useQueryClient();
  const compsQ = useQuery({
    queryKey: ["completions", child.id, date],
    queryFn: () => fetchCompletionsForDate(child.id, date),
  });
  const actsQ = useQuery({ queryKey: ["activities"], queryFn: fetchActivities });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(child.name);
  const [emoji, setEmoji] = useState(child.emoji);

  const updM = useMutation({
    mutationFn: () => updateChild(child.id, name.trim(), emoji.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      setEditing(false);
      toast.success("Sparat");
    },
  });
  const delM = useMutation({
    mutationFn: () => deleteChild(child.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      toast.success("Borttaget");
    },
  });

  if (editing) {
    return (
      <div className="card-soft p-4">
        <ChildEditRow
          emoji={emoji}
          name={name}
          onEmoji={setEmoji}
          onName={setName}
          onSave={() => name.trim() && updM.mutate()}
          onCancel={() => {
            setEditing(false);
            setName(child.name);
            setEmoji(child.emoji);
          }}
          saveLabel="Spara"
        />
      </div>
    );
  }

  return (
    <div className="card-soft p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sun-soft to-mint-soft text-2xl shadow-inner">
          {child.emoji}
        </span>
        <h3 className="flex-1 text-lg font-bold">{child.name}</h3>
        <span className="rounded-full bg-peach-soft px-3 py-1 text-xs font-bold">
          {compsQ.data?.length ?? 0} st
        </span>
        <button
          onClick={() => {
            setName(child.name);
            setEmoji(child.emoji);
            setEditing(true);
          }}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-peach-soft"
          aria-label="Ändra"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            if (confirm(`Ta bort "${child.name}"?`)) delM.mutate();
          }}
          className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
          aria-label="Ta bort"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {compsQ.data && compsQ.data.length > 0 ? (
        <ul className="space-y-1.5">
          {compsQ.data.map((c) => {
            const act = actsQ.data?.find((a) => a.id === c.activity_id);
            return (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <span>{act?.emoji}</span>
                <span className="flex-1">{act?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.completed_at).toLocaleTimeString("sv-SE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Inga aktiviteter än idag.</p>
      )}
    </div>
  );
}

function AddChildCard({ familyId, childCount }: { familyId: string; childCount: number }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");

  const addM = useMutation({
    mutationFn: () =>
      addChild(familyId, name.trim(), emoji.trim(), CHILD_COLORS[childCount % CHILD_COLORS.length]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children"] });
      setName("");
      setEmoji("");
      setAdding(false);
      toast.success("Barn tillagt");
    },
  });

  if (adding) {
    return (
      <div className="card-soft p-4">
        <ChildEditRow
          emoji={emoji}
          name={name}
          onEmoji={setEmoji}
          onName={setName}
          onSave={() => name.trim() && addM.mutate()}
          onCancel={() => {
            setAdding(false);
            setName("");
            setEmoji("");
          }}
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
      <Plus className="h-5 w-5" /> Lägg till barn
    </button>
  );
}

function ManageCategory({
  categoryId,
  categoryName,
  categorySlug,
  activities,
}: {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  activities: Activity[];
}) {
  const qc = useQueryClient();
  const subcategorized = categorySlug === "kreativitet";
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [subcategory, setSubcategory] = useState(SUBCATEGORIES[0].slug);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["activities"] });

  const addM = useMutation({
    mutationFn: () =>
      addActivity(categoryId, name.trim(), emoji.trim(), subcategorized ? subcategory : null),
    onSuccess: () => {
      invalidate();
      setName("");
      setEmoji("✨");
      setAdding(false);
      toast.success("Aktivitet tillagd");
    },
  });
  const updM = useMutation({
    mutationFn: (id: string) => updateActivity(id, editName.trim(), editEmoji.trim()),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteActivity(id),
    onSuccess: () => {
      invalidate();
      toast.success("Borttagen");
    },
  });

  return (
    <div className="card-soft p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">{categoryName}</h3>
        <button
          onClick={() => setAdding((s) => !s)}
          className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow"
          aria-label="Lägg till"
        >
          {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      {adding && (
        <div className="mb-3 flex flex-col gap-2 rounded-2xl bg-peach-soft p-2">
          {subcategorized && (
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="rounded-xl bg-white px-3 py-2 text-sm"
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
              className="w-14 rounded-xl bg-white px-2 py-2 text-center text-xl"
              maxLength={4}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aktivitetens namn"
              className="flex-1 rounded-xl bg-white px-3 py-2 text-sm"
            />
            <button
              onClick={() => name.trim() && addM.mutate()}
              disabled={!name.trim()}
              className="rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Lägg till
            </button>
          </div>
        </div>
      )}

      {subcategorized ? (
        <div className="space-y-3">
          {SUBCATEGORIES.map((sub) => {
            const subActs = activities.filter((a) => a.subcategory === sub.slug);
            if (subActs.length === 0) return null;
            return (
              <div key={sub.slug}>
                <div className="mb-1.5 px-1 text-xs font-bold text-muted-foreground">
                  {sub.emoji} {sub.label}
                </div>
                <ul className="space-y-1.5">
                  {subActs.map((a) => (
                    <ActivityRow
                      key={a.id}
                      a={a}
                      editingId={editingId}
                      editEmoji={editEmoji}
                      editName={editName}
                      setEditEmoji={setEditEmoji}
                      setEditName={setEditName}
                      setEditingId={setEditingId}
                      onSave={() => updM.mutate(a.id)}
                      onDelete={() => delM.mutate(a.id)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {activities.map((a) => (
            <ActivityRow
              key={a.id}
              a={a}
              editingId={editingId}
              editEmoji={editEmoji}
              editName={editName}
              setEditEmoji={setEditEmoji}
              setEditName={setEditName}
              setEditingId={setEditingId}
              onSave={() => updM.mutate(a.id)}
              onDelete={() => delM.mutate(a.id)}
            />
          ))}
          {activities.length === 0 && (
            <li className="text-center text-sm text-muted-foreground">Inga aktiviteter än.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function ActivityRow({
  a,
  editingId,
  editEmoji,
  editName,
  setEditEmoji,
  setEditName,
  setEditingId,
  onSave,
  onDelete,
}: {
  a: Activity;
  editingId: string | null;
  editEmoji: string;
  editName: string;
  setEditEmoji: (v: string) => void;
  setEditName: (v: string) => void;
  setEditingId: (v: string | null) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <li>
            {editingId === a.id ? (
              <div className="flex gap-2 rounded-2xl bg-sand-soft p-2">
                <input
                  value={editEmoji}
                  onChange={(e) => setEditEmoji(e.target.value)}
                  className="w-12 rounded-xl bg-white px-2 py-1.5 text-center text-lg"
                  maxLength={4}
                />
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded-xl bg-white px-3 py-1.5 text-sm"
                />
                <button
                  onClick={onSave}
                  className="rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
                >
                  Spara
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-xl bg-white px-2 text-xs"
                >
                  Avbryt
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl bg-white/70 p-2">
                <span className="text-xl">{a.emoji}</span>
                <span className="flex-1 text-sm">{a.name}</span>
                <button
                  onClick={() => {
                    setEditingId(a.id);
                    setEditName(a.name);
                    setEditEmoji(a.emoji);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-peach-soft"
                  aria-label="Ändra"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Ta bort "${a.name}"?`)) onDelete();
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                  aria-label="Ta bort"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
    </li>
  );
}
