import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

// Layout route for /child/$name. Renders the matched child route
// (index = activities, plus favorites/calendar/history/bucketlist) via <Outlet />.
export const Route = createFileRoute("/child/$name")({
  component: () => <Outlet />,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p>Barnet hittades inte.</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">
        Tillbaka
      </Link>
    </div>
  ),
});
