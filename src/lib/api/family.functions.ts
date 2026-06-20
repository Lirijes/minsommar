import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Thin RPC wrappers around the server-only family-session module. The handler
// bodies dynamically import the .server module so the service-role client and
// cookie logic never reach the client bundle. The browser's auth middleware
// attaches the parent's Bearer token; children rely on the signed cookie.

const SERVER = () => import("@/integrations/supabase/family-session.server");
const INVITES = () => import("@/integrations/supabase/family-invite.server");

const childId = z.object({ childId: z.string().uuid() });
const id = z.object({ id: z.string().uuid() });

// --- parent invitations (owner-only; enforced server-side) ------------------
export const sfSendFamilyInvite = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), origin: z.string().url() }))
  .handler(async ({ data }) => {
    await (await INVITES()).createAndSendInvite(data.email, data.origin);
  });

export const sfResendFamilyInvite = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), origin: z.string().url() }))
  .handler(async ({ data }) => {
    await (await INVITES()).resendInvite(data.id, data.origin);
  });

export const sfRevokeFamilyInvite = createServerFn({ method: "POST" })
  .inputValidator(id)
  .handler(async ({ data }) => {
    await (await INVITES()).revokeInvite(data.id);
  });

export const startChildSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(1) }))
  .handler(async ({ data }) => {
    const m = await SERVER();
    return { familyId: await m.startChildSession(data.token) };
  });

// --- reads ---
export const sfListChildren = createServerFn({ method: "POST" }).handler(async () =>
  (await SERVER()).listChildren(),
);

export const sfGetChildByName = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => (await SERVER()).getChildByName(data.name));

export const sfListCategories = createServerFn({ method: "POST" }).handler(async () =>
  (await SERVER()).listCategories(),
);

export const sfListActivities = createServerFn({ method: "POST" }).handler(async () =>
  (await SERVER()).listActivities(),
);

export const sfFamilySettings = createServerFn({ method: "POST" }).handler(async () =>
  (await SERVER()).familySettings(),
);

export const sfListRewards = createServerFn({ method: "POST" }).handler(async () =>
  (await SERVER()).listRewards(),
);

export const sfChildPoints = createServerFn({ method: "POST" })
  .inputValidator(childId)
  .handler(async ({ data }) => (await SERVER()).childPoints(data.childId));

export const sfCompletionsForDate = createServerFn({ method: "POST" })
  .inputValidator(z.object({ childId: z.string().uuid(), date: z.string() }))
  .handler(async ({ data }) => (await SERVER()).completionsForDate(data.childId, data.date));

export const sfAllCompletions = createServerFn({ method: "POST" })
  .inputValidator(childId)
  .handler(async ({ data }) => (await SERVER()).allCompletions(data.childId));

export const sfBucketItems = createServerFn({ method: "POST" })
  .inputValidator(childId)
  .handler(async ({ data }) => (await SERVER()).bucketItems(data.childId));

// --- writes ---
export const sfAddCompletion = createServerFn({ method: "POST" })
  .inputValidator(z.object({ childId: z.string().uuid(), activityId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await (await SERVER()).addCompletion(data.childId, data.activityId);
  });

export const sfRemoveCompletion = createServerFn({ method: "POST" })
  .inputValidator(id)
  .handler(async ({ data }) => {
    await (await SERVER()).removeCompletion(data.id);
  });

export const sfToggleFavorite = createServerFn({ method: "POST" })
  .inputValidator(z.object({ activityId: z.string().uuid(), value: z.boolean() }))
  .handler(async ({ data }) => {
    await (await SERVER()).toggleFavorite(data.activityId, data.value);
  });

export const sfAddBucketItem = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ childId: z.string().uuid(), title: z.string().min(1), emoji: z.string() }),
  )
  .handler(async ({ data }) => {
    await (await SERVER()).addBucketItem(data.childId, data.title, data.emoji);
  });

export const sfAddBucketItems = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      childId: z.string().uuid(),
      items: z.array(z.object({ title: z.string().min(1), emoji: z.string() })),
    }),
  )
  .handler(async ({ data }) => {
    await (await SERVER()).addBucketItems(data.childId, data.items);
  });

export const sfUpdateBucketItem = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), title: z.string().min(1), emoji: z.string() }))
  .handler(async ({ data }) => {
    await (await SERVER()).updateBucketItem(data.id, data.title, data.emoji);
  });

export const sfDeleteBucketItem = createServerFn({ method: "POST" })
  .inputValidator(id)
  .handler(async ({ data }) => {
    await (await SERVER()).deleteBucketItem(data.id);
  });

export const sfSetBucketItemDone = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid(), done: z.boolean() }))
  .handler(async ({ data }) => {
    await (await SERVER()).setBucketItemDone(data.id, data.done);
  });
