import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { copyFile, readFile } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { newId, shortId } from "../lib/util";
import type { FileType, ImageDraft, ImageSelection, MediaImage } from "../types";
import { isDefaultImagePath } from "./defaults";
import { baseName, ensureDir, joinRel, moveFile, pathExists, removePath, toAbs, writeBytes } from "./fileSystem";
import { sourcesFromPaths } from "./references";

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
  ico: "image/x-icon",
};
export const IMAGE_EXTENSIONS = Object.keys(MIME);

const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
export const isSupportedImage = (name: string) => extOf(name) in MIME;

/** URL for an <img> tag, served through Tauri's asset protocol. */
export function imageSrc(relPath: string): string {
  return convertFileSrc(toAbs(relPath));
}

/** The cover: always an image (other files can't be the cover). */
export function coverOf(images: MediaImage[]): MediaImage | undefined {
  const pictures = images.filter((i) => i.fileType === "image");
  return pictures.find((i) => i.isCover) ?? pictures[0];
}

/** Opens an item file in its default app / shows it in Explorer. */
export const openItemFile = (relPath: string) => openPath(toAbs(relPath));
export const showItemFileInFolder = (relPath: string) => revealItemInDir(toAbs(relPath));

// ---------------------------------------------------------------- drafts (form state)

function newDraft(fileName: string, bytes: Uint8Array): ImageDraft {
  const blob = new Blob([bytes as BlobPart], { type: MIME[extOf(fileName)] ?? "application/octet-stream" });
  return { key: newId(), kind: "new", bytes, fileName, previewUrl: URL.createObjectURL(blob) };
}

/** Only images can be the cover. */
export function isImageDraft(d: ImageDraft): boolean {
  if (d.kind === "stored") return d.fileType === "image";
  return d.kind !== "file";
}

/** File type of a draft, for icons. */
export const draftFileType = (d: ImageDraft): FileType =>
  d.kind === "stored" || d.kind === "file" ? d.fileType : "image";

/** Image (or video thumbnail) to show for a draft; "" if the file has none. */
export function draftSrc(d: ImageDraft): string {
  if (d.kind === "new") return d.previewUrl;
  if (d.kind === "file") return "";
  if (d.kind === "stored") return d.thumbnailPath ? imageSrc(d.thumbnailPath) : "";
  return imageSrc(d.path);
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
        : {
            key: img.id,
            kind: "stored",
            path: img.path,
            thumbnailPath: img.thumbnailPath,
            fileType: img.fileType,
            fileName: img.fileName,
            fileSize: img.fileSize,
          },
    );
  return { drafts, coverKey: coverOf(images)?.id ?? drafts[0]?.key ?? "" };
}

/** Native file picker for any file type. Originals are only read, never moved or modified. */
export async function pickItemFiles(): Promise<ImageDraft[]> {
  const picked = await open({ multiple: true, directory: false, title: "Add files" });
  if (!picked) return [];
  return draftsFromPaths(Array.isArray(picked) ? picked : [picked]);
}

/**
 * Files from the picker or a drag & drop (folders are expanded, like in References). Images are read
 * into memory as before; any other file is only referenced by path and copied by the OS on save.
 */
export async function draftsFromPaths(paths: string[]): Promise<ImageDraft[]> {
  const drafts: ImageDraft[] = [];
  for (const source of await sourcesFromPaths(paths)) {
    if (source.fileType === "image" && isSupportedImage(source.name)) {
      drafts.push(newDraft(source.name, await readFile(source.path)));
    } else {
      drafts.push({
        key: newId(),
        kind: "file",
        sourcePath: source.path,
        fileName: source.name,
        fileSize: source.size,
        fileType: source.fileType,
      });
    }
  }
  return drafts;
}

export function releaseDrafts(drafts: ImageDraft[]): void {
  for (const d of drafts) if (d.kind === "new") URL.revokeObjectURL(d.previewUrl);
}

// ---------------------------------------------------------------- thumbnails

export interface Thumbnail {
  bytes: Uint8Array;
  ext: string;
}

/** Draws a decoded image/video frame scaled to at most THUMB_MAX_WIDTH wide and encodes it (WebP, JPEG fallback). */
async function encodeThumbnail(source: CanvasImageSource, width: number, height: number): Promise<Thumbnail | null> {
  const scale = Math.min(1, THUMB_MAX_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  let blob = await toBlob("image/webp", 0.82);
  let ext = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob("image/jpeg", 0.85);
    ext = "jpg";
  }
  return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), ext } : null;
}

