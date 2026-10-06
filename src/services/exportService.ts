import { getVersion } from "@tauri-apps/api/app";
import { allListItems } from "../db/listItems";
import { allReferences } from "../db/references";
import { allRefTags } from "../db/refTags";
import { allLists } from "../db/lists";
import { allReviews } from "../db/reviews";
import { allTags } from "../db/tags";
import { ensureDir, joinRel, toAbs, writeText } from "./fileSystem";

export const EXPORTS_DIR = "exports";

/** Dumps every record to <root>/exports/media-backup-<timestamp>.json. Returns the absolute file path. */
export async function exportAll(): Promise<string> {
  const [tags, reviews, lists, items, refTags, references] = await Promise.all([
    allTags(),
    allReviews(),
    allLists(),
    allListItems(),
    allRefTags(),
    allReferences(),
  ]);
  const refTagName = new Map(refTags.map((t) => [t.id, t.name]));
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const listName = new Map(lists.map((l) => [l.id, l.name]));

  const data = {
    format: "media-review-backup",
    version: 1,
    appVersion: await getVersion().catch(() => "unknown"),
    exportedAt: new Date().toISOString(),
    note: "Image paths are relative to the data folder.",
    tags: tags.map(({ reviewCount: _, ...t }) => t),
    reviews: reviews.map((r) => ({ ...r, tag: tagName.get(r.tagId) ?? null, stars: r.grade / 2 })),
    lists: lists.map(({ itemCount: _, ...l }) => l),
    listItems: items.map((i) => ({ ...i, list: listName.get(i.listId) ?? null })),
    referenceTags: refTags.map(({ refCount: _, ...t }) => t),
    references: references.map(({ textPreview: _, ...r }) => ({
      ...r,
      path: `references/${r.fileName}`,
      tags: r.tagIds.map((id) => refTagName.get(id)).filter(Boolean),
    })),
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const rel = joinRel(EXPORTS_DIR, `media-backup-${stamp}.json`);
  await ensureDir(EXPORTS_DIR);
  await writeText(rel, JSON.stringify(data, null, 2));
  return toAbs(rel);
}
