import { useRef, useState } from "react";
import { useFileDrop } from "../lib/fileDrop";
import { errorMessage } from "../lib/util";
import {
  formatSize,
  importReferences,
  sourcesFromPaths,
  titleFromFileName,
  type ImportResult,
} from "../services/references";
import type { ImportProgress, ImportSource, RefTag } from "../types";
import { FileTypeIcon } from "./FileTypeIcon";
import { Modal } from "./Modal";
import { TagInput } from "./TagInput";
import { useToast } from "./Toast";

interface Props {
  sources: ImportSource[];
  allTags: RefTag[];
  onCreateTag: (name: string) => Promise<RefTag>;
  /** Called after an import ran (even partially), so the page can reload. */
  onImported: () => void;
  onClose: () => void;
}

interface Row {
  key: string;
  source: ImportSource;
  title: string;
}

let rowKey = 0;
const toRows = (sources: ImportSource[]): Row[] =>
  sources.map((source) => ({ key: String(rowKey++), source, title: titleFromFileName(source.name) }));

/** Step between choosing files and saving: shared tags, per-file titles, then a copy with progress. */
export function ImportDialog({ sources, allTags, onCreateTag, onImported, onClose }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() => toRows(sources));
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<"review" | "importing" | "done">("review");
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const cancelled = useRef(false);
  const [stopping, setStopping] = useState(false);

  // More files dropped while this dialog is open are added to the batch.
  const hovering = useFileDrop(async (paths) => {
    try {
      const more = await sourcesFromPaths(paths);
      setRows((r) => [...r, ...toRows(more)]);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }, phase === "review");

  const totalBytes = rows.reduce((s, r) => s + r.source.size, 0);

  const start = async () => {
    setPhase("importing");
    cancelled.current = false;
    try {
      const res = await importReferences(
        rows.map((r) => ({ source: r.source, title: r.title })),
        tagIds,
        setProgress,
        () => cancelled.current,
      );
      setResult(res);
      onImported();
      if (res.failed.length === 0) {
        toast(`Imported ${res.imported.length} reference${res.imported.length === 1 ? "" : "s"}.`);
        onClose();
      } else {
        setPhase("done");
      }
    } catch (e) {
      toast(`Import failed: ${errorMessage(e)}`, "error");
      onImported();
      setPhase("review");
    }
  };

  if (phase === "importing") {
    if (!progress) return null;
    const pct = progress.bytesTotal ? (progress.bytesDone / progress.bytesTotal) * 100 : (progress.done / progress.total) * 100;
    return (
      <Modal
        title="Importing…"
        size="md"
        onClose={() => undefined}
        locked
        footer={
          <button
            className="btn btn-ghost"
            onClick={() => {
              cancelled.current = true;
              setStopping(true);
            }}
            disabled={stopping}
          >
            {stopping ? "Stopping after this file…" : "Stop"}
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-accent-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-sm tabular-nums text-zinc-400">
            <span>
              {Math.min(progress.done + 1, progress.total)} of {progress.total} files
            </span>
            <span>
              {formatSize(progress.bytesDone)} / {formatSize(progress.bytesTotal)}
            </span>
          </div>
          <p className="truncate text-xs text-zinc-500">Copying {progress.current}</p>
        </div>
      </Modal>
    );
  }

  if (phase === "done" && result) {
    return (
      <Modal title="Import finished with problems" size="md" onClose={onClose} footer={<button className="btn btn-primary" onClick={onClose}>Close</button>}>
        <p className="mb-3 text-sm text-zinc-300">
          Imported {result.imported.length}, failed {result.failed.length}:
        </p>
        <ul className="flex flex-col gap-1 text-xs">
          {result.failed.map((f, i) => (
            <li key={i} className="rounded bg-red-950/50 px-2 py-1 text-red-200">
              <b>{f.name}</b>: {f.error}
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Add ${rows.length} reference${rows.length === 1 ? "" : "s"}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="mr-auto self-center text-xs text-zinc-500">{formatSize(totalBytes)} will be copied into references/</span>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={start} disabled={!rows.length || phase !== "review"}>
            Import
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <span className="label">Tags for all files</span>
          <TagInput allTags={allTags} value={tagIds} onChange={setTagIds} onCreate={onCreateTag} placeholder="Type a tag and press Enter…" />
        </div>
        <div>
          <span className="label">Titles</span>
          <div
            className={`max-h-[45vh] divide-y divide-zinc-800 overflow-y-auto rounded-xl border ${
              hovering ? "border-accent-400 bg-accent-500/5" : "border-zinc-800"
            }`}
          >
            {rows.map((row) => (
              <div key={row.key} className="flex items-center gap-3 px-3 py-2">
                <FileTypeIcon type={row.source.fileType} size={18} className="shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full rounded bg-transparent px-1 py-0.5 text-sm outline-none hover:bg-zinc-800 focus:bg-zinc-800"
                    value={row.title}
                    onChange={(e) => setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, title: e.target.value } : r)))}
                  />
                  <div className="truncate px-1 text-[11px] text-zinc-500" title={row.source.path}>
                    {row.source.name} · {formatSize(row.source.size)}
                  </div>
                </div>
                <button
                  className="text-xs text-zinc-500 hover:text-red-300"
                  onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                  aria-label="Remove from import"
                >
                  ✕
                </button>
              </div>
            ))}
            {rows.length === 0 && <p className="p-4 text-center text-sm text-zinc-500">No files. Drop some here.</p>}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">Originals are copied, never moved or changed. Drop more files to add them.</p>
        </div>
      </div>
    </Modal>
  );
}
