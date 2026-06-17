import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-soft max-w-md p-8 text-center">
        <div className="text-6xl">🌸</div>
        <h1 className="mt-4 text-3xl">Hoppsan!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sidan finns inte.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition hover:scale-105"
        >
          Tillbaka hem
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-soft max-w-md p-8 text-center">
        <div className="text-6xl">💔</div>
        <h1 className="mt-4 text-2xl">Något gick fel</h1>
        <p className="mt-2 text-sm text-muted-foreground">Försök igen om en stund.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition hover:scale-105"
        >
          Försök igen
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Min Sommar" },
      { name: "description", content: "En sommarapp där barn kan upptäcka aktiviteter, skapa egna mål och minska skärmtiden på ett lekfullt sätt." },
      { name: "theme-color", content: "#f8d9e6" },
      { property: "og:title", content: "Min Sommar" },
      { name: "twitter:title", content: "Min Sommar" },
      { property: "og:description", content: "En sommarapp där barn kan upptäcka aktiviteter, skapa egna mål och minska skärmtiden på ett lekfullt sätt." },
      { name: "twitter:description", content: "En sommarapp där barn kan upptäcka aktiviteter, skapa egna mål och minska skärmtiden på ett lekfullt sätt." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2d34e1ea-7f6c-4d81-98b8-2ee261ae7562/id-preview-5d0990ae--76c586dd-a2e7-4d0b-ba56-b869c0388d44.lovable.app-1781517279325.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2d34e1ea-7f6c-4d81-98b8-2ee261ae7562/id-preview-5d0990ae--76c586dd-a2e7-4d0b-ba56-b869c0388d44.lovable.app-1781517279325.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/sun-sunrise-svgrepo-com.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Quicksand:wght@600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
