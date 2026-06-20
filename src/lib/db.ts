import { supabase } from "@/integrations/supabase/client";
import { getCurrentFamilyId } from "@/lib/family";
import {
  sfAddBucketItem,
  sfAddBucketItems,
  sfAddCompletion,
  sfAllCompletions,
  sfBucketItems,
  sfChildPoints,
  sfChildPointsSummary,
  sfChildRedemptions,
  sfCompletionsForDate,
  sfDeleteBucketItem,
  sfFamilySettings,
  sfGetChildByName,
  sfListActivities,
  sfListCategories,
  sfListChildren,
  sfListRewards,
  sfRemoveCompletion,
  sfRequestRedemption,
  sfResendFamilyInvite,
  sfRevokeFamilyInvite,
  sfSendFamilyInvite,
  sfSetBucketItemDone,
  sfToggleFavorite,
  sfUpdateBucketItem,
} from "@/lib/api/family.functions";

export type Family = {
  id: string;
  name: string;
  created_at: string;
  points_enabled: boolean;
};
export type Child = {
  id: string;
  family_id: string | null;
  name: string;
  emoji: string;
  color: string;
};
// categories/activities are now per-family (family_id); template rows have null.
export type Category = {
  id: string;
  family_id: string | null;
  name: string;
  slug: string;
  icon: string;
  sort_order: number;
};
export type Activity = {
  id: string;
  family_id: string | null;
  category_id: string;
  subcategory: string | null;
  name: string;
  emoji: string;
  is_favorite: boolean;
  // null = activity gives no points (the "Ge poäng" toggle is off).
  points: number | null;
  sort_order: number;
};
// Parent-defined reward the child can save points toward.
export type Reward = {
  id: string;
  family_id: string;
  name: string;
  points_required: number;
  description: string | null;
  sort_order: number;
  created_at: string;
};
export type RedemptionStatus = "pending" | "approved" | "rejected";
// A child's request to spend points on a reward (name + cost snapshotted so the
// row survives the reward being edited/deleted — used for history & statistics).
export type RewardRedemption = {
  id: string;
  reward_id: string | null;
  reward_name: string;
  points: number;
  status: RedemptionStatus;
  requested_at: string;
  decided_at: string | null;
};
// A pending request as the parent dashboard sees it (with the requesting child).
export type RewardRequest = {
  id: string;
  reward_id: string | null;
  reward_name: string;
  points: number;
  status: RedemptionStatus;
  requested_at: string;
  child: { name: string; emoji: string } | null;
};
// Two point figures the child sees: total earned (statistics, only grows) and
// the spendable balance; `pending` is the amount reserved by open requests.
export type ChildPointsSummary = { earned: number; available: number; pending: number };
// Lightweight family settings read both contexts can fetch (child via cookie).
export type FamilySettings = { points_enabled: boolean };
export type Completion = {
  id: string;
  child_id: string;
  activity_id: string;
  completed_at: string;
  completed_date: string;
};
export type BucketItem = {
  id: string;
  child_id: string;
  title: string;
  emoji: string;
  done: boolean;
  done_at: string | null;
  sort_order: number;
  created_at: string;
};

// Subcategories within "Kreativitet & Lärande". Displayed in this order; all
// collapsed by default. `slug` matches activities.subcategory.
export type SubcategoryMeta = { slug: string; label: string; emoji: string };
export const SUBCATEGORIES: SubcategoryMeta[] = [
  { slug: "kreativitet", label: "Kreativitet", emoji: "🎨" },
  { slug: "lasning", label: "Läsning & skrivande", emoji: "📚" },
  { slug: "bakning", label: "Bakning & matlagning", emoji: "🍪" },
  { slug: "pussel", label: "Pussel & hjärngympa", emoji: "🧩" },
  { slug: "bygga", label: "Bygga & skapa", emoji: "🏗️" },
  { slug: "utomhus", label: "Utomhusaktiviteter", emoji: "🌳" },
  { slug: "sommarutmaningar", label: "Sommarutmaningar", emoji: "⭐" },
  { slug: "socialt", label: "Socialt", emoji: "👭" },
];

