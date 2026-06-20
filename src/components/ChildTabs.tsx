import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFamilySettings } from "@/lib/db";

type Tab = "activities" | "favorites" | "bucketlist" | "rewards";

const TABS: { key: Tab; icon: string; label: string; to: string }[] = [
  { key: "activities", icon: "📝", label: "Aktiviteter", to: "/child/$name" },
  { key: "favorites", icon: "⭐", label: "Favoriter", to: "/child/$name/favorites" },
  { key: "bucketlist", icon: "🏖️", label: "Sommarbucketlist", to: "/child/$name/bucketlist" },
  { key: "rewards", icon: "🎁", label: "Belöningar", to: "/child/$name/rewards" },
];

export function ChildTabs({ name, active }: { name: string; active: Tab }) {
  // Gate the rewards tab on the family's optional points system, in one place.
  const settingsQ = useQuery({ queryKey: ["family-settings"], queryFn: fetchFamilySettings });
  const pointsEnabled = settingsQ.data?.points_enabled ?? false;
  const tabs = TABS.filter((t) => t.key !== "rewards" || pointsEnabled);

  return (
    <nav className="mb-5 flex gap-1.5 rounded-2xl bg-white/70 p-1.5 shadow-sm">
      {tabs.map((t) => {
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
