import type { ID, MediaList } from "../types";
import { execute, select } from "./client";

interface ListRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  item_count: number;
}

const toList = (r: ListRow): MediaList => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  createdAt: r.created_at,
  itemCount: r.item_count,
});

const BASE = `SELECT l.*, (SELECT COUNT(*) FROM list_items i WHERE i.list_id = l.id) AS item_count FROM lists l`;

export async function allLists(): Promise<MediaList[]> {
  return (await select<ListRow>(`${BASE} ORDER BY l.name COLLATE NOCASE`)).map(toList);
}

export async function listById(id: ID): Promise<MediaList | null> {
  const rows = await select<ListRow>(`${BASE} WHERE l.id = $1`, [id]);
  return rows[0] ? toList(rows[0]) : null;
}

export async function insertList(list: Omit<MediaList, "itemCount">): Promise<void> {
  await execute("INSERT INTO lists (id, name, slug, created_at) VALUES ($1, $2, $3, $4)", [
    list.id,
    list.name,
    list.slug,
    list.createdAt,
  ]);
}

export async function updateList(id: ID, name: string, slug: string): Promise<void> {
  await execute("UPDATE lists SET name = $2, slug = $3 WHERE id = $1", [id, name, slug]);
}

export async function deleteList(id: ID): Promise<void> {
  await execute("DELETE FROM lists WHERE id = $1", [id]);
}
