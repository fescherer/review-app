import { openUrl as open } from "@tauri-apps/plugin-opener";

/** Opens http(s) links in the system browser. */
export function openUrl(href: string): void {
  if (/^https?:\/\//i.test(href)) open(href).catch((e) => console.error(e));
}
