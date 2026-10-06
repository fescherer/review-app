import { useState } from "react";

interface Props {
  /** Shown when the configured folder can't be opened. */
  error?: { message: string; path: string } | null;
  busy: boolean;
  onPick: () => void;
  onRetry?: () => void;
}

/** First-run screen (pick a data folder) and the "folder unreachable" error screen. */
export function WelcomePage({ error, busy, onPick, onRetry }: Props) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
        {error ? (
          <>
            <div className="mb-1 text-3xl">⚠️</div>
            <h1 className="text-2xl font-semibold">Can't open your data folder</h1>
            <p className="mt-3 text-sm text-zinc-300">{error.message}</p>
            <code className="mt-3 block break-all rounded-lg bg-zinc-950 px-3 py-2 text-xs text-zinc-400">{error.path}</code>
            <div className="mt-6 flex flex-wrap gap-2">
              {onRetry && (
                <button className="btn btn-primary" onClick={onRetry} disabled={busy}>
                  {busy ? "Trying…" : "Try again"}
                </button>
              )}
              <button className="btn btn-secondary" onClick={onPick} disabled={busy}>
                Choose another folder…
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 text-4xl">★</div>
            <h1 className="text-2xl font-semibold">Welcome to Media Review</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Your reviews, lists and images are all stored in one folder on this PC. Pick an <b>empty folder</b> to start a
              new library, or a folder that already contains a <code className="text-accent-300">media.db</code> to open an
              existing one (e.g. from another PC).
            </p>
            <button className="btn btn-primary mt-6 w-full py-2.5 text-base" onClick={onPick} disabled={busy}>
              {busy ? "Opening…" : "Choose data folder…"}
            </button>
            <button className="mt-4 text-xs text-zinc-500 hover:text-zinc-300" onClick={() => setShowHelp((s) => !s)}>
              {showHelp ? "Hide" : "Syncing with Google Drive?"}
            </button>
            {showHelp && (
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Install Google Drive for Desktop, then create a folder inside your Drive (e.g.{" "}
                <code>G:\My Drive\MediaReview</code>) and pick it here. On another PC, pick the same synced folder. Avoid using
                the app on two PCs at the same time.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
