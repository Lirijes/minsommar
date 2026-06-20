// Central, easy-to-edit metadata for the "Om Sommar" page and footer.
// Everything here is a PLACEHOLDER — swap in the real values later without
// touching any UI code.

/** Bump as the app evolves. Shown in the footer. */
export const APP_VERSION = "1.0.0";

/** Developer presentation. Replace name/bio/avatar/links with the real ones. */
export const DEVELOPER = {
  name: "Lirije Shabani",
  role: "Fullstack Utvecklare",
  bio: "Jag skapade Min Sommar för mina egna barn. Målet var att inspirera dem att lägga undan skärmen och istället upptäcka roliga, enkla aktiviteter som de flesta barn kan göra själva. Jag hoppas att appen kan hjälpa fler familjer att få ut lite mer av sommarlovet.",
  // Leave empty ("") to show a friendly placeholder-avatar instead of a photo.
  avatarUrl: "",
  email: "lirije11@hotmail.com",
  links: {
    linkedin: "https://www.linkedin.com/in/lirijes",
    portfolio: "https://liri-dev.vercel.app/",
    // Set to "" to hide the GitHub link entirely.
    github: "https://github.com/lirijes",
  },
} as const;
