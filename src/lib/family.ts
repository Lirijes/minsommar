// Tracks which family is "active" for the current user.
//
// The cache is USER-SCOPED: parents store their family under
// `sommar.family_id:<auth.uid()>`, derived from the active Supabase session, so
// one authenticated user can never reuse another user's cached family on a
// shared browser. Children (no session, entered via /f/<token>) use a dedicated
// `sommar.family_id:child` scope.
//
// When Supabase Auth fully owns family resolution this can be replaced by a
// session/profile lookup; call sites only depend on the three exported helpers.

const BASE_KEY = "sommar.family_id";
const CHILD_KEY = `${BASE_KEY}:child`;

// Supabase persists its session under `sb-<ref>-auth-token` (ref = the
// hostname's first label). We read the uid synchronously to scope the key.
function supabaseRef(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return null;
  }
}

function currentUserId(): string | null {
  if (typeof window === "undefined") return null;
  const ref = supabaseRef();
  if (!ref) return null;
  try {
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user?.id ?? parsed?.currentSession?.user?.id ?? null;
  } catch {
    return null;
  }
}

// Key for the current context: the signed-in parent's uid, else child scope.
function familyKey(): string {
  const uid = currentUserId();
  return uid ? `${BASE_KEY}:${uid}` : CHILD_KEY;
}

export function getCurrentFamilyId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(familyKey());
}

export function setCurrentFamilyId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(familyKey(), id);
}

export function clearCurrentFamilyId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(familyKey());
}
