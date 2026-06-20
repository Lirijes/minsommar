import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Github, Globe, Linkedin, Mail, MessageCircleHeart } from "lucide-react";
import { APP_VERSION, DEVELOPER } from "@/lib/site";

export const Route = createFileRoute("/om-sommar")({
  component: AboutPage,
});

function AboutPage() {
  const router = useRouter();

  // Go back if we have history, otherwise fall back to the start page so the
  // page works even when opened directly (e.g. from login/onboarding).
  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };

  const feedbackMailto = `mailto:${DEVELOPER.email}?subject=${encodeURIComponent(
    "Feedback om Min Sommar",
  )}`;
  const contactMailto = `mailto:${DEVELOPER.email}?subject=${encodeURIComponent(
    "Hej från Min Sommar",
  )}`;

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-16 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={goBack}
          aria-label="Tillbaka"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/80 shadow-sm transition hover:scale-105"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl">Om Min Sommar</h1>
      </div>

      {/* Hero */}
      <section className="card-soft mb-6 p-6 text-center">
        <div className="text-5xl">☀️</div>
        <h2 className="mt-3 text-3xl">Min Sommar</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Inspirerar barn att lägga undan skärmen och upptäcka roliga, enkla aktiviteter under sommarlovet.
        </p>
      </section>

      {/* Om Min Sommar */}
      <section className="card-soft mb-6 p-6">
        <h3 className="text-lg">Vad är Min Sommar?</h3>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li className="flex gap-3">
            <span aria-hidden className="text-lg">🌞</span>
            <span>
              Min Sommar hjälper barn att hitta roliga och enkla aktiviteter som de flesta kan göra på egen hand.
            </span>
          </li>

          <li className="flex gap-3">
            <span aria-hidden className="text-lg">🎯</span>
            <span>
              Barn kan upptäcka roliga aktiviteter, spara sina favoriter och samla genomförda aktiviteter under sommaren, allt för att inspireras till mer rörelse, lek och äventyr.
            </span>
          </li>

          <li className="flex gap-3">
            <span aria-hidden className="text-lg">❤️</span>
            <span>
              Tanken är att det ska vara enkelt, inga stora projekt eller avancerad planering, bara små idéer som kan göra sommarlovet lite roligare.
            </span>
          </li>
        </ul>
      </section>

      {/* Om utvecklaren */}
      <section className="card-soft mb-6 p-6">
        <h3 className="text-lg">Bakom Min Sommar</h3>

        <div className="mt-4 flex items-center gap-4">
          <Avatar name={DEVELOPER.name} src={DEVELOPER.avatarUrl} />
          <div className="min-w-0">
            <div className="text-base font-bold text-foreground">{DEVELOPER.name}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {DEVELOPER.role}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{DEVELOPER.bio}</p>

        {/* Links */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <SocialLink href={DEVELOPER.links.linkedin} icon={Linkedin} label="LinkedIn" />
          <SocialLink href={DEVELOPER.links.portfolio} icon={Globe} label="Portfolio" />
          {DEVELOPER.links.github && (
            <SocialLink href={DEVELOPER.links.github} icon={Github} label="GitHub" />
          )}
        </div>

        <a
          href={contactMailto}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground shadow transition active:scale-95"
        >
          <Mail className="h-4 w-4" />
          Kontakta mig
        </a>
      </section>

      {/* Feedback */}
      <section className="card-soft mb-6 bg-mint-soft/60 p-6">
        <div className="flex items-center gap-2">
          <MessageCircleHeart className="h-5 w-5 text-mint" />
          <h3 className="text-lg">Har du en idé?</h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Min Sommar utvecklas hela tiden. Har du hittat en bugg eller kommit på en funktion som skulle göra appen ännu bättre? Jag tar gärna emot dina tankar!
        </p>
        <a
          href={feedbackMailto}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/70 px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-white"
        >
          <Mail className="h-4 w-4" />
          Skicka feedback
        </a>
      </section>

      {/* Footer */}
      <footer className="mt-8 space-y-1 text-center text-xs text-muted-foreground">
        <p>Skapad för att inspirera till fler äventyr och mindre skärmtid.</p>
        <p>
          © Min Sommar · v{APP_VERSION}
        </p>
      </footer>
    </main>
  );
}

/** Photo avatar, or a friendly gradient placeholder with the initials. */
function Avatar({ name, src }: { name: string; src: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-inner"
      />
    );
  }

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sun-soft to-turquoise-soft text-xl font-bold text-foreground shadow-inner">
      {initials || "🙂"}
    </div>
  );
}

function SocialLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Linkedin;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white/70 px-3 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-white"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </a>
  );
}
