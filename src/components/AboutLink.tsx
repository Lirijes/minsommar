import { Link, useLocation } from "@tanstack/react-router";

/**
 * A small, discreet "read more" text link to the "Om Sommar" page.
 * Rendered once from the root so it sits at the bottom of every screen —
 * onboarding, login/registrering and the authenticated views alike. Hides
 * itself while already on the about page.
 */
export function AboutLink() {
  const { pathname } = useLocation();
  if (pathname === "/om-sommar") return null;

  return (
    <div className="flex justify-center px-5 pb-8 pt-2">
      <Link
        to="/om-sommar"
        className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
      >
        Om Min Sommar →
      </Link>
    </div>
  );
}
