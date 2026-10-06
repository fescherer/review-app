import { useEffect, useState } from "react";
import { coverOf, imageSrc } from "../services/images";
import type { MediaImage } from "../types";

/** Large image viewer with a thumbnail strip. Starts on the cover. */
export function Gallery({ images }: { images: MediaImage[] }) {
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const [current, setCurrent] = useState(() => coverOf(sorted)?.id);
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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[28rem] max-h-[55vh] items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
        <img src={imageSrc(active.path)} alt="" className="max-h-full max-w-full object-contain" />
      </div>
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img) => (
            <button
              key={img.id}
              onClick={() => setCurrent(img.id)}
              className={`h-20 w-14 shrink-0 overflow-hidden rounded-md border-2 transition ${
                img.id === active.id ? "border-accent-400" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={imageSrc(img.thumbnailPath)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
