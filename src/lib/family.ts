// Tracks which family is "active" for the current user.
//
// Until Supabase Auth is added, this lives in localStorage. When auth arrives,
// replace the body of these helpers with a session/profile lookup — call sites
// (db.ts, onboarding, the start page) only depend on these three functions, so
// nothing else has to change.

const STORAGE_KEY = "sommar.family_id";

export function getCurrentFamilyId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setCurrentFamilyId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}

export function clearCurrentFamilyId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
