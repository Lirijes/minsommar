// Server-only. Owner-driven family invitations and their email delivery.
//
// All writes use the SERVICE ROLE client (bypasses RLS), so every entry point
// MUST prove the caller is the OWNER of the active family before doing anything.
// The raw invite token is generated here, emailed, and never persisted — only
// its SHA-256 hash is stored (see family_invites.token_hash). Acceptance happens
// elsewhere, through the accept_family_invite SECURITY DEFINER function.

import { createHash, randomBytes } from "node:crypto";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "./client.server";

const INVITE_TTL_DAYS = 7;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Resolve the caller and the family they are acting on, and require OWNER role.
// Mirrors the parent path of resolveFamilyId (Bearer + validated x-active-family).
type OwnerContext = { uid: string; userEmail: string | null; familyId: string };

async function requireOwnerContext(): Promise<OwnerContext> {
  const authz = getRequestHeader("authorization");
  if (!authz || !authz.startsWith("Bearer ")) throw new Error("Not authenticated");
  const { data, error } = await supabaseAdmin.auth.getUser(authz.slice(7));
  const uid = data?.user?.id;
  if (error || !uid) throw new Error("Not authenticated");

  // Pick the active family (header if the user is a member of it, else first).
  const requested = getRequestHeader("x-active-family");
  let familyId: string | null = null;
  if (requested) {
    const { data: active } = await supabaseAdmin
      .from("family_members")
      .select("family_id")
      .eq("user_id", uid)
      .eq("family_id", requested)
      .maybeSingle();
    familyId = active?.family_id ?? null;
  }
  if (!familyId) {
    const { data: m } = await supabaseAdmin
      .from("family_members")
      .select("family_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    familyId = m?.family_id ?? null;
  }
  if (!familyId) throw new Error("No family context");

  const { data: membership } = await supabaseAdmin
    .from("family_members")
    .select("role")
    .eq("user_id", uid)
    .eq("family_id", familyId)
    .maybeSingle();
  if (membership?.role !== "owner") throw new Error("Only the owner can manage parents");

  return { uid, userEmail: data?.user?.email ?? null, familyId };
}

async function familyName(familyId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("families")
    .select("name")
    .eq("id", familyId)
    .maybeSingle();
  return data?.name ?? "din familj";
}

// --- email -----------------------------------------------------------------

function inviteEmailHtml(opts: { inviter: string; family: string; link: string }): string {
  const { inviter, family, link } = opts;
  return `<!doctype html>
<html lang="sv">
  <body style="margin:0;background:#fff7ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:40px;text-align:center;">☀️</div>
      <h1 style="font-size:22px;text-align:center;margin:12px 0 4px;">Du har blivit inbjuden!</h1>
      <p style="font-size:15px;line-height:1.6;text-align:center;color:#4b5563;">
        ${escapeHtml(inviter)} har bjudit in dig att hjälpa till att hantera familjen
        <strong>${escapeHtml(family)}</strong> i Min Sommar.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:9999px;font-size:15px;">
          Acceptera inbjudan
        </a>
      </div>
      <p style="font-size:13px;line-height:1.6;text-align:center;color:#9ca3af;">
        Länken gäller i ${INVITE_TTL_DAYS} dagar. Fungerar inte knappen? Klistra in den här länken i webbläsaren:<br />
        <span style="word-break:break-all;color:#6b7280;">${link}</span>
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendInviteEmail(opts: {
  to: string;
  inviter: string;
  family: string;
  link: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  const from = process.env.RESEND_FROM || "Min Sommar <noreply@minsommar.se>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: `Inbjudan till ${opts.family} i Min Sommar`,
      html: inviteEmailHtml({ inviter: opts.inviter, family: opts.family, link: opts.link }),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email send failed: ${res.status} ${detail}`);
  }
}

function inviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/invite/${token}`;
}

// --- public entry points ----------------------------------------------------

export async function createAndSendInvite(rawEmail: string, origin: string): Promise<void> {
  const ctx = await requireOwnerContext();
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new Error("Invalid email address");

  // Already a member? (family_members.user_id and profiles.id both reference
  // auth.users with no FK between them, so resolve the profile by email first,
  // then check membership — PostgREST can't embed the two.)
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (prof) {
    const { data: existingMember } = await supabaseAdmin
      .from("family_members")
      .select("id")
      .eq("family_id", ctx.familyId)
      .eq("user_id", prof.id)
      .maybeSingle();
    if (existingMember) throw new Error("Den här personen är redan med i familjen.");
  }

  // Existing pending invite? (the unique index also guarantees this.)
  const { data: pending } = await supabaseAdmin
    .from("family_invites")
    .select("id")
    .eq("family_id", ctx.familyId)
    .eq("status", "pending")
    .ilike("email", email)
    .maybeSingle();
  if (pending) throw new Error("Det finns redan en väntande inbjudan till den adressen.");

  const token = generateToken();
  const { error } = await supabaseAdmin.from("family_invites").insert({
    family_id: ctx.familyId,
    email,
    token_hash: hashToken(token),
    invited_by: ctx.uid,
    expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString(),
  });
  if (error) {
    // Unique-index race on (family_id, lower(email)) WHERE pending.
    if (error.code === "23505") {
      throw new Error("Det finns redan en väntande inbjudan till den adressen.");
    }
    throw error;
  }

  await sendInviteEmail({
    to: email,
    inviter: ctx.userEmail ?? "En förälder",
    family: await familyName(ctx.familyId),
    link: inviteLink(origin, token),
  });
}

export async function resendInvite(inviteId: string, origin: string): Promise<void> {
  const ctx = await requireOwnerContext();
  const { data: invite } = await supabaseAdmin
    .from("family_invites")
    .select("id, email, status")
    .eq("id", inviteId)
    .eq("family_id", ctx.familyId)
    .maybeSingle();
  if (!invite || invite.status !== "pending") throw new Error("Inbjudan kunde inte hittas.");

  // Fresh token + extended expiry; the old link stops working immediately.
  const token = generateToken();
  const { error } = await supabaseAdmin
    .from("family_invites")
    .update({
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString(),
    })
    .eq("id", inviteId);
  if (error) throw error;

  await sendInviteEmail({
    to: invite.email,
    inviter: ctx.userEmail ?? "En förälder",
    family: await familyName(ctx.familyId),
    link: inviteLink(origin, token),
  });
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const ctx = await requireOwnerContext();
  const { error } = await supabaseAdmin
    .from("family_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("family_id", ctx.familyId)
    .eq("status", "pending");
  if (error) throw error;
}
