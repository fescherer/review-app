import type { ReactNode } from "react";
import { coverOf, imageSrc } from "../services/images";
import type { MediaImage } from "../types";

interface Props {
  title: string;
  images: MediaImage[];
  onClick: () => void;
  children?: ReactNode;
}

/** Grid card: cover thumbnail + title, with optional extra content (e.g. stars). */
export function MediaCard({ title, images, onClick, children }: Props) {
  const cover = coverOf(images);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left transition hover:-translate-y-0.5 hover:border-zinc-600 hover:shadow-xl hover:shadow-black/40 focus-visible:outline-2 focus-visible:outline-accent-400"
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-zinc-800">
        {cover && (
          <img
            src={imageSrc(cover.thumbnailPath)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug" title={title}>
          {title}
        </h3>
        {children}
      </div>
    </button>
  );
}
