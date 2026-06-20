import { createMiddleware } from "@tanstack/react-start";
import { getCurrentFamilyId } from "@/lib/family";

// Names the active family on every server-fn RPC via the `x-active-family`
// header. The server honors it only after verifying membership (see
// resolveFamilyId / requireOwnerContext), so it cannot be used to reach a family
// the caller doesn't belong to — it only disambiguates between the caller's own
// families when they belong to more than one.
//
// Must be registered as a global `functionMiddleware` in `src/start.ts`.
export const attachActiveFamily = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const familyId = getCurrentFamilyId();
    return next({
      headers: familyId ? { "x-active-family": familyId } : {},
    });
  },
);
