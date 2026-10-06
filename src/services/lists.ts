import * as images from "../db/images";
import * as itemsDb from "../db/listItems";
import * as db from "../db/lists";
import { newId, nowIso, uniqueSlug } from "../lib/util";
import type { ID, MediaList } from "../types";
import { ensureDir, joinRel, moveDir, removePath } from "./fileSystem";
import { nameSchema, validate, ValidationError } from "./validation";

export const LISTS_DIR = "lists";

export const listFolder = (list: Pick<MediaList, "slug">) => joinRel(LISTS_DIR, list.slug);

export const listLists = db.allLists;

export async function getList(id: ID): Promise<MediaList> {
  const list = await db.listById(id);
  if (!list) throw new Error("List not found.");
  return list;
}

async function checkName(name: string, exceptId?: ID): Promise<{ name: string; slug: string }> {
  const clean = validate(nameSchema, name);
  const others = (await db.allLists()).filter((l) => l.id !== exceptId);
  if (others.some((l) => l.name.toLowerCase() === clean.toLowerCase())) {
    throw new ValidationError(`A list named "${clean}" already exists.`);
  }
  return { name: clean, slug: uniqueSlug(clean, others.map((l) => l.slug)) };
}

export async function createList(name: string): Promise<MediaList> {
  const { name: clean, slug } = await checkName(name);
  const list = { id: newId(), name: clean, slug, createdAt: nowIso() };
  await ensureDir(listFolder(list));
  await db.insertList(list);
  return { ...list, itemCount: 0 };
}

/** Renames the list and its folder, then rewrites every stored image path under it. */
export async function renameList(id: ID, name: string): Promise<void> {
  const list = await getList(id);
  const { name: clean, slug } = await checkName(name, id);
  if (slug !== list.slug) {
    const from = listFolder(list);
    const to = listFolder({ slug });
    await moveDir(from, to);
    await ensureDir(to);
    await images.replacePathPrefix(from + "/", to + "/");
  }
  await db.updateList(id, clean, slug);
}

/** Deletes the list, all of its items and its folder (with every image in it). */
export async function deleteList(id: ID): Promise<void> {
  const list = await getList(id);
  for (const item of await itemsDb.itemsOfList(id)) {
    await images.deleteImagesOf("list_item", item.id);
    await itemsDb.deleteListItem(item.id);
  }
  await db.deleteList(id);
  await removePath(listFolder(list));
}
