import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState } from "react";

// Tauri's native drag & drop gives real file paths (and grants fs access to them), which lets us
// copy large files without loading them into memory. Drops go to the most recently mounted target,
// so an open dialog takes precedence over the page behind it.

interface Target {
  onDrop: (paths: string[]) => void;
  setHovering: (hovering: boolean) => void;
}

const stack: Target[] = [];
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  void getCurrentWebview().onDragDropEvent((event) => {
    const top = stack[stack.length - 1];
    if (!top) return;
    const p = event.payload;
    if (p.type === "enter" || p.type === "over") top.setHovering(true);
    else if (p.type === "leave") top.setHovering(false);
    else if (p.type === "drop") {
      top.setHovering(false);
      if (p.paths.length) top.onDrop(p.paths);
    }
  });
}

/** Receives files dropped onto the window while `enabled`. Returns whether files are being dragged over it. */
export function useFileDrop(onDrop: (paths: string[]) => void, enabled = true): boolean {
  const [hovering, setHovering] = useState(false);
  const handler = useRef(onDrop);
  handler.current = onDrop;

  useEffect(() => {
    if (!enabled) return;
    listen();
    const target: Target = { onDrop: (paths) => handler.current(paths), setHovering };
    stack.forEach((t) => t.setHovering(false));
    stack.push(target);
    return () => {
      stack.splice(stack.indexOf(target), 1);
      setHovering(false);
    };
  }, [enabled]);

  return hovering;
}
