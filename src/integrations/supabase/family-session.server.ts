// Server-only. Implements server-mediated family data access for Phase 2.
//
// Two contexts resolve to a family_id:
//   - Parent: the request carries the Supabase user JWT (Bearer) → membership.
//   - Child:  a signed httpOnly cookie set after a valid /f/<token> redemption.
//
// All data here goes through the SERVICE ROLE client (bypasses RLS), so every
// function MUST enforce the family scope itself. Never trust the caller's ids.

import { createHmac, timingSafeEqual } from "node:crypto";
import { getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "./client.server";

const COOKIE_NAME = "sommar_child_family";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 120; // ~the summer

function cookieSecret(): string {
  const s = process.env.FAMILY_COOKIE_SECRET;
  if (!s) throw new Error("Missing FAMILY_COOKIE_SECRET");
  return s;
}

function sign(familyId: string): string {
  return createHmac("sha256", cookieSecret()).update(familyId).digest("base64url");
}

function makeCookieValue(familyId: string): string {
  return `${familyId}.${sign(familyId)}`;
}

function parseCookieValue(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const familyId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(familyId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return familyId;
}

export function setChildFamilyCookie(familyId: string): void {
  setCookie(COOKIE_NAME, makeCookieValue(familyId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

function readChildFamilyCookie(): string | null {
  return parseCookieValue(getCookie(COOKIE_NAME));
}

// Resolve the authorized family for this request: parent (Bearer) first, then
// the child cookie. Returns null if neither yields a family.
//
// A parent may belong to several families. The client names the active one via
// the `x-active-family` header (attached by the family-attacher middleware); we
// honor it ONLY after confirming the user is a member of it — so it can never be
// spoofed into a family the caller doesn't belong to. Without a (valid) header
// we fall back to any membership, preserving the single-family behaviour.
async function resolveFamilyId(): Promise<string | null> {
  const authz = getRequestHeader("authorization");
  if (authz && authz.startsWith("Bearer ")) {
    const token = authz.slice(7);
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      const uid = data?.user?.id;
      if (!error && uid) {
        const requested = getRequestHeader("x-active-family");
        if (requested) {
          const { data: active } = await supabaseAdmin
            .from("family_members")
            .select("family_id")
            .eq("user_id", uid)
            .eq("family_id", requested)
            .maybeSingle();
          if (active?.family_id) return active.family_id;
        }
        const { data: m } = await supabaseAdmin
          .from("family_members")
          .select("family_id")
          .eq("user_id", uid)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (m?.family_id) return m.family_id;
      }
    } catch {
      // fall through to child cookie
    }
  }
  return readChildFamilyCookie();
}

async function requireFamily(): Promise<string> {
  const fam = await resolveFamilyId();
  if (!fam) throw new Error("No family context");
  return fam;
}

// --- scope guards -----------------------------------------------------------

async function assertChildInFamily(fam: string, childId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("children")
    .select("id")
    .eq("id", childId)
    .eq("family_id", fam)
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

async function assertActivityInFamily(fam: string, activityId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("activities")
    .select("id")
    .eq("id", activityId)
    .eq("family_id", fam)
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

async function bucketItemChildId(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("bucket_items")
    .select("child_id")
    .eq("id", id)
    .maybeSingle();
  return data?.child_id ?? null;
}

async function completionChildId(id: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("completions")
    .select("child_id")
    .eq("id", id)
    .maybeSingle();
  return data?.child_id ?? null;
}

// --- child session ----------------------------------------------------------

// Validate a family access token (service role), set the signed cookie, return
// the family id. Returns null for an invalid/revoked token.
export async function startChildSession(token: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("family_access_tokens")
    .select("family_id")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  await supabaseAdmin
    .from("family_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token);
  setChildFamilyCookie(data.family_id);
  return data.family_id;
}

// --- reads ------------------------------------------------------------------

export async function listChildren() {
  const fam = await requireFamily();
  const { data, error } = await supabaseAdmin
    .from("children")
    .select("*")
    .eq("family_id", fam)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getChildByName(name: string) {
  const fam = await requireFamily();
  const { data, error } = await supabaseAdmin
    .from("children")
    .select("*")
    .eq("family_id", fam)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Family-level settings readable in both contexts (parent Bearer / child cookie).
export async function familySettings() {
  const fam = await requireFamily();
  const { data, error } = await supabaseAdmin
    .from("families")
    .select("points_enabled")
    .eq("id", fam)
    .maybeSingle();
  if (error) throw error;
  return { points_enabled: data?.points_enabled ?? false };
}

export async function listRewards() {
  const fam = await requireFamily();
  const { data, error } = await supabaseAdmin
    .from("rewards")
    .select("*")
    .eq("family_id", fam)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Child's point balance = sum of points over completed activities that award
// points. Derived on the fly (no balance table).
export async function childPoints(childId: string): Promise<number> {
  const fam = await requireFamily();
  await assertChildInFamily(fam, childId);
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("activities(points)")
    .eq("child_id", childId);
  if (error) throw error;
  // The embedded to-one join may surface as an object or a single-element array
  // depending on inference; normalize both.
  type CompRow = {
    activities: { points: number | null } | { points: number | null }[] | null;
  };
  return ((data ?? []) as unknown as CompRow[]).reduce((sum, row) => {
    const a = row.activities;
    const pts = Array.isArray(a) ? a[0]?.points : a?.points;
    return sum + (pts ?? 0);
  }, 0);
}

export async function listCategories() {
  const fam = await requireFamily();
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("family_id", fam)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function listActivities() {
  const fam = await requireFamily();
  const { data, error } = await supabaseAdmin
    .from("activities")
    .select("*")
    .eq("family_id", fam)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function completionsForDate(childId: string, date: string) {
  const fam = await requireFamily();
  await assertChildInFamily(fam, childId);
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("*")
    .eq("child_id", childId)
    .eq("completed_date", date)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function allCompletions(childId: string) {
  const fam = await requireFamily();
  await assertChildInFamily(fam, childId);
  const { data, error } = await supabaseAdmin
    .from("completions")
    .select("*")
    .eq("child_id", childId);
  if (error) throw error;
  return data ?? [];
}

export async function bucketItems(childId: string) {
  const fam = await requireFamily();
  await assertChildInFamily(fam, childId);
  const { data, error } = await supabaseAdmin
    .from("bucket_items")
    .select("*")
    .eq("child_id", childId)
    .order("done", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// --- writes -----------------------------------------------------------------

export async function addCompletion(childId: string, activityId: string) {
  const fam = await requireFamily();
  await assertChildInFamily(fam, childId);
  await assertActivityInFamily(fam, activityId);
  const { error } = await supabaseAdmin
    .from("completions")
    .insert({ child_id: childId, activity_id: activityId });
  if (error) throw error;
}

export async function removeCompletion(id: string) {
  const fam = await requireFamily();
  const childId = await completionChildId(id);
  if (!childId) return;
  await assertChildInFamily(fam, childId);
  const { error } = await supabaseAdmin.from("completions").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFavorite(activityId: string, value: boolean) {
  const fam = await requireFamily();
  await assertActivityInFamily(fam, activityId);
  const { error } = await supabaseAdmin
    .from("activities")
    .update({ is_favorite: value })
    .eq("id", activityId);
  if (error) throw error;
}

export async function addBucketItem(childId: string, title: string, emoji: string) {
  const fam = await requireFamily();
  await assertChildInFamily(fam, childId);
  const { error } = await supabaseAdmin
    .from("bucket_items")
    .insert({ child_id: childId, title, emoji: emoji || "🏖️" });
  if (error) throw error;
}

export async function addBucketItems(childId: string, items: { title: string; emoji: string }[]) {
  if (items.length === 0) return;
  const fam = await requireFamily();
  await assertChildInFamily(fam, childId);
  const { error } = await supabaseAdmin.from("bucket_items").insert(
    items.map((it, i) => ({
      child_id: childId,
      title: it.title,
      emoji: it.emoji || "🏖️",
      sort_order: i,
    })),
  );
  if (error) throw error;
}

export async function updateBucketItem(id: string, title: string, emoji: string) {
  const fam = await requireFamily();
  const childId = await bucketItemChildId(id);
  if (!childId) throw new Error("Forbidden");
  await assertChildInFamily(fam, childId);
  const { error } = await supabaseAdmin
    .from("bucket_items")
    .update({ title, emoji: emoji || "🏖️" })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBucketItem(id: string) {
  const fam = await requireFamily();
  const childId = await bucketItemChildId(id);
  if (!childId) return;
  await assertChildInFamily(fam, childId);
  const { error } = await supabaseAdmin.from("bucket_items").delete().eq("id", id);
  if (error) throw error;
}

export async function setBucketItemDone(id: string, done: boolean) {
  const fam = await requireFamily();
  const childId = await bucketItemChildId(id);
  if (!childId) throw new Error("Forbidden");
  await assertChildInFamily(fam, childId);
  const { error } = await supabaseAdmin
    .from("bucket_items")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}
