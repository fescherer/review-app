import type { ID, ImageOwnerType, MediaImage } from "../types";
import { execute, select } from "./client";

interface ImageRow {
  id: string;
  owner_id: string;
  path: string;
  thumbnail_path: string;
  is_cover: number;
  position: number;
}

const toImage = (r: ImageRow): MediaImage => ({
  id: r.id,
  path: r.path,
  thumbnailPath: r.thumbnail_path,
  isCover: !!r.is_cover,
  position: r.position,
});

/** Returns images grouped by owner id, ordered by position. Pass no ids to load every image of that owner type. */
export async function imagesByOwner(ownerType: ImageOwnerType, ownerIds?: ID[]): Promise<Map<ID, MediaImage[]>> {
  let rows: ImageRow[];
  if (ownerIds) {
    if (ownerIds.length === 0) return new Map();
    const marks = ownerIds.map((_, i) => `$${i + 2}`).join(",");
    rows = await select<ImageRow>(
      `SELECT * FROM images WHERE owner_type = $1 AND owner_id IN (${marks}) ORDER BY position`,
      [ownerType, ...ownerIds],
    );
  } else {
    rows = await select<ImageRow>("SELECT * FROM images WHERE owner_type = $1 ORDER BY position", [ownerType]);
  }
  const map = new Map<ID, MediaImage[]>();
  for (const r of rows) {
    const list = map.get(r.owner_id) ?? [];
    list.push(toImage(r));
    map.set(r.owner_id, list);
  }
  return map;
}

export async function replaceImages(ownerType: ImageOwnerType, ownerId: ID, images: MediaImage[]): Promise<void> {
  await deleteImagesOf(ownerType, ownerId);
  for (const img of images) {
    await execute(
      `INSERT INTO images (id, owner_type, owner_id, path, thumbnail_path, is_cover, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [img.id, ownerType, ownerId, img.path, img.thumbnailPath, img.isCover ? 1 : 0, img.position],
    );
  }
}

export function deleteImagesOf(ownerType: ImageOwnerType, ownerId: ID): Promise<number> {
  return execute("DELETE FROM images WHERE owner_type = $1 AND owner_id = $2", [ownerType, ownerId]);
}

/** Rewrites the folder prefix of stored image paths, e.g. "reviews/anime/" -> "reviews/animes/". */
export async function replacePathPrefix(oldPrefix: string, newPrefix: string): Promise<void> {
  const len = oldPrefix.length;
  await execute(
    `UPDATE images SET path = $2 || substr(path, $3) WHERE substr(path, 1, $4) = $1`,
    [oldPrefix, newPrefix, len + 1, len],
  );
  await execute(
    `UPDATE images SET thumbnail_path = $2 || substr(thumbnail_path, $3) WHERE substr(thumbnail_path, 1, $4) = $1`,
    [oldPrefix, newPrefix, len + 1, len],
  );
}
