import { ask } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Modal } from "../components/Modal";
import { PromptModal } from "../components/PromptModal";
import { useToast } from "../components/Toast";
import { errorMessage } from "../lib/util";
import { DB_FILE } from "../services/dataFolder";
import { exportAll } from "../services/exportService";
import { getRoot, joinAbs } from "../services/fileSystem";
import * as lists from "../services/lists";
import * as tags from "../services/tags";
import type { MediaList, Tag } from "../types";

interface Props {
  onChangeFolder: () => void;
}

type Dialog =
  | { kind: "newTag" }
  | { kind: "renameTag"; tag: Tag }
  | { kind: "deleteTag"; tag: Tag }
  | { kind: "newList" }
  | { kind: "renameList"; list: MediaList }
  | null;

export function SettingsPage({ onChangeFolder }: Props) {
  const toast = useToast();
  const [tagRows, setTagRows] = useState<Tag[]>([]);
  const [listRows, setListRows] = useState<MediaList[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [exporting, setExporting] = useState(false);
  const root = getRoot();

  const reload = useCallback(async () => {
    try {
      const [t, l] = await Promise.all([tags.listTags(), lists.listLists()]);
      setTagRows(t);
      setListRows(l);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const deleteTag = async (tag: Tag) => {
    if (tag.reviewCount > 0) return setDialog({ kind: "deleteTag", tag });
    if (!(await ask(`Delete the tag "${tag.name}"?`, { title: "Delete tag", kind: "warning", okLabel: "Delete" }))) return;
    try {
      await tags.deleteTag(tag.id);
      toast("Tag deleted.");
      await reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const deleteList = async (list: MediaList) => {
    const msg =
      list.itemCount > 0
        ? `Delete the list "${list.name}" and its ${list.itemCount} item(s)?\n\nAll of their images will be permanently deleted.`
        : `Delete the list "${list.name}"?`;
    if (!(await ask(msg, { title: "Delete list", kind: "warning", okLabel: "Delete" }))) return;
    try {
      await lists.deleteList(list.id);
      toast("List deleted.");
      await reload();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const path = await exportAll();
      toast(`Backup saved:\n${path}`);
      await revealItemInDir(path).catch(() => undefined);
    } catch (e) {
      toast(`Export failed: ${errorMessage(e)}`, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Section title="Data folder" description="Your database and all images live here. Point it at a Google Drive folder to sync between PCs.">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-300" title={root}>
            {root}
          </code>
          <button className="btn btn-ghost" onClick={() => revealItemInDir(joinAbs(root, DB_FILE)).catch((e) => toast(errorMessage(e), "error"))}>
            Show in Explorer
          </button>
          <button className="btn btn-secondary" onClick={onChangeFolder}>
            Change…
          </button>
        </div>
      </Section>

      <Section
        title="Tags"
        description="Every review has one tag. Each tag is a folder under reviews/."
        action={<button className="btn btn-secondary" onClick={() => setDialog({ kind: "newTag" })}>+ New tag</button>}
      >
        <Rows>
          {tagRows.map((t) => (
            <Row
              key={t.id}
              name={t.name}
              meta={`${t.reviewCount} review${t.reviewCount === 1 ? "" : "s"} · reviews/${t.slug}`}
              onRename={() => setDialog({ kind: "renameTag", tag: t })}
              onDelete={() => deleteTag(t)}
            />
          ))}
          {tagRows.length === 0 && <p className="px-4 py-3 text-sm text-zinc-500">No tags. Create one to start writing reviews.</p>}
        </Rows>
      </Section>

      <Section
        title="Lists"
        description="Watchlists and reading lists. Each list is a folder under lists/."
        action={<button className="btn btn-secondary" onClick={() => setDialog({ kind: "newList" })}>+ New list</button>}
      >
        <Rows>
          {listRows.map((l) => (
            <Row
              key={l.id}
              name={l.name}
              meta={`${l.itemCount} item${l.itemCount === 1 ? "" : "s"} · lists/${l.slug}`}
              onRename={() => setDialog({ kind: "renameList", list: l })}
              onDelete={() => deleteList(l)}
            />
          ))}
          {listRows.length === 0 && <p className="px-4 py-3 text-sm text-zinc-500">No lists yet.</p>}
        </Rows>
      </Section>

      <Section title="Export" description="Save every review and list item as a human-readable JSON file in exports/.">
        <button className="btn btn-secondary" onClick={runExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Export to JSON"}
        </button>
      </Section>

      {dialog?.kind === "newTag" && (
        <PromptModal title="New tag" label="Tag name" submitLabel="Create" onClose={() => setDialog(null)}
          onSubmit={async (name) => { await tags.createTag(name); toast("Tag created."); await reload(); }} />
      )}
      {dialog?.kind === "renameTag" && (
        <PromptModal title="Rename tag" label="Tag name" initial={dialog.tag.name} onClose={() => setDialog(null)}
          onSubmit={async (name) => { await tags.renameTag(dialog.tag.id, name); toast("Tag renamed."); await reload(); }} />
      )}
      {dialog?.kind === "newList" && (
        <PromptModal title="New list" label="List name" submitLabel="Create" onClose={() => setDialog(null)}
          onSubmit={async (name) => { await lists.createList(name); toast("List created."); await reload(); }} />
      )}
      {dialog?.kind === "renameList" && (
        <PromptModal title="Rename list" label="List name" initial={dialog.list.name} onClose={() => setDialog(null)}
          onSubmit={async (name) => { await lists.renameList(dialog.list.id, name); toast("List renamed."); await reload(); }} />
      )}
      {dialog?.kind === "deleteTag" && (
        <DeleteTagDialog
          tag={dialog.tag}
          others={tagRows.filter((t) => t.id !== dialog.tag.id)}
          onClose={() => setDialog(null)}
          onDone={async () => {
            setDialog(null);
            toast("Tag deleted and reviews moved.");
            await reload();
          }}
        />
      )}
    </div>
  );
}

function DeleteTagDialog({ tag, others, onClose, onDone }: { tag: Tag; others: Tag[]; onClose: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await tags.deleteTag(tag.id, target);
      await onDone();
    } catch (e) {
      toast(errorMessage(e), "error");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Delete “${tag.name}”`}
      size="md"
      onClose={onClose}
      locked={busy}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-danger" onClick={confirm} disabled={busy || !target}>
            {busy ? "Moving…" : "Move reviews & delete"}
          </button>
        </>
      }
    >
      {others.length === 0 ? (
        <p className="text-sm text-zinc-300">
          This tag has {tag.reviewCount} review(s) and there is no other tag to move them to. Create another tag first.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-300">
            This tag has {tag.reviewCount} review(s). Pick a tag to move them to (their image folders move too).
          </p>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            {others.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}
    </Modal>
  );
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-zinc-400">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">{children}</div>;
}

function Row({ name, meta, onRename, onDelete }: { name: string; meta: string; onRename: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/40">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-zinc-500">{meta}</div>
      </div>
      <button className="btn btn-ghost px-2.5 py-1 text-xs" onClick={onRename}>Rename</button>
      <button className="btn btn-ghost px-2.5 py-1 text-xs text-red-300 hover:text-red-200" onClick={onDelete}>Delete</button>
    </div>
  );
}
