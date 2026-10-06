import type { DefaultImage } from "../types";
import { joinRel, pathExists, writeText } from "./fileSystem";

// Placeholder covers bundled into the app and copied into <root>/defaults/ on setup.
const files = import.meta.glob<string>("../assets/defaults/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

const LABELS: Record<string, string> = {
  anime: "Anime",
  book: "Book",
  game: "Game",
  manga: "Manga",
  movie: "Movie",
  series: "Series",
  generic: "Generic",
};

export const DEFAULTS_DIR = "defaults";

const bundled = Object.entries(files)
  .map(([file, svg]) => {
    const name = file.split("/").pop()!;
    const stem = name.replace(/\.svg$/, "");
    return { name, svg, image: { path: joinRel(DEFAULTS_DIR, name), label: LABELS[stem] ?? stem } };
  })
  .sort((a, b) => (a.name === "generic.svg" ? 1 : b.name === "generic.svg" ? -1 : a.name.localeCompare(b.name)));

export const DEFAULT_IMAGES: DefaultImage[] = bundled.map((b) => b.image);

export const isDefaultImagePath = (path: string): boolean => path.startsWith(`${DEFAULTS_DIR}/`);

/** Picks a sensible placeholder for a tag name, e.g. "Anime" -> defaults/anime.svg. */
export function defaultImageForName(name: string): DefaultImage {
  const key = name.toLowerCase();
  return (
    DEFAULT_IMAGES.find((d) => key.includes(d.label.toLowerCase())) ??
    DEFAULT_IMAGES.find((d) => d.path.endsWith("generic.svg")) ??
    DEFAULT_IMAGES[0]
  );
}

/** Writes any missing placeholder into defaults/ (never overwrites user changes). */
export async function installDefaultImages(): Promise<void> {
  for (const b of bundled) {
    if (!(await pathExists(b.image.path))) await writeText(b.image.path, b.svg);
  }
}
