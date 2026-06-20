// One-time notices (small dismissible banners). Whether a notice has been seen
// is stored in localStorage, scoped per signed-in user so a shared browser never
// hides a notice meant for a different parent.
//
// Ids follow a versioned "whats-new-vN" convention: when a major feature ships,
// bump to the next version (e.g. "whats-new-v2") and update the notice's content
// so every user sees it once again. Nothing else here needs to change.

const PREFIX = "sommar.notice";

function key(id: string, userId: string | null): string {
  return userId ? `${PREFIX}:${id}:${userId}` : `${PREFIX}:${id}`;
}

export function hasSeenNotice(id: string, userId: string | null): boolean {
  // On the server (SSR) assume seen, so the banner never flashes before hydration.
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(key(id, userId)) === "1";
}

export function markNoticeSeen(id: string, userId: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(id, userId), "1");
}
