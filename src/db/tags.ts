import type { ID, Tag } from "../types";
import { execute, select } from "./client";

interface TagRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  review_count: number;
}

const toTag = (r: TagRow): Tag => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  createdAt: r.created_at,
  reviewCount: r.review_count,
});

const BASE = `SELECT t.*, (SELECT COUNT(*) FROM reviews r WHERE r.tag_id = t.id) AS review_count FROM tags t`;

export async function allTags(): Promise<Tag[]> {
  return (await select<TagRow>(`${BASE} ORDER BY t.name COLLATE NOCASE`)).map(toTag);
}

export async function tagById(id: ID): Promise<Tag | null> {
  const rows = await select<TagRow>(`${BASE} WHERE t.id = $1`, [id]);
  return rows[0] ? toTag(rows[0]) : null;
}

export async function insertTag(tag: Omit<Tag, "reviewCount">): Promise<void> {
  await execute("INSERT INTO tags (id, name, slug, created_at) VALUES ($1, $2, $3, $4)", [
    tag.id,
    tag.name,
    tag.slug,
    tag.createdAt,
  ]);
}

export async function updateTag(id: ID, name: string, slug: string): Promise<void> {
  await execute("UPDATE tags SET name = $2, slug = $3 WHERE id = $1", [id, name, slug]);
}

export async function deleteTag(id: ID): Promise<void> {
  await execute("DELETE FROM tags WHERE id = $1", [id]);
}
