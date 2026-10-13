import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/util";
import { baseName } from "../services/fileSystem";
import { coverOf, imageSrc, openItemFile, showItemFileInFolder } from "../services/images";
import { extensionOf } from "../services/references";
import type { MediaImage } from "../types";
import { FileTypeIcon } from "./FileTypeIcon";
import { FilePreview, type PreviewFile } from "./ReferencePreview";
import { useToast } from "./Toast";

/** Slideshow interval. */
const SLIDE_MS = 3000;

const toPreviewFile = (f: MediaImage): PreviewFile => ({
  path: f.path,
  fileType: f.fileType,
  fileName: f.fileName ?? baseName(f.path),
  fileSize: f.fileSize ?? 0,
  thumbnailPath: f.thumbnailPath || null,
});

/**
 * Files of a review / list item. Images are shown fitted (click opens them in the default app); other files
 * use the same previews as References (video player, text, or icon + "Open in default app" / "Show in
 * folder"). Arrows, ←/→ keys and the thumbnail strip navigate (looping); with more than one file, a
 * slideshow advances every few seconds, paused while hovered or while a video plays. Starts on the cover.
 */
export function Gallery({ images }: { images: MediaImage[] }) {
  const toast = useToast();
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const [current, setCurrent] = useState(() => coverOf(sorted)?.id ?? sorted[0]?.id);
  const index = Math.max(0, sorted.findIndex((i) => i.id === current));
  const active = sorted[index];
  const multiple = sorted.length > 1;

  const [hovered, setHovered] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  /** Bumped on manual navigation so the slideshow timer restarts from zero. */
  const [restart, setRestart] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  const go = (delta: number) => {
    if (!multiple) return;
    setCurrent(sorted[(index + delta + sorted.length) % sorted.length].id);
    setVideoPlaying(false);
  };
  const goManual = (delta: number) => {
    go(delta);
    setRestart((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goManual(1);
      if (e.key === "ArrowLeft") goManual(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Slideshow: next file after SLIDE_MS, unless hovered or a video is playing.
  useEffect(() => {
    if (!multiple || hovered || videoPlaying) return;
    const timer = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [multiple, hovered, videoPlaying, active?.id, restart]);

  // Keep the current thumbnail visible in the strip.
  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-media-id="${active?.id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [active?.id]);

  if (!active) return null;
  const run = (fn: () => Promise<unknown>) => () => fn().catch((e) => toast(errorMessage(e), "error"));
  const arrow =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl leading-none text-white/70 opacity-60 backdrop-blur-sm transition hover:bg-black/70 hover:text-white hover:opacity-100 group-hover/viewer:opacity-100";

  return (
    <div className="flex flex-col gap-3" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div
        className="group/viewer relative"
        // Media events don't bubble, but they can be captured here (from the video player inside).
        onPlayCapture={() => setVideoPlaying(true)}
        onPauseCapture={() => setVideoPlaying(false)}
        onEndedCapture={() => setVideoPlaying(false)}
      >
        <div key={active.id} className="animate-[gallery-fade_350ms_ease-out]">
          {active.fileType === "image" ? (
            <div className="flex h-[28rem] max-h-[60vh] items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
              <img
                src={imageSrc(active.path)}
                alt=""
                draggable={false}
                title="Open in default app"
                onClick={run(() => openItemFile(active.path))}
                className="max-h-full max-w-full cursor-pointer object-contain"
              />
            </div>
          ) : (
            <FilePreview
              file={toPreviewFile(active)}
              onOpenExternally={run(() => openItemFile(active.path))}
              onShowInFolder={run(() => showItemFileInFolder(active.path))}
            />
          )}
        </div>
        {multiple && (
          <>
            <button type="button" className={`${arrow} left-2`} onClick={() => goManual(-1)} aria-label="Previous">
              ‹
            </button>
            <button type="button" className={`${arrow} right-2`} onClick={() => goManual(1)} aria-label="Next">
              ›
            </button>
          </>
        )}
      </div>
      {multiple && (
        <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((f) => (
            <button
              key={f.id}
              data-media-id={f.id}
              onClick={() => {
                setCurrent(f.id);
                setVideoPlaying(false);
                setRestart((n) => n + 1);
              }}
              title={f.fileName ?? undefined}
              className={`relative h-20 w-14 shrink-0 overflow-hidden rounded-md border-2 transition ${
                f.id === active.id ? "border-accent-400" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {f.thumbnailPath ? (
                <img src={imageSrc(f.thumbnailPath)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-zinc-800 text-zinc-400">
                  <FileTypeIcon type={f.fileType} size={20} />
                  <span className="text-[9px] font-semibold">{extensionOf(f.fileName ?? f.path).toUpperCase() || "FILE"}</span>
                </span>
              )}
              {f.fileType === "video" && f.thumbnailPath && (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[9px] text-white">▶</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
