import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { redeemFamilyToken } from "@/lib/db";
import { setCurrentFamilyId } from "@/lib/family";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/f/$token")({
  component: FamilyLinkPage,
});

// Child entry point: validates the secure family token, stores the family
// locally, then sends the child to the start page. After this the child never
// needs the long link again.
function FamilyLinkPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "invalid">("checking");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const familyId = await redeemFamilyToken(token);
        if (!active) return;
        if (familyId) {
          setCurrentFamilyId(familyId);
          navigate({ to: "/", replace: true });
        } else {
          setStatus("invalid");
        }
      } catch {
        if (active) setStatus("invalid");
      }
    })();
    return () => {
      active = false;
    };
  }, [token, navigate]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
      {status === "checking" ? (
        <>
          <div className="h-12 w-12 animate-pulse rounded-full bg-white/70" />
          <p className="mt-4 text-sm text-muted-foreground">Öppnar din familj...</p>
        </>
      ) : (
        <div className="card-soft p-8">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-3 text-2xl">Länken fungerar inte</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Länken kan ha bytts ut eller blivit ogiltig. Be en förälder om en ny familjelänk.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow"
          >
            Förälder? Logga in
          </Link>
        </div>
      )}
    </main>
  );
}
