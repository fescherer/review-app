import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { newId, shortId } from "../lib/util";
import type { ImageDraft, ImageSelection, MediaImage } from "../types";
import { isDefaultImagePath } from "./defaults";
import { baseName, ensureDir, joinRel, moveFile, pathExists, removePath, toAbs, writeBytes } from "./fileSystem";

export const THUMB_MAX_WIDTH = 400;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  avif: "image/avif",
  svg: "image/svg+xml",
};
export const IMAGE_EXTENSIONS = Object.keys(MIME);

const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
export const isSupportedImage = (name: string) => extOf(name) in MIME;

/** URL for an <img> tag, served through Tauri's asset protocol. */
export function imageSrc(relPath: string): string {
  return convertFileSrc(toAbs(relPath));
}

export function coverOf(images: MediaImage[]): MediaImage | undefined {
  return images.find((i) => i.isCover) ?? images[0];
}

// ---------------------------------------------------------------- drafts (form state)

function newDraft(fileName: string, bytes: Uint8Array): ImageDraft {
  const blob = new Blob([bytes as BlobPart], { type: MIME[extOf(fileName)] ?? "application/octet-stream" });
  return { key: newId(), kind: "new", bytes, fileName, previewUrl: URL.createObjectURL(blob) };
}

export function draftSrc(d: ImageDraft): string {
  if (d.kind === "new") return d.previewUrl;
  return imageSrc(d.kind === "stored" ? d.thumbnailPath : d.path);
}

export function draftFromDefault(path: string): ImageDraft {
  return { key: newId(), kind: "default", path };
}

/** Turns stored images into form drafts (keeps the current cover). */
export function selectionFromImages(images: MediaImage[]): ImageSelection {
  const drafts: ImageDraft[] = [...images]
    .sort((a, b) => a.position - b.position)
    .map((img) =>
      isDefaultImagePath(img.path)
        ? { key: img.id, kind: "default", path: img.path }
        : { key: img.id, kind: "stored", path: img.path, thumbnailPath: img.thumbnailPath },
    );
  return { drafts, coverKey: coverOf(images)?.id ?? drafts[0]?.key ?? "" };
}

/** Native file picker. Originals are only read, never moved or modified. */
export async function pickImageFiles(): Promise<ImageDraft[]> {
  const picked = await open({
    multiple: true,
    directory: false,
    title: "Add images",
    filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
  });
  if (!picked) return [];
  const paths = Array.isArray(picked) ? picked : [picked];
  const drafts: ImageDraft[] = [];
  for (const p of paths) {
    if (!isSupportedImage(p)) continue;
    drafts.push(newDraft(baseName(p), await readFile(p)));
  }
  return drafts;
}

/** Files dropped onto the window (HTML5 drag & drop). */
export async function draftsFromFiles(files: FileList | File[]): Promise<ImageDraft[]> {
  const drafts: ImageDraft[] = [];
  for (const f of Array.from(files)) {
    if (!isSupportedImage(f.name)) continue;
    drafts.push(newDraft(f.name, new Uint8Array(await f.arrayBuffer())));
  }
  return drafts;
}

export function releaseDrafts(drafts: ImageDraft[]): void {
  for (const d of drafts) if (d.kind === "new") URL.revokeObjectURL(d.previewUrl);
}

// ---------------------------------------------------------------- thumbnails

/** Resizes to at most THUMB_MAX_WIDTH wide with a canvas. Returns null if the format can't be decoded. */
export async function makeThumbnail(bytes: Uint8Array, fileName: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[extOf(fileName)] }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w0 = img.naturalWidth || 600;
    const h0 = img.naturalHeight || 900;
    const scale = Math.min(1, THUMB_MAX_WIDTH / w0);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const toBlob = (type: string, q: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
    let blob = await toBlob("image/webp", 0.82);
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob("image/jpeg", 0.85);
      ext = "jpg";
    }
    return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), ext } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------- persistence

async function freeName(folder: string, name: string): Promise<string> {
  let target = joinRel(folder, name);
  while (await pathExists(target)) target = joinRel(folder, `${shortId()}-${name}`);
  return target;
}

/**
 * Writes new images, moves stored images that live in another folder (tag change, "mark as done"),
 * and returns the final image records for `folder`. Placeholders stay in defaults/.
 */
export async function persistImages(folder: string, selection: ImageSelection): Promise<MediaImage[]> {
  await ensureDir(folder);
  const result: MediaImage[] = [];
  for (const [position, d] of selection.drafts.entries()) {
    let path: string;
    let thumbnailPath: string;
    if (d.kind === "default") {
      path = thumbnailPath = d.path;
    } else if (d.kind === "new") {
      const stem = shortId();
      const ext = extOf(d.fileName) || "img";
      path = joinRel(folder, `${stem}.${ext}`);
      await writeBytes(path, d.bytes);
      const thumb = await makeThumbnail(d.bytes, d.fileName);
      if (thumb) {
        thumbnailPath = joinRel(folder, `${stem}.thumb.${thumb.ext}`);
        await writeBytes(thumbnailPath, thumb.bytes);
      } else {
        thumbnailPath = path;
      }
    } else if (d.path.startsWith(folder + "/")) {
      path = d.path;
      thumbnailPath = d.thumbnailPath;
    } else {
      path = await freeName(folder, baseName(d.path));
      await moveFile(d.path, path);
      if (d.thumbnailPath === d.path) {
        thumbnailPath = path;
      } else if (await pathExists(d.thumbnailPath)) {
        thumbnailPath = await freeName(folder, baseName(d.thumbnailPath));
        await moveFile(d.thumbnailPath, thumbnailPath);
      } else {
        thumbnailPath = path;
      }
    }
    result.push({ id: newId(), path, thumbnailPath, isCover: d.key === selection.coverKey, position });
  }
  if (result.length && !result.some((i) => i.isCover)) result[0].isCover = true;
  return result;
}

/** Deletes files of images that are no longer referenced (never touches defaults/). */
export async function deleteUnusedImageFiles(previous: MediaImage[], current: MediaImage[]): Promise<void> {
  const keep = new Set(current.flatMap((i) => [i.path, i.thumbnailPath]));
  for (const img of previous) {
    for (const p of [img.path, img.thumbnailPath]) {
      if (!keep.has(p) && !isDefaultImagePath(p)) await removePath(p).catch(() => undefined);
    }
  }
}
