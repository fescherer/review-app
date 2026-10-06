import { ask } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "./components/Toast";
import { errorMessage } from "./lib/util";
import { FindPage } from "./pages/FindPage";
import { ReferencesPage } from "./pages/ReferencesPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WelcomePage } from "./pages/WelcomePage";
import * as config from "./services/config";
import { closeDataFolder, DataFolderError, inspectFolder, openDataFolder, pickFolder } from "./services/dataFolder";

type Boot =
  | { status: "loading" }
  | { status: "welcome" }
  | { status: "error"; message: string; path: string }
  | { status: "ready"; root: string };

type Tab = "reviews" | "find" | "references" | "settings";

export default function App() {
  const toast = useToast();
  const [boot, setBoot] = useState<Boot>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("reviews");

  /** Opens a data folder; returns an error message, or null on success. */
  const open = useCallback(async (path: string): Promise<string | null> => {
    setBusy(true);
    try {
      await openDataFolder(path);
      setBoot({ status: "ready", root: path });
      return null;
    } catch (e) {
      const message = e instanceof DataFolderError ? e.message : errorMessage(e);
      setBoot({ status: "error", message, path });
      return message;
    } finally {
      setBusy(false);
    }
  }, []);

  // Startup: reopen the last data folder (once, even under StrictMode).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const path = await config.getDataFolder().catch(() => null);
      if (path) await open(path);
      else setBoot({ status: "welcome" });
    })();
  }, [open]);

  // When the window regains focus, make sure the folder is still reachable (e.g. Google Drive stopped).
  useEffect(() => {
    if (boot.status !== "ready") return;
    const check = async () => {
      if (!(await exists(boot.root).catch(() => false))) {
        await closeDataFolder();
        setBoot({
          status: "error",
          path: boot.root,
          message: "The data folder is no longer reachable. If it's on Google Drive, check that Google Drive for Desktop is running.",
        });
      }
    };
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [boot]);

  const chooseFolder = async () => {
    const previous = boot.status === "ready" ? boot.root : null;
    let path: string | null;
    try {
      path = await pickFolder();
      if (!path) return;
      if (path === previous) return;
      const kind = await inspectFolder(path);
      if (kind === "other") {
        const ok = await ask(
          "This folder isn't empty and doesn't contain a media.db.\n\nCreate a new library inside it anyway?",
          { title: "Create library here?", kind: "warning", okLabel: "Create library" },
        );
        if (!ok) return;
      }
    } catch (e) {
      toast(errorMessage(e), "error");
      return;
    }
    const error = await open(path);
    if (!error) {
      toast(`Data folder: ${path}`, "info");
      setTab("reviews");
    } else if (previous) {
      // Keep working with the old folder if the new one failed.
      if (!(await open(previous))) toast(error, "error");
    }
  };

  if (boot.status === "loading") {
    return <div className="flex h-full items-center justify-center text-zinc-500">Loading…</div>;
  }
  if (boot.status === "welcome") return <WelcomePage busy={busy} onPick={chooseFolder} />;
  if (boot.status === "error") {
    return (
      <WelcomePage
        busy={busy}
        error={{ message: boot.message, path: boot.path }}
        onPick={chooseFolder}
        onRetry={() => open(boot.path)}
      />
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "reviews", label: "Reviews" },
    { id: "find", label: "Find" },
    { id: "references", label: "References" },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center gap-1 px-6 py-2.5">
          <span className="mr-5 flex items-center gap-2 font-semibold tracking-tight">
            <span className="text-amber-400">★</span> Media Review
          </span>
          {tabs.map((t) => (
            <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </TabButton>
          ))}
          <div className="flex-1" />
          <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
            Settings
          </TabButton>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6" key={boot.root}>
        {tab === "reviews" && <ReviewsPage />}
        {tab === "find" && <FindPage />}
        {tab === "references" && <ReferencesPage />}
        {tab === "settings" && <SettingsPage onChangeFolder={chooseFolder} />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}
