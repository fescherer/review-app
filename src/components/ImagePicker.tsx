import { useState } from "react";
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
            {value.drafts.map((d) => {
              const isCover = d.key === value.coverKey;
              return (
                <div key={d.key} className="group relative">
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, coverKey: d.key })}
                    title={isCover ? "Cover image" : "Click to make this the cover"}
                    className={`block aspect-[2/3] w-full overflow-hidden rounded-lg border-2 transition ${
                      isCover ? "border-amber-400" : "border-transparent hover:border-zinc-500"
                    }`}
                  >
                    <img src={draftSrc(d)} alt="" className="h-full w-full object-cover" />
                  </button>
                  {isCover && (
                    <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-900">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
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
        {value.drafts.length > 1 && <span className="text-xs text-zinc-500">Click an image to set it as the cover.</span>}
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
