import { Link } from "@tanstack/react-router";

type Tab = "activities" | "favorites" | "bucketlist";

const TABS: { key: Tab; icon: string; label: string; to: string }[] = [
  { key: "activities", icon: "📝", label: "Aktiviteter", to: "/child/$name" },
  { key: "favorites", icon: "⭐", label: "Favoriter", to: "/child/$name/favorites" },
  { key: "bucketlist", icon: "🏖️", label: "Sommarbucketlist", to: "/child/$name/bucketlist" },
];

export function ChildTabs({ name, active }: { name: string; active: Tab }) {
  return (
    <nav className="mb-5 flex gap-1.5 rounded-2xl bg-white/70 p-1.5 shadow-sm">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            to={t.to}
            params={{ name }}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 transition ${
              isActive
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-white"
            }`}
          >
            <span className="text-xl">{t.icon}</span>
            <span className="text-[11px] font-semibold">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
