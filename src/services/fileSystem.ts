import { exists, mkdir, readDir, remove, rename, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { sep } from "@tauri-apps/api/path";

// All paths handled by the app are relative to the data folder root and use "/".
// This module is the only place that turns them into absolute OS paths.

let root: string | null = null;

export function setRoot(path: string | null): void {
  root = path ? path.replace(/[\\/]+$/, "") : null;
}

export function getRoot(): string {
  if (!root) throw new Error("No data folder is open.");
  return root;
}

export function hasRoot(): boolean {
  return root !== null;
}

export function joinAbs(base: string, ...parts: string[]): string {
  const s = sep();
  return [base.replace(/[\\/]+$/, ""), ...parts.flatMap((p) => p.split("/")).filter(Boolean)].join(s);
}

export function toAbs(rel: string): string {
  return joinAbs(getRoot(), rel);
}

export function joinRel(...parts: string[]): string {
  return parts
    .flatMap((p) => p.split("/"))
    .filter(Boolean)
    .join("/");
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function pathExists(rel: string): Promise<boolean> {
  return exists(toAbs(rel));
}

export async function ensureDir(rel: string): Promise<void> {
  const abs = toAbs(rel);
  if (!(await exists(abs))) await mkdir(abs, { recursive: true });
}

export async function removePath(rel: string): Promise<void> {
  if (!rel || rel === "/") throw new Error("Refusing to delete the data folder root.");
  const abs = toAbs(rel);
  if (await exists(abs)) await remove(abs, { recursive: true });
}

export async function writeBytes(rel: string, bytes: Uint8Array): Promise<void> {
  await writeFile(toAbs(rel), bytes);
}

export async function writeText(rel: string, text: string): Promise<void> {
  await writeTextFile(toAbs(rel), text);
}

/** Moves a file. The destination's parent folder is created if needed. */
export async function moveFile(fromRel: string, toRel: string): Promise<void> {
  const parent = toRel.split("/").slice(0, -1).join("/");
  if (parent) await ensureDir(parent);
  await rename(toAbs(fromRel), toAbs(toRel));
}

/** Moves a folder; if the destination already exists, merges the contents into it. */
export async function moveDir(fromRel: string, toRel: string): Promise<void> {
  if (fromRel === toRel || !(await pathExists(fromRel))) return;
  if (!(await pathExists(toRel))) {
    const parent = toRel.split("/").slice(0, -1).join("/");
    if (parent) await ensureDir(parent);
    await rename(toAbs(fromRel), toAbs(toRel));
    return;
  }
  for (const entry of await readDir(toAbs(fromRel))) {
    const from = joinRel(fromRel, entry.name);
    const to = joinRel(toRel, entry.name);
    if (entry.isDirectory) await moveDir(from, to);
    else if (!(await pathExists(to))) await rename(toAbs(from), toAbs(to));
  }
  await removePath(fromRel);
}

export async function listDir(absPath: string): Promise<string[]> {
  return (await readDir(absPath)).map((e) => e.name);
}
