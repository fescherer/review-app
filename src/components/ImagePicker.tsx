import { useRef, useState } from "react";
import { DEFAULT_IMAGES } from "../services/defaults";
import { draftFromDefault, draftSrc, draftsFromPaths, imageSrc, pickImageFiles, releaseDrafts } from "../services/images";
import { useFileDrop } from "../lib/fileDrop";
import { errorMessage } from "../lib/util";
import type { ImageDraft, ImageSelection } from "../types";
import { useToast } from "./Toast";

interface Props {
  value: ImageSelection;
  onChange: (value: ImageSelection) => void;
}

/**
 * Edits the image set of a review or list item: add files (picker or drag & drop), or choose a
 * placeholder from defaults/; click an image to make it the cover. Nothing is written to disk here.
 */
export function ImagePicker({ value, onChange }: Props) {
  const toast = useToast();
  const [showDefaults, setShowDefaults] = useState(false);
  const [busy, setBusy] = useState(false);

  const add = (drafts: ImageDraft[]) => {
    if (!drafts.length) return;
    const all = [...value.drafts, ...drafts];
    onChange({ drafts: all, coverKey: value.drafts.length ? value.coverKey : all[0].key });
  };

  const remove = (key: string) => {
    const removed = value.drafts.find((d) => d.key === key);
    if (removed) releaseDrafts([removed]);
    const rest = value.drafts.filter((d) => d.key !== key);
    onChange({ drafts: rest, coverKey: value.coverKey === key ? (rest[0]?.key ?? "") : value.coverKey });
  };

  const run = async (fn: () => Promise<ImageDraft[]>) => {
    setBusy(true);
    try {
      const drafts = await fn();
      add(drafts);
    } catch (e) {
      toast(`Could not read image: ${errorMessage(e)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  /** Moves an image to another position; the order is saved as each image's position. */
  const move = (key: string, toIndex: number) => {
    const from = value.drafts.findIndex((d) => d.key === key);
    if (from < 0 || toIndex < 0 || toIndex >= value.drafts.length || from === toIndex) return;
    const drafts = [...value.drafts];
    const [item] = drafts.splice(from, 1);
    drafts.splice(toIndex, 0, item);
    onChange({ ...value, drafts });
  };

  // Reordering by dragging a tile. Built on pointer events because HTML5 drag & drop inside the
  // webview is disabled on Windows while Tauri's file drop is active.
  const latest = useRef({ value, move });
  latest.current = { value, move };
  const [reordering, setReordering] = useState<string | null>(null);
  const suppressClick = useRef(false);

  const startReorder = (e: React.PointerEvent, key: string) => {
    if (e.button !== 0 || value.drafts.length < 2) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    const onMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
        active = true;
        setReordering(key);
      }
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-draft-key]");
      const overKey = over?.dataset.draftKey;
      if (overKey && overKey !== key) {
        const { value: v, move: mv } = latest.current;
        mv(key, v.drafts.findIndex((d) => d.key === overKey));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (active) {
        // A drag shouldn't also count as a click (which would change the cover).
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
      }
      setReordering(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const dragging = useFileDrop((paths) =>
    run(async () => {
      const drafts = await draftsFromPaths(paths);
      if (!drafts.length) toast("Those files aren't supported images.", "error");
      return drafts;
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
          dragging ? "border-accent-400 bg-accent-500/10" : "border-zinc-700"
        }`}
      >
        {value.drafts.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
            {value.drafts.map((d, index) => {
              const isCover = d.key === value.coverKey;
              return (
                <div
                  key={d.key}
                  data-draft-key={d.key}
                  onPointerDown={(e) => startReorder(e, d.key)}
                  className={`group relative touch-none transition-transform ${
                    reordering === d.key ? "z-10 scale-105 opacity-70" : ""
                  } ${reordering ? "cursor-grabbing" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!suppressClick.current) onChange({ ...value, coverKey: d.key });
                    }}
                    title={isCover ? "Cover image · drag to reorder" : "Click to make this the cover · drag to reorder"}
                    className={`block aspect-[2/3] w-full overflow-hidden rounded-lg border-2 transition ${
                      isCover ? "border-amber-400" : "border-transparent hover:border-zinc-500"
                    }`}
                  >
                    <img src={draftSrc(d)} alt="" draggable={false} className="h-full w-full object-cover" />
                  </button>
                  {value.drafts.length > 1 && (
                    <div className="absolute inset-x-1.5 bottom-1.5 hidden items-center justify-between group-hover:flex">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => move(d.key, index - 1)}
                        disabled={index === 0}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-xs text-white hover:bg-accent-600 disabled:invisible"
                        aria-label="Move left"
                      >
                        ◀
                      </button>
                      <span className="rounded bg-black/75 px-1.5 text-[10px] tabular-nums text-zinc-200">{index + 1}</span>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => move(d.key, index + 1)}
                        disabled={index === value.drafts.length - 1}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-xs text-white hover:bg-accent-600 disabled:invisible"
                        aria-label="Move right"
                      >
                        ▶
                      </button>
                    </div>
                  )}
                  {isCover && (
                    <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-900">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => remove(d.key)}
                    className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-black/75 text-xs text-white hover:bg-red-600 group-hover:flex"
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">
            Drop images here, add files, or use a default cover.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(pickImageFiles)}>
          {busy ? "Reading…" : "Add images…"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setShowDefaults((s) => !s)}>
          {showDefaults ? "Hide default covers" : "Use a default cover"}
        </button>
        {value.drafts.length > 1 && (
          <span className="text-xs text-zinc-500">Click an image to set it as the cover · drag (or ◀ ▶) to change the order.</span>
        )}
      </div>

      {showDefaults && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 rounded-xl bg-zinc-950/60 p-3">
          {DEFAULT_IMAGES.map((img) => (
            <button
              key={img.path}
              type="button"
              title={img.label}
              onClick={() => {
                add([draftFromDefault(img.path)]);
                setShowDefaults(false);
              }}
              className="overflow-hidden rounded-md border border-zinc-800 transition hover:border-accent-400"
            >
              <img src={imageSrc(img.path)} alt={img.label} className="aspect-[2/3] w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
