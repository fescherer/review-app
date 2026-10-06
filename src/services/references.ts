import { open } from "@tauri-apps/plugin-dialog";
import { copyFile, readDir, readTextFile, stat } from "@tauri-apps/plugin-fs";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import * as db from "../db/references";
import { newId, nowIso } from "../lib/util";
import type { FileType, ID, ImportProgress, ImportSource, Reference, ReferenceUpdate } from "../types";
import { baseName, ensureDir, joinAbs, joinRel, removePath, toAbs, writeBytes } from "./fileSystem";
import { makeImageFileThumbnail, makeVideoThumbnail } from "./images";
import { referenceUpdateSchema, validate } from "./validation";

export const REFERENCES_DIR = "references";

/** Text files larger than this are not indexed for search (they can still be opened). */
const MAX_INDEXED_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_INDEXED_TEXT_CHARS = 500_000;

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "svg", "ico"]);
const VIDEO_EXT = new Set(["mp4", "m4v", "webm", "mov", "mkv", "avi", "wmv", "flv", "ogv", "mpg", "mpeg", "3gp"]);
const TEXT_EXT = new Set(["txt", "md", "markdown", "log", "csv", "json"]);
const IGNORED_FILES = new Set(["desktop.ini", "thumbs.db", ".ds_store"]);

export const extensionOf = (name: string) => (/\.([^./\\]+)$/.exec(name)?.[1] ?? "").toLowerCase();
export const titleFromFileName = (name: string) => name.replace(/\.[^./\\]+$/, "") || name;

export function detectFileType(name: string): FileType {
  const ext = extensionOf(name);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (TEXT_EXT.has(ext)) return "text";
  return "other";
}

export const isMarkdown = (r: Pick<Reference, "fileName">) => ["md", "markdown"].includes(extensionOf(r.fileName));

export const referencePath = (r: Pick<Reference, "fileName">) => joinRel(REFERENCES_DIR, r.fileName);

export const listReferences = db.allReferences;
export const searchReferenceIds = db.searchReferenceIds;

export async function getReference(id: ID): Promise<Reference> {
  const ref = await db.referenceById(id);
  if (!ref) throw new Error("Reference not found.");
  return ref;
}

// ---------------------------------------------------------------- collecting files to import

async function collect(path: string, out: ImportSource[]): Promise<void> {
  const name = baseName(path);
  if (name.startsWith(".") || IGNORED_FILES.has(name.toLowerCase())) return;
  const info = await stat(path);
  if (info.isDirectory) {
    const entries = await readDir(path);
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const e of entries) await collect(joinAbs(path, e.name), out);
  } else if (info.isFile) {
    out.push({ path, name, size: info.size, fileType: detectFileType(name) });
  }
}

/** Expands dropped/picked paths (files and folders, recursively) into a list of files. */
export async function sourcesFromPaths(paths: string[]): Promise<ImportSource[]> {
  const out: ImportSource[] = [];
  for (const p of paths) await collect(p, out);
  return out;
}

export async function pickReferenceFiles(): Promise<ImportSource[]> {
  const picked = await open({ multiple: true, directory: false, title: "Add references" });
  if (!picked) return [];
  return sourcesFromPaths(Array.isArray(picked) ? picked : [picked]);
}

/** Picks a folder on the PC and lists every file inside it (subfolders included). */
export async function pickReferenceFolder(): Promise<ImportSource[]> {
  const picked = await open({ directory: true, multiple: false, recursive: true, title: "Import folder" });
  if (typeof picked !== "string") return [];
  return sourcesFromPaths([picked]);
}

// ---------------------------------------------------------------- import

async function createThumbnail(type: FileType, rel: string, id: ID): Promise<string | null> {
  const thumb =
    type === "image" ? await makeImageFileThumbnail(rel) : type === "video" ? await makeVideoThumbnail(rel) : null;
  if (!thumb) return null;
  const thumbRel = joinRel(REFERENCES_DIR, `${id}.thumb.${thumb.ext}`);
  await writeBytes(thumbRel, thumb.bytes);
  return thumbRel;
}

