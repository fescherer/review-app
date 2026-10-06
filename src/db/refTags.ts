import type { ID, RefTag } from "../types";
import { execute, select } from "./client";

interface RefTagRow {
  id: string;
  name: string;
  created_at: string;
  ref_count: number;
}

const toTag = (r: RefTagRow): RefTag => ({ id: r.id, name: r.name, createdAt: r.created_at, refCount: r.ref_count });

export async function allRefTags(): Promise<RefTag[]> {
  const rows = await select<RefTagRow>(
    `SELECT t.*, (SELECT COUNT(*) FROM ref_tag_links l WHERE l.tag_id = t.id) AS ref_count
     FROM ref_tags t ORDER BY t.name COLLATE NOCASE`,
  );
  return rows.map(toTag);
}

export async function insertRefTag(tag: Omit<RefTag, "refCount">): Promise<void> {
  await execute("INSERT INTO ref_tags (id, name, created_at) VALUES ($1, $2, $3)", [tag.id, tag.name, tag.createdAt]);
}

export async function renameRefTag(id: ID, name: string): Promise<void> {
  await execute("UPDATE ref_tags SET name = $2 WHERE id = $1", [id, name]);
}

/** Moves every link of `fromId` to `intoId`, then deletes `fromId`. */
export async function mergeRefTags(fromId: ID, intoId: ID): Promise<void> {
  await execute(
    `INSERT OR IGNORE INTO ref_tag_links (ref_id, tag_id) SELECT ref_id, $2 FROM ref_tag_links WHERE tag_id = $1`,
    [fromId, intoId],
  );
  await deleteRefTag(fromId);
}

export async function deleteRefTag(id: ID): Promise<void> {
  await execute("DELETE FROM ref_tag_links WHERE tag_id = $1", [id]);
  await execute("DELETE FROM ref_tags WHERE id = $1", [id]);
}
