import { readTextFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/util";
import { toAbs } from "../services/fileSystem";
import { imageSrc } from "../services/images";
import { extensionOf, formatSize, referencePath } from "../services/references";
import type { FileType, Reference } from "../types";
import { FileTypeIcon } from "./FileTypeIcon";
import { Markdown } from "./Markdown";

/** Text files above this size are not rendered inline. */
const MAX_PREVIEW_TEXT_BYTES = 3 * 1024 * 1024;

/** A stored file to preview: a reference, or a file of a review / list item. */
export interface PreviewFile {
  /** Relative to the data folder. */
  path: string;
  fileType: FileType;
  /** Original file name (extension shown on the placeholder, Markdown detection). */
  fileName: string;
  fileSize: number;
  thumbnailPath: string | null;
}

interface Props {
  file: PreviewFile;
  onOpenExternally: () => void;
  /** Adds a "Show in folder" button next to "Open in default app" on files that can't be previewed. */
  onShowInFolder?: () => void;
}

/** Preview of any stored file: image with zoom, video player, rendered text/Markdown, or file icon + actions. */
export function FilePreview({ file, onOpenExternally, onShowInFolder }: Props) {
  if (file.fileType === "image") return <ImageZoom src={imageSrc(file.path)} />;
  if (file.fileType === "video") return <VideoPreview file={file} onOpenExternally={onOpenExternally} onShowInFolder={onShowInFolder} />;
  if (file.fileType === "text") return <TextPreview file={file} onOpenExternally={onOpenExternally} onShowInFolder={onShowInFolder} />;
  return (
    <Placeholder file={file} onOpenExternally={onOpenExternally} onShowInFolder={onShowInFolder}>
      This file type can't be previewed here.
    </Placeholder>
  );
}

/** Preview in the References tab. */
export function ReferencePreview({ reference: r, onOpenExternally }: { reference: Reference; onOpenExternally: () => void }) {
  const file: PreviewFile = {
    path: referencePath(r),
    fileType: r.fileType,
    fileName: r.originalFileName,
    fileSize: r.fileSize,
    thumbnailPath: r.thumbnailPath,
  };
  return <FilePreview file={file} onOpenExternally={onOpenExternally} />;
}

function Placeholder({ file, onOpenExternally, onShowInFolder, children }: Props & { children: React.ReactNode }) {
  return (
    <div className="flex h-[28rem] max-h-[60vh] flex-col items-center justify-center gap-3 rounded-xl bg-zinc-950 p-6 text-center text-zinc-400">
      <FileTypeIcon type={file.fileType} size={56} className="text-zinc-600" />
      <span className="text-sm font-semibold tracking-wider text-zinc-500">
        {extensionOf(file.fileName).toUpperCase() || "FILE"} · {formatSize(file.fileSize)}
      </span>
      <p className="max-w-sm text-sm">{children}</p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <button className="btn btn-secondary" onClick={onOpenExternally}>
          Open in default app
        </button>
        {onShowInFolder && (
          <button className="btn btn-ghost" onClick={onShowInFolder}>
            Show in folder
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- image with zoom & pan

function ImageZoom({ src }: { src: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  /** Zooms keeping the point under the cursor fixed. */
  const zoomAt = (next: number, clientX?: number, clientY?: number) => {
    const s = Math.min(8, Math.max(1, next));
    if (s === 1) return reset();
    const rect = box.current?.getBoundingClientRect();
    if (rect && clientX !== undefined && clientY !== undefined) {
      const cx = clientX - rect.left - rect.width / 2;
      const cy = clientY - rect.top - rect.height / 2;
      setOffset((o) => ({ x: cx - ((cx - o.x) * s) / scale, y: cy - ((cy - o.y) * s) / scale }));
    }
    setScale(s);
  };

  // Non-passive wheel listener so the modal doesn't scroll while zooming.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  useEffect(reset, [src]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={box}
        className={`relative flex h-[28rem] max-h-[60vh] select-none items-center justify-center overflow-hidden rounded-xl bg-zinc-950 ${
          scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
        onDoubleClick={(e) => (scale > 1 ? reset() : zoomAt(2.5, e.clientX, e.clientY))}
        onMouseDown={(e) => {
          if (scale > 1) drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onMouseMove={(e) => {
          const d = drag.current;
          if (d) setOffset({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transition: drag.current ? "none" : "transform 80ms" }}
        />
      </div>
      <div className="flex items-center gap-1 text-xs text-zinc-500">
        <button className="btn btn-ghost px-2 py-1" onClick={() => zoomAt(scale / 1.5)} disabled={scale <= 1}>
          −
        </button>
        <span className="w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <button className="btn btn-ghost px-2 py-1" onClick={() => zoomAt(scale * 1.5)} disabled={scale >= 8}>
          +
        </button>
        <button className="btn btn-ghost px-2 py-1" onClick={reset} disabled={scale === 1}>
          Fit
        </button>
        <span className="ml-auto">Scroll to zoom · drag to pan · double-click to toggle</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- video

function VideoPreview({ file, onOpenExternally, onShowInFolder }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <Placeholder file={file} onOpenExternally={onOpenExternally} onShowInFolder={onShowInFolder}>
        This video format can't be played inside the app (common for some .mkv/.avi files). Open it in your default video
        player instead.
      </Placeholder>
    );
  }
  return (
    <div className="flex h-[28rem] max-h-[60vh] items-center justify-center overflow-hidden rounded-xl bg-black">
      <video
        src={imageSrc(file.path)}
        poster={file.thumbnailPath ? imageSrc(file.thumbnailPath) : undefined}
        controls
        preload="metadata"
        className="max-h-full max-w-full"
        onError={() => setFailed(true)}
        onLoadedMetadata={(e) => {
          // Audio-only or undecodable video track: treat as unplayable.
          if (!e.currentTarget.videoWidth && !e.currentTarget.duration) setFailed(true);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- text

function TextPreview({ file, onOpenExternally, onShowInFolder }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tooBig = file.fileSize > MAX_PREVIEW_TEXT_BYTES;

  useEffect(() => {
    if (tooBig) return;
    let cancelled = false;
    readTextFile(toAbs(file.path))
      .then((t) => !cancelled && setText(t))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [file.path, tooBig]);

  if (tooBig || error) {
    return (
      <Placeholder file={file} onOpenExternally={onOpenExternally} onShowInFolder={onShowInFolder}>
        {tooBig ? "This file is too large to preview here." : `Could not read the file: ${error}`}
      </Placeholder>
    );
  }
  return (
    <div className="h-[28rem] max-h-[60vh] overflow-auto rounded-xl bg-zinc-950 p-5">
      {text === null ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : ["md", "markdown"].includes(extensionOf(file.fileName)) ? (
        <Markdown text={text} />
      ) : (
        <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-zinc-300">{text}</pre>
      )}
    </div>
  );
}
