import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { hasSeenNotice, markNoticeSeen } from "@/lib/notices";

// A light, non-blocking banner shown once per user. Dismissed (forever) by the
// close button or by triggering its action. Generic so more notices can reuse it.
export function OneTimeNotice({
  id,
  userId,
  emoji = "✨",
  title,
  body,
  actionLabel,
  onAction,
}: {
  id: string;
  userId: string | null;
  emoji?: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  // Decide visibility after mount (localStorage read) to avoid an SSR flash.
  useEffect(() => {
    setVisible(!hasSeenNotice(id, userId));
  }, [id, userId]);

  if (!visible) return null;

  const dismiss = () => {
    markNoticeSeen(id, userId);
    setVisible(false);
  };

  const handleAction = () => {
    dismiss();
    onAction?.();
  };

  return (
    <div className="relative mb-5 rounded-2xl bg-gradient-to-br from-sun-soft to-peach-soft p-4 shadow-sm">
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-white/60"
        aria-label="Stäng"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">
        <div className="text-sm font-bold">
          {emoji} {title}
        </div>
        <p className="mt-1 text-sm text-foreground/80">{body}</p>
        {actionLabel && (
          <button
            onClick={handleAction}
            className="mt-3 inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
