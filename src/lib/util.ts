export const newId = (): string => crypto.randomUUID();

/** Short random token for file names. */
export const shortId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

export const nowIso = (): string => new Date().toISOString();

/** Today's date in local time, YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/;

/** Folder-safe slug: "Séries & Shows" -> "series-shows". */
export function slugify(name: string): string {
  let slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  if (!slug) slug = "untitled";
  if (WINDOWS_RESERVED.test(slug)) slug += "-1";
  return slug;
}

export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(name);
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Grade 0–10 to star count 0–5 (half steps). */
export const gradeToStars = (grade: number): number => grade / 2;