async function indexText(type: FileType, rel: string, size: number): Promise<string | null> {
  if (type !== "text" || size > MAX_INDEXED_TEXT_BYTES) return null;
  try {
    return (await readTextFile(toAbs(rel))).slice(0, MAX_INDEXED_TEXT_CHARS);
  } catch {
    return null;
  }
}

export interface ImportItem {
  source: ImportSource;
  title: string;
}

export interface ImportResult {
  imported: Reference[];
  failed: { name: string; error: string }[];
}

/**
 * Copies each file into references/<id>.<ext> (originals are never moved or modified; the copy is done
 * by the OS, never read into memory), creates thumbnails and text index, and saves the records.
 */
export async function importReferences(
  items: ImportItem[],
  tagIds: ID[],
  onProgress?: (p: ImportProgress) => void,
  isCancelled?: () => boolean,
): Promise<ImportResult> {
  await ensureDir(REFERENCES_DIR);
  const result: ImportResult = { imported: [], failed: [] };
  const progress: ImportProgress = {
    done: 0,
    total: items.length,
    bytesDone: 0,
    bytesTotal: items.reduce((sum, i) => sum + i.source.size, 0),
    current: "",
  };

  for (const { source, title } of items) {
    if (isCancelled?.()) break;
    onProgress?.({ ...progress, current: source.name });
    const id = newId();
    const ext = extensionOf(source.name);
    const fileName = ext ? `${id}.${ext}` : id;
    const rel = joinRel(REFERENCES_DIR, fileName);
    let thumbnailPath: string | null = null;
    try {
      await copyFile(source.path, toAbs(rel));
      thumbnailPath = await createThumbnail(source.fileType, rel, id);
      const textContent = await indexText(source.fileType, rel, source.size);
      const now = nowIso();
      const ref: Reference = {
        id,
        title: title.trim() || titleFromFileName(source.name),
        fileName,
        originalFileName: source.name,
        fileType: source.fileType,
        fileSize: source.size,
        notes: "",
        sourceUrl: "",
        thumbnailPath,
        textPreview: textContent?.slice(0, 1200) ?? null,
        tagIds: [...new Set(tagIds)],
        createdAt: now,
        updatedAt: now,
      };
      await db.insertReference(ref, textContent);
      await db.setReferenceTags(id, ref.tagIds);
      result.imported.push(ref);
    } catch (e) {
      await removePath(rel).catch(() => undefined);
      if (thumbnailPath) await removePath(thumbnailPath).catch(() => undefined);
      await db.deleteReference(id).catch(() => undefined);
      result.failed.push({ name: source.name, error: e instanceof Error ? e.message : String(e) });
    }
    progress.done += 1;
    progress.bytesDone += source.size;
    onProgress?.({ ...progress, current: source.name });
  }
  return result;
}

// ---------------------------------------------------------------- edit / delete / open

export async function updateReference(id: ID, update: ReferenceUpdate): Promise<void> {
  const data = validate(referenceUpdateSchema, update);
  await getReference(id);
  await db.updateReference(id, data.title, data.notes, data.sourceUrl, nowIso());
  await db.setReferenceTags(id, data.tagIds);
}

/** Deletes the record, the file and its thumbnail. */
export async function deleteReference(id: ID): Promise<void> {
  const ref = await getReference(id);
  await db.deleteReference(id);
  await removePath(referencePath(ref)).catch(() => undefined);
  if (ref.thumbnailPath) await removePath(ref.thumbnailPath).catch(() => undefined);
}

export async function readReferenceText(ref: Reference): Promise<string> {
  return readTextFile(toAbs(referencePath(ref)));
}

export const openInDefaultApp = (ref: Reference) => openPath(toAbs(referencePath(ref)));
export const showInFolder = (ref: Reference) => revealItemInDir(toAbs(referencePath(ref)));

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
