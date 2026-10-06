import type { FileType } from "../types";

const PATHS: Record<FileType, string> = {
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01",
  video: "M4 6h12v12H4zM16 10l4-2.5v9L16 14",
  text: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  other: "M6 3h9l4 4v14H6zM14 3v5h5",
};

export function FileTypeIcon({ type, size = 16, className = "" }: { type: FileType; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label={type}
    >
      <path d={PATHS[type]} />
    </svg>
  );
}

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  image: "Image",
  video: "Video",
  text: "Text",
  other: "Other",
};
