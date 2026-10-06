import { useEffect, useRef, useState } from "react";
import type { ImageSelection } from "../types";
import { releaseDrafts } from "../services/images";

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Image selection state for forms; frees preview object URLs on unmount. */
export function useImageSelection(initial: () => ImageSelection) {
  const [selection, setSelection] = useState<ImageSelection>(initial);
  const ref = useRef(selection);
  ref.current = selection;
  useEffect(() => () => releaseDrafts(ref.current.drafts), []);
  return [selection, setSelection] as const;
}
