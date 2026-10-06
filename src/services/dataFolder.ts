import { invoke } from "@tauri-apps/api/core";
import { exists, readDir } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { closeDatabase, openDatabase } from "../db/client";
import { runMigrations } from "../db/migrate";
import { errorMessage } from "../lib/util";
import * as config from "./config";
import { installDefaultImages } from "./defaults";
import { ensureDir, joinAbs, setRoot } from "./fileSystem";
import { seedDefaultTags } from "./tags";

export const DB_FILE = "media.db";
export const FOLDERS = ["defaults", "reviews", "lists", "exports"] as const;

export type FolderKind = "missing" | "empty" | "library" | "other";

export class DataFolderError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = "DataFolderError";
  }
}

/** Lets the frontend read/write inside the folder and show its images via the asset protocol. */
async function grantAccess(path: string): Promise<void> {
  await invoke("allow_data_folder", { path });
}

export async function pickFolder(): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, title: "Choose your media data folder" });
  return typeof picked === "string" ? picked : null;
}

/** Classifies a folder before opening it, so the UI can warn about non-empty folders without a library. */
export async function inspectFolder(path: string): Promise<FolderKind> {
  await grantAccess(path);
  if (!(await exists(path))) return "missing";
  if (await exists(joinAbs(path, DB_FILE))) return "library";
  const entries = await readDir(path);
  return entries.filter((e) => !e.name.startsWith(".") && e.name !== "desktop.ini").length === 0 ? "empty" : "other";
}

/**
 * Opens (or creates) the library in `path`: folder structure, placeholders, database, migrations, seed data.
 * An existing media.db is opened as-is.
 */
export async function openDataFolder(path: string): Promise<void> {
  try {
    await grantAccess(path);
  } catch (e) {
    throw new DataFolderError(`Could not get access to the data folder: ${errorMessage(e)}`, path);
  }
  if (!(await exists(path).catch(() => false))) {
    throw new DataFolderError(
      "The data folder can't be found. If it's on Google Drive, make sure Google Drive for Desktop is running and signed in.",
      path,
    );
  }

  await closeDatabase();
  setRoot(path);
  try {
    const isNew = !(await exists(joinAbs(path, DB_FILE)));
    for (const f of FOLDERS) await ensureDir(f);
    await installDefaultImages();
    await openDatabase(joinAbs(path, DB_FILE));
    await runMigrations();
    if (isNew) await seedDefaultTags();
  } catch (e) {
    setRoot(null);
    await closeDatabase();
    throw new DataFolderError(`Could not open the data folder: ${errorMessage(e)}`, path);
  }
  await config.setDataFolder(path);
}

export async function closeDataFolder(): Promise<void> {
  await closeDatabase();
  setRoot(null);
}
