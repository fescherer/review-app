import { useState } from "react";
import { openUrl } from "../lib/openUrl";
import { errorMessage } from "../lib/util";
import { formatSize, openInDefaultApp, showInFolder } from "../services/references";
import { ValidationError } from "../services/validation";
import type { RefTag, Reference, ReferenceUpdate } from "../types";
import { FILE_TYPE_LABELS } from "./FileTypeIcon";
import { Modal } from "./Modal";
import { ReferencePreview } from "./ReferencePreview";
import { TagInput } from "./TagInput";
import { useToast } from "./Toast";

interface Props {
  reference: Reference;
  allTags: RefTag[];
  onCreateTag: (name: string) => Promise<RefTag>;
  onSave: (update: ReferenceUpdate) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}

export function ReferenceDetail({ reference: r, allTags, onCreateTag, onSave, onDelete, onClose }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(r.title);
  const [notes, setNotes] = useState(r.notes);
  const [sourceUrl, setSourceUrl] = useState(r.sourceUrl);
  const [tagIds, setTagIds] = useState(r.tagIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    title !== r.title ||
    notes !== r.notes ||
    sourceUrl !== r.sourceUrl ||
    tagIds.length !== r.tagIds.length ||
    tagIds.some((id) => !r.tagIds.includes(id));

  const run = (fn: () => Promise<unknown>) => () =>
    fn().catch((e) => toast(errorMessage(e), "error"));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ title, notes, sourceUrl, tagIds });
      toast("Saved.");
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message);
      else toast(`Could not save: ${errorMessage(e)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={r.title}
      onClose={onClose}
      size="xl"
      locked={saving}
      footer={
        <>
          <button className="btn btn-danger mr-auto" onClick={onDelete} disabled={saving}>
            Delete
          </button>
          <button className="btn btn-ghost" onClick={run(() => showInFolder(r))}>
            Show in folder
          </button>
          <button className="btn btn-ghost" onClick={run(() => openInDefaultApp(r))}>
            Open in default app
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ReferencePreview key={r.id} reference={r} onOpenExternally={run(() => openInDefaultApp(r))} />

        <div className="flex min-w-0 flex-col gap-4">
          {error && (
            <div className="whitespace-pre-line rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="label" htmlFor="ref-title">Title</label>
            <input id="ref-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <span className="label">Tags</span>
            <TagInput allTags={allTags} value={tagIds} onChange={setTagIds} onCreate={onCreateTag} />
          </div>
          <div>
            <label className="label" htmlFor="ref-url">Source URL</label>
            <div className="flex gap-2">
              <input
                id="ref-url"
                className="input"
                placeholder="https://…"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
              {/^https?:\/\//i.test(sourceUrl.trim()) && (
                <button className="btn btn-ghost shrink-0 px-2.5" title="Open link" onClick={() => openUrl(sourceUrl.trim())}>
                  ↗
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ref-notes">Notes</label>
            <textarea
              id="ref-notes"
              className="input min-h-28 resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-zinc-500">
            <dt>Original file</dt>
            <dd className="truncate text-zinc-400" title={r.originalFileName}>{r.originalFileName}</dd>
            <dt>Type</dt>
            <dd className="text-zinc-400">{FILE_TYPE_LABELS[r.fileType]} · {formatSize(r.fileSize)}</dd>
            <dt>Added</dt>
            <dd className="text-zinc-400">{new Date(r.createdAt).toLocaleString()}</dd>
            <dt>Stored as</dt>
            <dd className="truncate text-zinc-400">references/{r.fileName}</dd>
          </dl>
        </div>
      </div>
    </Modal>
  );
}
