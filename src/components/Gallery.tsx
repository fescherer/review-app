import { useEffect, useState } from "react";
import { errorMessage } from "../lib/util";
import { baseName } from "../services/fileSystem";
import { coverOf, imageSrc, openItemFile, showItemFileInFolder } from "../services/images";
import { extensionOf } from "../services/references";
import type { MediaImage } from "../types";
import { FileTypeIcon } from "./FileTypeIcon";
import { FilePreview, type PreviewFile } from "./ReferencePreview";
import { useToast } from "./Toast";

const toPreviewFile = (f: MediaImage): PreviewFile => ({
  path: f.path,
  fileType: f.fileType,
  fileName: f.fileName ?? baseName(f.path),
  fileSize: f.fileSize ?? 0,
  thumbnailPath: f.thumbnailPath || null,
});

/**
 * Files of a review / list item with the same previews as References (image zoom, video player, text,
 * or icon + "Open in default app" / "Show in folder"), and a thumbnail strip. Starts on the cover.
 */
export function Gallery({ images }: { images: MediaImage[] }) {
  const toast = useToast();
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const [current, setCurrent] = useState(() => coverOf(sorted)?.id ?? sorted[0]?.id);
  const active = sorted.find((i) => i.id === current) ?? sorted[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sorted.length < 2) return;
      const idx = sorted.findIndex((i) => i.id === active?.id);
      if (e.key === "ArrowRight") setCurrent(sorted[(idx + 1) % sorted.length].id);
      if (e.key === "ArrowLeft") setCurrent(sorted[(idx - 1 + sorted.length) % sorted.length].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!active) return null;
  const run = (fn: () => Promise<unknown>) => () => fn().catch((e) => toast(errorMessage(e), "error"));

  return (
    <div className="flex flex-col gap-3">
      <FilePreview
        key={active.id}
        file={toPreviewFile(active)}
        onOpenExternally={run(() => openItemFile(active.path))}
        onShowInFolder={run(() => showItemFileInFolder(active.path))}
      />
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((f) => (
            <button
              key={f.id}
              onClick={() => setCurrent(f.id)}
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
