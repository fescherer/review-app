import { useEffect, type ReactNode } from "react";

interface Props {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  /** Disable closing (✕ and Escape), e.g. while saving. Clicking outside never closes a modal. */
  locked?: boolean;
  /**
   * For two-column detail views: the popup is at most 90vh tall and the body doesn't scroll as a whole;
   * the children's columns scroll on their own (below the md breakpoint the body scrolls as usual).
   */
  columnScroll?: boolean;
}

const WIDTHS = { md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" };

export function Modal({ title, onClose, children, footer, size = "lg", locked, columnScroll }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, locked]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className={`flex ${columnScroll ? "max-h-[90vh]" : "max-h-full"} w-full ${WIDTHS[size]} flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl`}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-3.5">
            <h2 className="min-w-0 truncate text-lg font-semibold">{title}</h2>
            <button className="btn btn-ghost -mr-2 px-2" onClick={onClose} disabled={locked} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        )}
        <div
          className={`min-h-0 flex-1 overflow-y-auto p-5 ${columnScroll ? "md:flex md:flex-col md:overflow-hidden" : ""}`}
        >
          {children}
        </div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
