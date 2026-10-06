import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FILE_TYPE_LABELS, FileTypeIcon } from "../components/FileTypeIcon";
import { ImportDialog } from "../components/ImportDialog";
import { ReferenceCard } from "../components/ReferenceCard";
import { ReferenceDetail } from "../components/ReferenceDetail";
import { useToast } from "../components/Toast";
import { useFileDrop } from "../lib/fileDrop";
import { useDebounced } from "../lib/hooks";
import { errorMessage, shuffle } from "../lib/util";
import { createRefTag, listRefTags } from "../services/refTags";
import * as refs from "../services/references";
import type { FileType, ID, ImportSource, RefSortField, RefTag, Reference, SortDirection } from "../types";

const FILE_TYPES: FileType[] = ["image", "video", "text", "other"];
const SORT_LABELS: Record<RefSortField, string> = {
  createdAt: "Date added",
  title: "Title",
  fileSize: "File size",
  random: "Random",
};

type TagMode = "and" | "or";

const hasTags = (r: Reference, tagIds: ID[], mode: TagMode) =>
  tagIds.length === 0 || (mode === "and" ? tagIds.every((t) => r.tagIds.includes(t)) : tagIds.some((t) => r.tagIds.includes(t)));

export function ReferencesPage() {
  const toast = useToast();
  const [all, setAll] = useState<Reference[]>([]);
  const [tags, setTags] = useState<RefTag[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [text, setText] = useState("");
  const [types, setTypes] = useState<FileType[]>([]);
  const [selectedTags, setSelectedTags] = useState<ID[]>([]);
  const [mode, setMode] = useState<TagMode>("and");
  const [sortBy, setSortBy] = useState<RefSortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  /** Position of each reference in the current random order (Fisher–Yates), used when sorting by "random". */
  const [randomRank, setRandomRank] = useState<Map<ID, number>>(new Map());
  const [textMatches, setTextMatches] = useState<Set<ID> | null>(null);

  const [openId, setOpenId] = useState<ID | null>(null);
  const [importing, setImporting] = useState<ImportSource[] | null>(null);
  const [collecting, setCollecting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([refs.listReferences(), listRefTags()]);
      setAll(r);
      setTags(t);
      setSelectedTags((sel) => sel.filter((id) => t.some((x) => x.id === id)));
    } catch (e) {
      toast(`Could not load references: ${errorMessage(e)}`, "error");
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Full-text search (title, notes, original name, text file contents) runs in SQLite.
  const query = useDebounced(text.trim());
  useEffect(() => {
    if (!query) return setTextMatches(null);
    let cancelled = false;
    refs
      .searchReferenceIds(query)
      .then((ids) => !cancelled && setTextMatches(ids))
      .catch((e) => toast(errorMessage(e), "error"));
    return () => {
      cancelled = true;
    };
  }, [query, all, toast]);

  // Everything except the tag filter: the base for tag facet counts.
  const base = useMemo(
    () => all.filter((r) => (!textMatches || textMatches.has(r.id)) && (types.length === 0 || types.includes(r.fileType))),
    [all, textMatches, types],
  );

  const results = useMemo(() => {
    const list = base.filter((r) => hasTags(r, selectedTags, mode));
    if (sortBy === "random") {
      // References added after the last shuffle go to the end until the next shuffle.
      const rank = (r: Reference) => randomRank.get(r.id) ?? Number.MAX_SAFE_INTEGER;
      return list.sort((a, b) => rank(a) - rank(b));
    }
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp: Record<Exclude<RefSortField, "random">, (a: Reference, b: Reference) => number> = {
      createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
      title: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }),
      fileSize: (a, b) => a.fileSize - b.fileSize,
    };
    return list.sort((a, b) => cmp[sortBy](a, b) * dir || b.createdAt.localeCompare(a.createdAt));
  }, [base, selectedTags, mode, sortBy, sortDir, randomRank]);

  /**
   * For each tag: how many results there would be with that tag selected too (AND), or how many of the
   * search/type matches carry it (OR). Zero means the combination doesn't exist, so the chip is dimmed.
   */
  const facetCounts = useMemo(() => {
    const counts = new Map<ID, number>();
    const pool = mode === "and" ? results : base;
    for (const r of pool) for (const t of r.tagIds) counts.set(t, (counts.get(t) ?? 0) + 1);
    return counts;
  }, [mode, results, base]);

  const typeCounts = useMemo(() => {
    const counts = new Map<FileType, number>();
    for (const r of all) {
      if ((!textMatches || textMatches.has(r.id)) && hasTags(r, selectedTags, mode)) {
        counts.set(r.fileType, (counts.get(r.fileType) ?? 0) + 1);
      }
    }
    return counts;
  }, [all, textMatches, selectedTags, mode]);

  const reshuffle = () => {
    setRandomRank(new Map(shuffle(all.map((r) => r.id)).map((id, i) => [id, i])));
    setSortBy("random");
  };

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const current = openId ? all.find((r) => r.id === openId) : undefined;

  const createTag = useCallback(async (name: string) => {
    const tag = await createRefTag(name);
    setTags((ts) => (ts.some((t) => t.id === tag.id) ? ts : [...ts, tag].sort((a, b) => a.name.localeCompare(b.name))));
    return tag;
  }, []);

  const startImport = async (collect: () => Promise<ImportSource[]>) => {
    setCollecting(true);
    try {
      const sources = await collect();
      if (sources.length) setImporting(sources);
    } catch (e) {
      toast(`Could not read the files: ${errorMessage(e)}`, "error");
    } finally {
      setCollecting(false);
    }
  };

  const dropping = useFileDrop((paths) => startImport(() => refs.sourcesFromPaths(paths)), !openId && !importing);

  const remove = async (r: Reference) => {
    const ok = await ask(`Delete "${r.title}"?\n\nThe file and its thumbnail will be permanently deleted from references/.`, {
      title: "Delete reference",
      kind: "warning",
      okLabel: "Delete",
    });
    if (!ok) return;
    try {
      await refs.deleteReference(r.id);
      setOpenId(null);
      toast("Reference deleted.");
      await reload();
    } catch (e) {
      toast(`Could not delete: ${errorMessage(e)}`, "error");
    }
  };

  const toggleTag = (id: ID) => setSelectedTags((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleType = (t: FileType) => setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  const filtered = !!text.trim() || types.length > 0 || selectedTags.length > 0;

  return (
    <div className="relative flex flex-col gap-4">
      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-accent-600/15 backdrop-blur-[2px]">
          <div className="rounded-2xl border-2 border-dashed border-accent-400 bg-zinc-950/80 px-10 py-8 text-lg font-medium text-accent-300">
            Drop files or folders to add references
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-sm flex-1"
          type="search"
          placeholder="Search titles, notes, file names and text…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select
          className="input w-auto"
          value={sortBy}
          onChange={(e) => {
            const value = e.target.value as RefSortField;
            if (value === "random") reshuffle();
            else setSortBy(value);
          }}
          aria-label="Sort by"
        >
          {Object.entries(SORT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        {sortBy !== "random" && (
          <button className="btn btn-ghost px-2.5" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
            {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        )}
        <button className="btn btn-secondary" onClick={reshuffle} disabled={all.length < 2} title="Show references in a new random order">
          ⤮ {sortBy === "random" ? "Shuffle again" : "Shuffle"}
        </button>
        <div className="flex-1" />
        <button className="btn btn-secondary" disabled={collecting} onClick={() => startImport(refs.pickReferenceFolder)}>
          Import folder…
        </button>
        <button className="btn btn-primary" disabled={collecting} onClick={() => startImport(refs.pickReferenceFiles)}>
          {collecting ? "Reading…" : "+ Add files"}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Type</span>
          {FILE_TYPES.map((t) => {
            const on = types.includes(t);
            const n = typeCounts.get(t) ?? 0;
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`chip ${on ? "border-accent-500 bg-accent-500/20 text-accent-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"} ${!on && n === 0 ? "opacity-40" : ""}`}
              >
                <FileTypeIcon type={t} size={12} /> {FILE_TYPE_LABELS[t]} <span className="text-zinc-500">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Tags</span>
          <div className="mr-1 inline-flex overflow-hidden rounded-full border border-zinc-700 text-xs">
            {(["and", "or"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                title={m === "and" ? "Show references that have all selected tags" : "Show references that have any selected tag"}
                className={`px-2.5 py-1 ${mode === m ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
              >
                {m === "and" ? "All tags" : "Any tag"}
              </button>
            ))}
          </div>
          {tags.length === 0 && <span className="text-xs text-zinc-500">No tags yet. Add some when importing or in a reference.</span>}
          {tags.map((t) => {
            const on = selectedTags.includes(t.id);
            const n = facetCounts.get(t.id) ?? 0;
            return (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                className={`chip ${on ? "border-accent-500 bg-accent-500/20 text-accent-300" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"} ${!on && n === 0 ? "opacity-35" : ""}`}
              >
                {t.name} <span className={on ? "text-accent-300/70" : "text-zinc-500"}>{n}</span>
              </button>
            );
          })}
          {filtered && (
            <button
              className="ml-1 text-xs text-zinc-500 hover:text-zinc-300"
              onClick={() => {
                setSelectedTags([]);
                setTypes([]);
                setText("");
              }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {loaded && (
        <p className="-mb-1 text-xs text-zinc-500">
          {results.length} of {all.length} reference{all.length === 1 ? "" : "s"}
        </p>
      )}

      {loaded && results.length === 0 ? (
        <div className="py-24 text-center text-zinc-500">
          {all.length === 0 ? (
            <>
              <p className="text-lg text-zinc-300">No references yet</p>
              <p className="mt-1 text-sm">Drop images, videos, text files or anything else here, or use Add files / Import folder.</p>
            </>
          ) : (
            <p>Nothing matches these filters.</p>
          )}
        </div>
      ) : (
        <div className="columns-[220px] gap-4">
          {results.map((r) => (
            <ReferenceCard key={r.id} reference={r} tagsById={tagsById} onClick={() => setOpenId(r.id)} />
          ))}
        </div>
      )}

      {current && (
        <ReferenceDetail
          key={current.id + current.updatedAt}
          reference={current}
          allTags={tags}
          onCreateTag={createTag}
          onClose={() => setOpenId(null)}
          onDelete={() => remove(current)}
          onSave={async (update) => {
            await refs.updateReference(current.id, update);
            await reload();
          }}
        />
      )}

      {importing && (
        <ImportDialog
          sources={importing}
          allTags={tags}
          onCreateTag={createTag}
          onImported={() => void reload()}
          onClose={() => setImporting(null)}
        />
      )}
    </div>
  );
}
