import { useMemo, useRef, useState } from "react";
import { errorMessage } from "../lib/util";
import type { ID, RefTag } from "../types";

interface Props {
  allTags: RefTag[];
  value: ID[];
  onChange: (ids: ID[]) => void;
  /** Creates (or finds) a tag by name; called when Enter is pressed on a new name. */
  onCreate: (name: string) => Promise<RefTag>;
  placeholder?: string;
}

/** Chip input with autocomplete of existing tags. Enter on a new name creates the tag. */
export function TagInput({ allTags, value, onChange, onCreate, placeholder = "Add tags…" }: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  /** True once the user picked a suggestion with the arrow keys; Enter then takes it instead of creating. */
  const [navigated, setNavigated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(allTags.map((t) => [t.id, t])), [allTags]);
  const query = text.trim().toLowerCase();
  const suggestions = useMemo(() => {
    const free = allTags.filter((t) => !value.includes(t.id));
    if (!query) return free.slice(0, 8);
    const starts = free.filter((t) => t.name.toLowerCase().startsWith(query));
    const contains = free.filter((t) => !t.name.toLowerCase().startsWith(query) && t.name.toLowerCase().includes(query));
    return [...starts, ...contains].slice(0, 8);
  }, [allTags, value, query]);
  const exact = allTags.find((t) => t.name.toLowerCase() === query);
  const showCreate = !!query && !exact;

  const add = (id: ID) => {
    if (!value.includes(id)) onChange([...value, id]);
    setText("");
    setHighlight(0);
    setNavigated(false);
    setError(null);
  };

  const commit = async () => {
    if (exact) return add(exact.id);
    if (open && navigated && suggestions[highlight]) return add(suggestions[highlight].id);
    if (!query) return;
    try {
      const tag = await onCreate(text);
      add(tag.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="relative">
      <div
        className="input flex min-h-10 cursor-text flex-wrap items-center gap-1.5 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((id) => (
          <span key={id} className="chip border-accent-500/40 bg-accent-500/15 py-0.5 text-accent-300">
            {byId.get(id)?.name ?? "…"}
            <button
              type="button"
              className="-mr-1 ml-0.5 text-accent-300/70 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((v) => v !== id));
              }}
              aria-label="Remove tag"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-zinc-500"
          value={text}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlight(0);
            setNavigated(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Tab" && query && suggestions[0] && !exact) {
              e.preventDefault();
              add(suggestions[highlight]?.id ?? suggestions[0].id);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => (navigated ? Math.min(h + 1, suggestions.length - 1) : 0));
              setNavigated(true);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Escape" && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </div>
      {open && (suggestions.length > 0 || showCreate) && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 text-sm shadow-xl">
          {suggestions.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(t.id)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left ${navigated && i === highlight ? "bg-zinc-800" : "hover:bg-zinc-800"}`}
              >
                <span>{t.name}</span>
                <span className="text-xs text-zinc-500">{t.refCount}</span>
              </button>
            </li>
          ))}
          {showCreate && (
            <li className="border-t border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
              <kbd className="rounded bg-zinc-800 px-1">Enter</kbd> creates “{text.trim()}”
              {suggestions.length > 0 && (
                <>
                  {" "}· <kbd className="rounded bg-zinc-800 px-1">Tab</kbd> or <kbd className="rounded bg-zinc-800 px-1">↓</kbd> picks a suggestion
                </>
              )}
            </li>
          )}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
