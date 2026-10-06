import * as imagesDb from "../db/images";
import * as db from "../db/listItems";
import { newId, nowIso } from "../lib/util";
import type { ID, ListItem, ListItemInput, Review, ReviewInput } from "../types";
import { joinRel, removePath } from "./fileSystem";
import { deleteUnusedImageFiles, persistImages } from "./images";
import { getList, listFolder } from "./lists";
import { createReview } from "./reviews";
import { listItemInputSchema, validate } from "./validation";

export const itemsOfList = db.itemsOfList;

export async function getListItem(id: ID): Promise<ListItem> {
  const item = await db.listItemById(id);
  if (!item) throw new Error("List item not found.");
  return item;
}

async function itemFolder(listId: ID, itemId: ID): Promise<string> {
  return joinRel(listFolder(await getList(listId)), itemId);
}

export async function createListItem(input: ListItemInput): Promise<ListItem> {
  const data = validate(listItemInputSchema, input);
  const id = newId();
  const images = await persistImages(await itemFolder(data.listId, id), input.images);
  const now = nowIso();
  const item: ListItem = { id, ...data, images, createdAt: now, updatedAt: now };
  await db.insertListItem(item);
  await imagesDb.replaceImages("list_item", id, images);
  return item;
}

export async function updateListItem(id: ID, input: ListItemInput): Promise<ListItem> {
  const data = validate(listItemInputSchema, input);
  const previous = await getListItem(id);
  const oldFolder = await itemFolder(previous.listId, id);
  const folder = await itemFolder(data.listId, id);
  const images = await persistImages(folder, input.images);
  const updated: ListItem = { ...previous, ...data, images, updatedAt: nowIso() };
  await db.updateListItem(updated);
  await imagesDb.replaceImages("list_item", id, images);
  await deleteUnusedImageFiles(previous.images, images);
  if (oldFolder !== folder) await removePath(oldFolder).catch(() => undefined);
  return updated;
}

/** Deletes the item and its image folder. */
export async function deleteListItem(id: ID): Promise<void> {
  const item = await getListItem(id);
  const folder = await itemFolder(item.listId, id);
  await imagesDb.deleteImagesOf("list_item", id);
  await db.deleteListItem(id);
  await removePath(folder);
}

/**
 * "Mark as done": creates a review from the item (its images are moved into the review folder)
 * and removes the item from its list.
 */
export async function markAsDone(itemId: ID, review: ReviewInput): Promise<Review> {
  await getListItem(itemId);
  const created = await createReview(review);
  await deleteListItem(itemId);
  return created;
}
