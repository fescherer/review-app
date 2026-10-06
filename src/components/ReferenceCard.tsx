import { extensionOf } from "../services/references";
import { imageSrc } from "../services/images";
import type { RefTag, Reference } from "../types";
import { FileTypeIcon } from "./FileTypeIcon";

interface Props {
  reference: Reference;
  tagsById: Map<string, RefTag>;
  onClick: () => void;
}

const MAX_CHIPS = 3;

/** Masonry card: thumbnail (or text snippet / file icon), title and tag chips. */
export function ReferenceCard({ reference: r, tagsById, onClick }: Props) {
  const ext = extensionOf(r.originalFileName).toUpperCase() || "FILE";
  const tags = r.tagIds.map((id) => tagsById.get(id)).filter((t): t is RefTag => !!t);

  let body;
  if (r.thumbnailPath) {
    body = (
      <div className="relative bg-zinc-800">
        <img src={imageSrc(r.thumbnailPath)} alt="" loading="lazy" decoding="async" className="block w-full" />
        {r.fileType === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 pl-0.5 text-lg text-white backdrop-blur-sm">
              ▶
            </span>
          </span>
        )}
      </div>
    );
  } else if (r.fileType === "text" && r.textPreview) {
    body = (
      <pre className="max-h-44 overflow-hidden whitespace-pre-wrap break-words bg-zinc-950/70 p-3 font-mono text-[11px] leading-relaxed text-zinc-400 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
        {r.textPreview.split("\n").slice(0, 10).join("\n")}
      </pre>
    );
  } else {
    body = (
      <div className="flex h-32 flex-col items-center justify-center gap-2 bg-zinc-800/60 text-zinc-500">
        <FileTypeIcon type={r.fileType} size={36} />
        <span className="text-xs font-semibold tracking-wider">{ext}</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left transition hover:border-zinc-600 hover:shadow-xl hover:shadow-black/40 focus-visible:outline-2 focus-visible:outline-accent-400"
    >
      {body}
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start gap-1.5">
          {r.fileType !== "image" && <FileTypeIcon type={r.fileType} size={14} className="mt-0.5 shrink-0 text-zinc-500" />}
          <h3 className="line-clamp-2 min-w-0 text-sm font-medium leading-snug" title={r.title}>
            {r.title}
          </h3>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, MAX_CHIPS).map((t) => (
              <span key={t.id} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                {t.name}
              </span>
            ))}
            {tags.length > MAX_CHIPS && (
              <span className="rounded-full px-1 py-0.5 text-[10px] text-zinc-500">+{tags.length - MAX_CHIPS}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
