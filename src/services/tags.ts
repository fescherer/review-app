import * as images from "../db/images";
import * as reviewsDb from "../db/reviews";
import * as db from "../db/tags";
import { newId, nowIso, uniqueSlug } from "../lib/util";
import type { ID, Tag } from "../types";
import { ensureDir, joinRel, moveDir, removePath } from "./fileSystem";
import { nameSchema, validate, ValidationError } from "./validation";

export const REVIEWS_DIR = "reviews";
export const DEFAULT_TAGS = ["Anime", "Book", "Movie", "Series", "Game", "Manga"];

export const tagFolder = (tag: Pick<Tag, "slug">) => joinRel(REVIEWS_DIR, tag.slug);

export const listTags = db.allTags;

export async function getTag(id: ID): Promise<Tag> {
  const tag = await db.tagById(id);
  if (!tag) throw new Error("Tag not found.");
  return tag;
}

async function checkName(name: string, exceptId?: ID): Promise<{ name: string; slug: string }> {
  const clean = validate(nameSchema, name);
  const others = (await db.allTags()).filter((t) => t.id !== exceptId);
  if (others.some((t) => t.name.toLowerCase() === clean.toLowerCase())) {
    throw new ValidationError(`A tag named "${clean}" already exists.`);
  }
  return { name: clean, slug: uniqueSlug(clean, others.map((t) => t.slug)) };
}

export async function createTag(name: string): Promise<Tag> {
  const { name: clean, slug } = await checkName(name);
  const tag = { id: newId(), name: clean, slug, createdAt: nowIso() };
  await ensureDir(tagFolder(tag));
  await db.insertTag(tag);
  return { ...tag, reviewCount: 0 };
}

/** Renames the tag and its folder, then rewrites every stored image path under it. */
export async function renameTag(id: ID, name: string): Promise<void> {
  const tag = await getTag(id);
  const { name: clean, slug } = await checkName(name, id);
  if (slug !== tag.slug) {
    const from = tagFolder(tag);
    const to = tagFolder({ slug });
    await moveDir(from, to);
    await ensureDir(to);
    await images.replacePathPrefix(from + "/", to + "/");
  }
  await db.updateTag(id, clean, slug);
}

/** Deletes a tag. If it has reviews, `moveToTagId` is required and the reviews (and their folders) move there. */
export async function deleteTag(id: ID, moveToTagId?: ID): Promise<void> {
  const tag = await getTag(id);
  if (tag.reviewCount > 0) {
    if (!moveToTagId || moveToTagId === id) {
      throw new ValidationError(`"${tag.name}" has ${tag.reviewCount} review(s). Move them to another tag first.`);
    }
    const target = await getTag(moveToTagId);
    const from = tagFolder(tag);
    const to = tagFolder(target);
    for (const reviewId of await reviewsDb.reviewIdsByTag(id)) {
      await moveDir(joinRel(from, reviewId), joinRel(to, reviewId));
      await reviewsDb.setReviewTag(reviewId, target.id);
    }
    await images.replacePathPrefix(from + "/", to + "/");
  }
  await db.deleteTag(id);
  await removePath(tagFolder(tag));
}

export async function seedDefaultTags(): Promise<void> {
  if ((await db.allTags()).length > 0) return;
  for (const name of DEFAULT_TAGS) await createTag(name);
}
