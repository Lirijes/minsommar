---
name: multi-parent-deploy-config
description: Manual steps required to ship the multi-parent (invite co-parents) feature
metadata:
  type: project
---

Multi-parent support (invite co-parents to a family) was implemented 2026-06-20. Code is done; these MANUAL steps are required for it to work in each environment and are NOT in the repo:

1. **Apply migration** `supabase/migrations/20260620140000_multi_parent.sql` (needs the `pgcrypto` extension — created by the migration; standard on Supabase).
2. **Env vars** in hosting (prod + preview): `RESEND_API_KEY` and `RESEND_FROM` (default `Min Sommar <noreply@minsommar.se>`). Locally they live in `.env`; the Resend key is the same one already used for Supabase SMTP.
3. **Resend**: the domain in `RESEND_FROM` (minsommar.se) must be verified in Resend or invite emails won't deliver.
4. **Supabase dashboard → Auth → URL Configuration**: add `/invite/*` (and the deployed origins) to the redirect allow-list, otherwise the magic-link return to `/invite/<token>` is rejected.

Architecture note: a user can belong to multiple families. The active family is chosen client-side via `getCurrentFamilyId()` and sent on every server-fn call as the `x-active-family` header (see [[.]] family-attacher.ts), validated against membership server-side. Ownership transfer is intentionally NOT built yet — owner cannot leave/be removed until it is.
