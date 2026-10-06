import * as db from "../db/refTags";
import { newId, nowIso } from "../lib/util";
import type { ID, RefTag } from "../types";
import { nameSchema, validate, ValidationError } from "./validation";

// Reference tags exist only in the database; they never map to folders.

export const listRefTags = db.allRefTags;

/** Returns the existing tag with that name (case-insensitive) or creates it. */
export async function createRefTag(name: string): Promise<RefTag> {
  const clean = validate(nameSchema, name);
  const existing = (await db.allRefTags()).find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const tag = { id: newId(), name: clean, createdAt: nowIso() };
  await db.insertRefTag(tag);
  return { ...tag, refCount: 0 };
}

export async function renameRefTag(id: ID, name: string): Promise<void> {
  const clean = validate(nameSchema, name);
  const clash = (await db.allRefTags()).find((t) => t.id !== id && t.name.toLowerCase() === clean.toLowerCase());
  if (clash) throw new ValidationError(`A tag named "${clash.name}" already exists. Use Merge to combine them.`);
  await db.renameRefTag(id, clean);
}

/** Every reference tagged `fromId` gets `intoId` instead; `fromId` is deleted. */
export async function mergeRefTags(fromId: ID, intoId: ID): Promise<void> {
  if (fromId === intoId) throw new ValidationError("Pick a different tag to merge into.");
  await db.mergeRefTags(fromId, intoId);
}

/** Deletes the tag and removes it from all references. */
export const deleteRefTag = db.deleteRefTag;
