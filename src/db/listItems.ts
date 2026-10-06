import type { ID, ListItem } from "../types";
import { execute, select } from "./client";
import { imagesByOwner } from "./images";

interface ListItemRow {
  id: string;
  list_id: string;
  title: string;
  added_date: string;
  description: string;
  created_at: string;
  updated_at: string;
}

async function withImages(rows: ListItemRow[]): Promise<ListItem[]> {
  const images = await imagesByOwner("list_item", rows.length > 200 ? undefined : rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    listId: r.list_id,
    title: r.title,
    addedDate: r.added_date,
    description: r.description,
    images: images.get(r.id) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function itemsOfList(listId: ID): Promise<ListItem[]> {
  return withImages(await select<ListItemRow>("SELECT * FROM list_items WHERE list_id = $1", [listId]));
}

export async function allListItems(): Promise<ListItem[]> {
  return withImages(await select<ListItemRow>("SELECT * FROM list_items ORDER BY list_id, added_date"));
}

export async function listItemById(id: ID): Promise<ListItem | null> {
  const rows = await select<ListItemRow>("SELECT * FROM list_items WHERE id = $1", [id]);
  return rows.length ? (await withImages(rows))[0] : null;
}

export async function insertListItem(i: Omit<ListItem, "images">): Promise<void> {
  await execute(
    `INSERT INTO list_items (id, list_id, title, added_date, description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [i.id, i.listId, i.title, i.addedDate, i.description, i.createdAt, i.updatedAt],
  );
}

export async function updateListItem(i: Omit<ListItem, "images" | "createdAt">): Promise<void> {
  await execute(
    `UPDATE list_items SET list_id = $2, title = $3, added_date = $4, description = $5, updated_at = $6 WHERE id = $1`,
    [i.id, i.listId, i.title, i.addedDate, i.description, i.updatedAt],
  );
}

export async function deleteListItem(id: ID): Promise<void> {
  await execute("DELETE FROM list_items WHERE id = $1", [id]);
}
