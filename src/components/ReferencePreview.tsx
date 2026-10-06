import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../lib/util";
import { imageSrc } from "../services/images";
import { extensionOf, formatSize, isMarkdown, readReferenceText, referencePath } from "../services/references";
import type { Reference } from "../types";
import { FileTypeIcon } from "./FileTypeIcon";
import { Markdown } from "./Markdown";

/** Text files above this size are not rendered inline. */
const MAX_PREVIEW_TEXT_BYTES = 3 * 1024 * 1024;

interface Props {
  reference: Reference;
  onOpenExternally: () => void;
}

export function ReferencePreview({ reference: r, onOpenExternally }: Props) {
  if (r.fileType === "image") return <ImageZoom src={imageSrc(referencePath(r))} />;
  if (r.fileType === "video") return <VideoPreview reference={r} onOpenExternally={onOpenExternally} />;
  if (r.fileType === "text") return <TextPreview reference={r} onOpenExternally={onOpenExternally} />;
  return (
    <Placeholder reference={r} onOpenExternally={onOpenExternally}>
      This file type can't be previewed here.
    </Placeholder>
  );
}

function Placeholder({ reference: r, onOpenExternally, children }: Props & { children: React.ReactNode }) {
  return (
    <div className="flex h-[28rem] max-h-[60vh] flex-col items-center justify-center gap-3 rounded-xl bg-zinc-950 p-6 text-center text-zinc-400">
      <FileTypeIcon type={r.fileType} size={56} className="text-zinc-600" />
      <span className="text-sm font-semibold tracking-wider text-zinc-500">
        {extensionOf(r.originalFileName).toUpperCase() || "FILE"} · {formatSize(r.fileSize)}
      </span>
      <p className="max-w-sm text-sm">{children}</p>
      <button className="btn btn-secondary mt-1" onClick={onOpenExternally}>
        Open in default app
      </button>
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

function VideoPreview({ reference: r, onOpenExternally }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <Placeholder reference={r} onOpenExternally={onOpenExternally}>
        This video format can't be played inside the app (common for some .mkv/.avi files). Open it in your default video
        player instead.
      </Placeholder>
    );
  }
  return (
    <div className="flex h-[28rem] max-h-[60vh] items-center justify-center overflow-hidden rounded-xl bg-black">
      <video
        src={imageSrc(referencePath(r))}
        poster={r.thumbnailPath ? imageSrc(r.thumbnailPath) : undefined}
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

function TextPreview({ reference: r, onOpenExternally }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tooBig = r.fileSize > MAX_PREVIEW_TEXT_BYTES;

  useEffect(() => {
    if (tooBig) return;
    let cancelled = false;
    readReferenceText(r)
      .then((t) => !cancelled && setText(t))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [r, tooBig]);

  if (tooBig || error) {
    return (
      <Placeholder reference={r} onOpenExternally={onOpenExternally}>
        {tooBig ? "This file is too large to preview here." : `Could not read the file: ${error}`}
      </Placeholder>
    );
  }
  return (
    <div className="h-[28rem] max-h-[60vh] overflow-auto rounded-xl bg-zinc-950 p-5">
      {text === null ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : isMarkdown(r) ? (
        <Markdown text={text} />
      ) : (
        <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-zinc-300">{text}</pre>
      )}
    </div>
  );
}