async function thumbnailOfImageUrl(url: string): Promise<Thumbnail | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return encodeThumbnail(img, img.naturalWidth || 600, img.naturalHeight || 900);
}

/** Thumbnail from image bytes in memory. Returns null if the format can't be decoded. */
export async function makeThumbnail(bytes: Uint8Array, fileName: string): Promise<Thumbnail | null> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[extOf(fileName)] }));
  try {
    return await thumbnailOfImageUrl(url);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Thumbnail of an image file already inside the data folder (streamed via the asset protocol). */
export async function makeImageFileThumbnail(relPath: string): Promise<Thumbnail | null> {
  try {
    return await thumbnailOfImageUrl(imageSrc(relPath));
  } catch {
    return null;
  }
}

function waitFor(el: HTMLMediaElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error("timeout")), timeoutMs);
    const onEvent = () => done();
    const onError = () => done(new Error("media error"));
    function done(err?: Error) {
      clearTimeout(timer);
      el.removeEventListener(event, onEvent);
      el.removeEventListener("error", onError);
      if (err) reject(err);
      else resolve();
    }
    el.addEventListener(event, onEvent, { once: true });
    el.addEventListener("error", onError, { once: true });
  });
}

/** Captures a frame around 1 s into a video file inside the data folder. Null if the webview can't decode it. */
export async function makeVideoThumbnail(relPath: string): Promise<Thumbnail | null> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  try {
    const loaded = waitFor(video, "loadeddata", 20000);
    video.src = imageSrc(relPath);
    await loaded;
    if (!video.videoWidth || !video.videoHeight) return null;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target = duration > 0 ? Math.min(1, duration / 2) : 0;
    if (target > 0) {
      const seeked = waitFor(video, "seeked", 15000);
      video.currentTime = target;
      await seeked;
    }
    return await encodeThumbnail(video, video.videoWidth, video.videoHeight);
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
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
    let fileType: FileType = "image";
    let fileName: string | null = null;
    let fileSize: number | null = null;
    if (d.kind === "default") {
      path = thumbnailPath = d.path;
    } else if (d.kind === "file") {
      // Any other file: copied as-is by the OS (videos can be large), with a frame as thumbnail for videos.
      const stem = shortId();
      const ext = extOf(d.fileName);
      path = joinRel(folder, ext ? `${stem}.${ext}` : stem);
      await copyFile(d.sourcePath, toAbs(path));
      thumbnailPath = "";
      if (d.fileType === "video") {
        const thumb = await makeVideoThumbnail(path);
        if (thumb) {
          thumbnailPath = joinRel(folder, `${stem}.thumb.${thumb.ext}`);
          await writeBytes(thumbnailPath, thumb.bytes);
        }
      }
      fileType = d.fileType;
      fileName = d.fileName;
      fileSize = d.fileSize;
    } else if (d.kind === "new") {
      fileName = d.fileName;
      fileSize = d.bytes.length;
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
      ({ fileType, fileName, fileSize } = d);
    } else {
      ({ fileType, fileName, fileSize } = d);
      path = await freeName(folder, baseName(d.path));
      await moveFile(d.path, path);
      if (!d.thumbnailPath) {
        thumbnailPath = "";
      } else if (d.thumbnailPath === d.path) {
        thumbnailPath = path;
      } else if (await pathExists(d.thumbnailPath)) {
        thumbnailPath = await freeName(folder, baseName(d.thumbnailPath));
        await moveFile(d.thumbnailPath, thumbnailPath);
      } else {
        thumbnailPath = path;
      }
    }
    result.push({
      id: newId(),
      path,
      thumbnailPath,
      // Only images can be the cover.
      isCover: d.key === selection.coverKey && fileType === "image",
      position,
      fileType,
      fileName,
      fileSize,
    });
  }
  if (!result.some((i) => i.isCover)) {
    const firstImage = result.find((i) => i.fileType === "image");
    if (firstImage) firstImage.isCover = true;
  }
  return result;
}

/** Deletes files of images that are no longer referenced (never touches defaults/). */
export async function deleteUnusedImageFiles(previous: MediaImage[], current: MediaImage[]): Promise<void> {
  const keep = new Set(current.flatMap((i) => [i.path, i.thumbnailPath]));
  for (const img of previous) {
    for (const p of [img.path, img.thumbnailPath]) {
      if (p && !keep.has(p) && !isDefaultImagePath(p)) await removePath(p).catch(() => undefined);
    }
  }
}