export function todayDate(): string {
  // Use local date (Europe/Stockholm assumed since users are Swedish)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Child-facing reads/writes go through server functions (service role, scoped
// by the dual-context resolver). Parent management ops below stay on the authed
// client + RLS.
export async function fetchChildren(): Promise<Child[]> {
  return (await sfListChildren()) as Child[];
}

export async function fetchChildByName(name: string): Promise<Child | null> {
  return (await sfGetChildByName({ data: { name } })) as Child | null;
}

// ---------------------------------------------------------------------------
// Onboarding: create a family and its children
// ---------------------------------------------------------------------------

export type NewChild = { name: string; emoji: string; color: string };

export async function createFamily(name: string): Promise<string> {
  // Generate the id client-side and insert WITHOUT select(): under strict RLS the
  // creator isn't a member yet, so a RETURNING/SELECT would be blocked. Membership
  // is added immediately after (addFamilyMember), which is also what makes the
  // family selectable from then on.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("families").insert({ id, name });
  if (error) throw error;
  return id;
}

export async function addChildrenToFamily(familyId: string, children: NewChild[]) {
  if (children.length === 0) return;
  const { error } = await supabase.from("children").insert(
    children.map((c) => ({
      family_id: familyId,
      name: c.name,
      emoji: c.emoji || "🙂",
      color: c.color,
    })),
  );
  if (error) throw error;
}

export async function fetchFamily(id: string): Promise<Family | null> {
  const { data, error } = await supabase.from("families").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateFamilyName(id: string, name: string) {
  const { error } = await supabase.from("families").update({ name }).eq("id", id);
  if (error) throw error;
}

// Toggle the optional points system for a family (parent, via RLS).
export async function setPointsEnabled(id: string, value: boolean) {
  const { error } = await supabase.from("families").update({ points_enabled: value }).eq("id", id);
  if (error) throw error;
}

// Give every existing activity without points a default value (used when the
// family first activates the points system). Activities that already have a
// points value are left untouched. Scoped to the family, so it never affects
// families that don't use points.
export async function backfillActivityPoints(familyId: string, value = 10) {
  const { error } = await supabase
    .from("activities")
    .update({ points: value })
    .eq("family_id", familyId)
    .is("points", null);
  if (error) throw error;
}

export async function addChild(familyId: string, name: string, emoji: string, color: string) {
  const { error } = await supabase
    .from("children")
    .insert({ family_id: familyId, name, emoji: emoji || "🙂", color });
  if (error) throw error;
}

export async function updateChild(id: string, name: string, emoji: string) {
  const { error } = await supabase
    .from("children")
    .update({ name, emoji: emoji || "🙂" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteChild(id: string) {
  const { error } = await supabase.from("children").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Auth: family membership + secure child-access tokens
// ---------------------------------------------------------------------------

export type FamilyAccessToken = {
  id: string;
  family_id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

// Link the signed-in parent to a family (RLS allows adding yourself, and only to
// a member-less family). The creator/claimer becomes the family OWNER; invited
// parents never use this path — they join via accept_family_invite (role parent).
export async function addFamilyMember(
  familyId: string,
  userId: string,
  role: "owner" | "parent" = "owner",
) {
  const { error } = await supabase
    .from("family_members")
    .upsert({ family_id: familyId, user_id: userId, role }, { onConflict: "family_id,user_id" });
  if (error) throw error;
}

export async function fetchMyFamilyIds(): Promise<string[]> {
  // Oldest membership first, so the "default" family (when no active family is
  // cached) is stable across calls rather than arbitrary.
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => r.family_id);
}

// Backfill/claim: ensure the signed-in parent is a member of `familyId`.
// Returns true if they are (now) a member. Claiming only succeeds for a
// member-less family (pre-auth families or one just created); if the family is
// already owned by someone else the insert is blocked by RLS and we return false.
export async function ensureFamilyMembership(familyId: string, userId: string): Promise<boolean> {
  const mine = await fetchMyFamilyIds();
  if (mine.includes(familyId)) return true;
  try {
    await addFamilyMember(familyId, userId);
    return true;
  } catch {
    return false;
  }
}

export async function fetchActiveFamilyToken(familyId: string): Promise<FamilyAccessToken | null> {
  const { data, error } = await supabase
    .from("family_access_tokens")
    .select("*")
    .eq("family_id", familyId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// 256-bit cryptographically-random token, base64url-encoded.
function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Create a fresh token and revoke any previous active ones (old links die).
export async function createFamilyToken(familyId: string): Promise<string> {
  const token = generateAccessToken();
  const { error: revokeErr } = await supabase
    .from("family_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("family_id", familyId)
    .is("revoked_at", null);
  if (revokeErr) throw revokeErr;
  const { error } = await supabase
    .from("family_access_tokens")
    .insert({ family_id: familyId, token });
  if (error) throw error;
  return token;
}

// Child redemption via the SECURITY DEFINER RPC. Returns family_id or null.
export async function redeemFamilyToken(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("redeem_family_token", { p_token: token });
  if (error) throw error;
  return (data as string | null) ?? null;
}

// ---------------------------------------------------------------------------
// Multi-parent: members + invitations
// ---------------------------------------------------------------------------

export type FamilyRole = "owner" | "parent";
export type FamilyMember = {
  id: string;
  user_id: string;
  role: FamilyRole;
  email: string | null;
  created_at: string;
  is_self: boolean;
};
export type FamilyInvite = {
  id: string;
  family_id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked";
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};
export type InvitePreview = {
  family_name: string;
  inviter_email: string | null;
  invite_email: string;
  status: "pending" | "accepted" | "revoked";
  expired: boolean;
};

// Members of a family with their emails (DEFINER RPC; member-gated server-side).
export async function listFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase.rpc("list_family_members", { p_family: familyId });
  if (error) throw error;
  return (data ?? []) as FamilyMember[];
}

// Pending invitations for the family (owner-only via RLS).
export async function listPendingInvites(familyId: string): Promise<FamilyInvite[]> {
  const { data, error } = await supabase
    .from("family_invites")
    .select("id, family_id, email, role, status, created_at, expires_at, accepted_at")
    .eq("family_id", familyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FamilyInvite[];
}

// Owner sends an invite email (server fn; token generated + emailed server-side).
export async function sendFamilyInvite(email: string, origin: string) {
  await sfSendFamilyInvite({ data: { email, origin } });
}

export async function resendFamilyInvite(id: string, origin: string) {
  await sfResendFamilyInvite({ data: { id, origin } });
}

export async function revokeFamilyInvite(id: string) {
  await sfRevokeFamilyInvite({ data: { id } });
}

// Owner removes a co-parent (DEFINER RPC enforces owner + not-owner target).
export async function removeFamilyMember(memberId: string) {
  const { error } = await supabase.rpc("remove_family_member", { p_member_id: memberId });
  if (error) throw error;
}

// Read-only invite context for the /invite page (callable before login).
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("get_invite_preview", { p_token: token });
  if (error) throw error;
  const row = (data as InvitePreview[] | null)?.[0];
  return row ?? null;
}

// Accept an invite as the signed-in user (DEFINER RPC; email must match).
// Returns the family id joined.
export async function acceptFamilyInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_family_invite", { p_token: token });
  if (error) throw error;
  return data as string;
}

export async function fetchCategories(): Promise<Category[]> {
  return (await sfListCategories()) as Category[];
}

export async function fetchActivities(): Promise<Activity[]> {
  return (await sfListActivities()) as Activity[];
}

// ---------------------------------------------------------------------------
// Optional points & rewards system (gated by family.points_enabled)
// ---------------------------------------------------------------------------

// Readable in both contexts (parent Bearer / child cookie) via server fn.
export async function fetchFamilySettings(): Promise<FamilySettings> {
  return (await sfFamilySettings()) as FamilySettings;
}

export async function fetchRewards(): Promise<Reward[]> {
  return (await sfListRewards()) as Reward[];
}

export async function fetchChildPoints(childId: string): Promise<number> {
  return (await sfChildPoints({ data: { childId } })) as number;
}

// Earned (total) + available balance + reserved-by-pending, in one call.
export async function fetchChildPointsSummary(childId: string): Promise<ChildPointsSummary> {
  return (await sfChildPointsSummary({ data: { childId } })) as ChildPointsSummary;
}

// The child's own redemptions (waiting + decided), newest first.
export async function fetchChildRedemptions(childId: string): Promise<RewardRedemption[]> {
  return (await sfChildRedemptions({ data: { childId } })) as RewardRedemption[];
}

// Child requests to redeem a reward (creates a pending request; no points move).
export async function requestRedemption(childId: string, rewardId: string) {
  await sfRequestRedemption({ data: { childId, rewardId } });
}

// Reward management (parent, via RLS). family_id from the active family.
export async function addReward(name: string, pointsRequired: number, description: string | null) {
  const { error } = await supabase.from("rewards").insert({
    family_id: getCurrentFamilyId()!,
    name,
    points_required: pointsRequired,
    description: description || null,
  });
  if (error) throw error;
}

export async function updateReward(
  id: string,
  name: string,
  pointsRequired: number,
  description: string | null,
) {
  const { error } = await supabase
    .from("rewards")
    .update({ name, points_required: pointsRequired, description: description || null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReward(id: string) {
  const { error } = await supabase.from("rewards").delete().eq("id", id);
  if (error) throw error;
}

// Parent dashboard: pending reward requests across the family's children. Read on
// the authed client (RLS: is_family_member); the embedded children join is
// member-scoped too, so a parent only ever sees their own family's requests.
export async function listRewardRequests(familyId: string): Promise<RewardRequest[]> {
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select("id, reward_id, reward_name, points, status, requested_at, children(name, emoji)")
    .eq("family_id", familyId)
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) throw error;
  // The embedded to-one join may surface as an object or a single-element array
  // depending on inference; normalize both (mirrors childPoints in the server module).
  type ChildRel = { name: string; emoji: string };
  type Row = {
    id: string;
    reward_id: string | null;
    reward_name: string;
    points: number;
    status: string;
    requested_at: string;
    children: ChildRel | ChildRel[] | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const c = r.children;
    return {
      id: r.id,
      reward_id: r.reward_id,
      reward_name: r.reward_name,
      points: r.points,
      status: r.status as RedemptionStatus,
      requested_at: r.requested_at,
      child: Array.isArray(c) ? (c[0] ?? null) : c,
    };
  });
}

// Parent approves a pending request (DEFINER RPC re-checks the balance atomically).
export async function approveRewardRequest(id: string) {
  const { error } = await supabase.rpc("approve_reward_redemption", { p_id: id });
  if (error) throw error;
}

// Parent rejects a pending request (no points move; the child can try again).
export async function rejectRewardRequest(id: string) {
  const { error } = await supabase.rpc("reject_reward_redemption", { p_id: id });
  if (error) throw error;
}

// Clone the template catalog into a newly created family (idempotent server-side).
export async function cloneCatalogForFamily(familyId: string) {
  const { error } = await supabase.rpc("clone_catalog_for_family", { p_family: familyId });
  if (error) throw error;
}

export async function fetchCompletionsForDate(
  childId: string,
  date: string,
): Promise<Completion[]> {
  return (await sfCompletionsForDate({ data: { childId, date } })) as Completion[];
}

export async function fetchCompletionsBetween(
  childId: string,
  from: string,
  to: string,
): Promise<Completion[]> {
  const { data, error } = await supabase
    .from("completions")
    .select("*")
    .eq("child_id", childId)
    .gte("completed_date", from)
    .lte("completed_date", to);
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllCompletions(childId: string): Promise<Completion[]> {
  return (await sfAllCompletions({ data: { childId } })) as Completion[];
}

export async function addCompletion(childId: string, activityId: string) {
  await sfAddCompletion({ data: { childId, activityId } });
}

export async function removeCompletion(completionId: string) {
  await sfRemoveCompletion({ data: { id: completionId } });
}

export async function addActivity(
  categoryId: string,
  name: string,
  emoji: string,
  subcategory: string | null = null,
  points: number | null = null,
) {
  const { error } = await supabase.from("activities").insert({
    category_id: categoryId,
    family_id: getCurrentFamilyId(),
    name,
    emoji: emoji || "✨",
    subcategory,
    points,
  });
  if (error) throw error;
}

export async function toggleFavorite(id: string, value: boolean) {
  await sfToggleFavorite({ data: { activityId: id, value } });
}

export async function updateActivity(
  id: string,
  name: string,
  emoji: string,
  points: number | null = null,
) {
  const { error } = await supabase
    .from("activities")
    .update({ name, emoji: emoji || "✨", points })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) throw error;
}

export const CHEERS = [
  "Bra jobbat! 🌟",
  "Toppen, fortsätt så! 💖",
  "Vad duktig du är! ✨",
  "Wow, fantastiskt! 🌸",
  "Du är en stjärna! ⭐",
  "Så kreativ du är! 🎨",
  "Heja dig! 💜",
  "Underbart! 🌈",
];

export function randomCheer(name?: string) {
  const msg = CHEERS[Math.floor(Math.random() * CHEERS.length)];
  return name ? msg.replace("!", ` ${name}!`) : msg;
}

// ---------------------------------------------------------------------------
// Sommarbucketlist
// ---------------------------------------------------------------------------

export async function fetchBucketItems(childId: string): Promise<BucketItem[]> {
  return (await sfBucketItems({ data: { childId } })) as BucketItem[];
}

export async function addBucketItem(childId: string, title: string, emoji: string) {
  await sfAddBucketItem({ data: { childId, title, emoji } });
}

// Insert several goals at once (used by the first-time welcome flow).
export async function addBucketItems(childId: string, items: { title: string; emoji: string }[]) {
  await sfAddBucketItems({ data: { childId, items } });
}

export async function updateBucketItem(id: string, title: string, emoji: string) {
  await sfUpdateBucketItem({ data: { id, title, emoji } });
}

export async function deleteBucketItem(id: string) {
  await sfDeleteBucketItem({ data: { id } });
}

export async function setBucketItemDone(id: string, done: boolean) {
  await sfSetBucketItemDone({ data: { id, done } });
}

// Library of inspiring summer goals the child can pick from.
export type BucketSuggestion = { title: string; emoji: string };
export const BUCKET_SUGGESTIONS: BucketSuggestion[] = [
  { title: "Bygga koja", emoji: "🏕️" },
  { title: "Ha vattenkrig", emoji: "💦" },
  { title: "Baka cupcakes", emoji: "🧁" },
  { title: "Sova över hos en kompis", emoji: "🛌" },
  { title: "Gå på bio", emoji: "🎬" },
  { title: "Åka till badplats", emoji: "🏖️" },
  { title: "Äta glass på café", emoji: "🍦" },
  { title: "Ha picknick", emoji: "🧺" },
  { title: "Plantera något", emoji: "🌱" },
  { title: "Lära mig jonglera", emoji: "🤹" },
  { title: "Lära mig vissla", emoji: "😗" },
  { title: "Rita en egen serie", emoji: "✏️" },
  { title: "Läsa en hel bok", emoji: "📚" },
  { title: "Gå på minigolf", emoji: "⛳" },
  { title: "Fånga en fjäril", emoji: "🦋" },
  { title: "Fotografera naturen", emoji: "📸" },
  { title: "Lära mig ett korttrick", emoji: "🃏" },
  { title: "Spela kubb", emoji: "🪵" },
  { title: "Besöka en ny lekplats", emoji: "🛝" },
  { title: "Ha en spelkväll med familjen", emoji: "🎲" },
  { title: "Åka till djurpark", emoji: "🦁" },
  { title: "Göra egen glass", emoji: "🍨" },
  { title: "Sova i tält", emoji: "⛺" },
  { title: "Besöka ett museum", emoji: "🏛️" },
  { title: "Åka till stranden", emoji: "🏝️" },
  { title: "Se en solnedgång", emoji: "🌅" },
  { title: "Ha picknick med en kompis", emoji: "🧺" },
  { title: "Lära mig en dans", emoji: "💃" },
  { title: "Baka något helt själv", emoji: "👩‍🍳" },
  { title: "Samla fina stenar", emoji: "🪨" },
  { title: "Läsa tre böcker", emoji: "📖" },
  { title: "Få en ny kompis", emoji: "🤝" },
  { title: "Besöka en ny plats", emoji: "🗺️" },
  { title: "Rita ett stort konstverk", emoji: "🖼️" },
  { title: "Ha vattenballongkrig", emoji: "🎈" },
  { title: "Åka och bada", emoji: "🏊" },
  { title: "Rita med gatukritor", emoji: "🖍️" },
  { title: "Gå en naturstig", emoji: "🥾" },
  { title: "Flyga drake", emoji: "🪁" },
  { title: "Mata änder", emoji: "🦆" },
];

export const BUCKET_CHEERS = [
  "🎉 Vad kul! Ett nytt sommarminne skapat!",
  "🌞 Heja dig! Ett äventyr klart!",
  "✨ Wow! Det där kommer du minnas!",
  "🏖️ Ett sommarmål bockat – härligt jobbat!",
  "🌈 Så roligt! Ännu ett minne i fickan!",
];

export function randomBucketCheer() {
  return BUCKET_CHEERS[Math.floor(Math.random() * BUCKET_CHEERS.length)];
}
