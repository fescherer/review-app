import { load, type Store } from "@tauri-apps/plugin-store";

// App-level settings live in the OS app config folder (%APPDATA%\com.felipe.mediareview on Windows),
// never inside the synced data folder, so each PC can point at its own path.

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) store = await load("settings.json", { autoSave: false, defaults: {} });
  return store;
}

export async function getDataFolder(): Promise<string | null> {
  return (await (await getStore()).get<string>("dataFolder")) ?? null;
}

export async function setDataFolder(path: string | null): Promise<void> {
  const s = await getStore();
  if (path) await s.set("dataFolder", path);
  else await s.delete("dataFolder");
  await s.save();
}
