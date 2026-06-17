import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

// Standard TanStack Start + Nitro setup (migrated off @lovable.dev/vite-tanstack-config).
//
// Nitro is the deployment adapter: it turns the TanStack Start build into a
// host-specific artifact. With no explicit `preset`, Nitro auto-detects the
// target from the environment:
//   - On Vercel (VERCEL/NOW_BUILDER env set) -> `vercel` preset -> emits
//     `.vercel/output` (Build Output API v3: serverless function + static
//     assets + routing). This is what Vercel serves; without it you get 404s.
//   - Locally / generic CI -> `node-server` preset (a runnable Node server).
export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Prevent server-only code from leaking into the client bundle.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      // Route TanStack Start's bundled server entry through src/server.ts
      // (our SSR error wrapper). Nitro builds the deployment artifact from this.
      server: { entry: "server" },
    }),
    nitro({ defaultPreset: "node-server" }),
    viteReact(),
  ],
  resolve: {
    // Avoid duplicate copies of these in mixed client/server bundles.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
});
