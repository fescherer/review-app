import { useState, type FormEvent } from "react";
import { useImageSelection } from "../lib/hooks";
import { errorMessage, today } from "../lib/util";
import { selectionFromImages } from "../services/images";
import { ValidationError } from "../services/validation";
import type { ListItem, ListItemInput, MediaList } from "../types";
import { ImagePicker } from "./ImagePicker";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

interface Props {
  heading: string;
  lists: MediaList[];
  listId: string;
  item?: ListItem;
  onSubmit: (input: ListItemInput) => Promise<void>;
  onClose: () => void;
}

export function ListItemForm({ heading, lists, listId: initialListId, item, onSubmit, onClose }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(item?.title ?? "");
  const [listId, setListId] = useState(item?.listId ?? initialListId);
  const [addedDate, setAddedDate] = useState(item?.addedDate ?? today());
  const [description, setDescription] = useState(item?.description ?? "");
  const [images, setImages] = useImageSelection(() =>
    item ? selectionFromImages(item.images) : { drafts: [], coverKey: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ title, listId, addedDate, description, images });
    } catch (err) {
      if (err instanceof ValidationError) setError(err.message);
      else toast(`Could not save: ${errorMessage(err)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={heading}
      onClose={onClose}
      locked={saving}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => submit()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && (
          <div className="whitespace-pre-line rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_180px_170px]">
          <div>
            <label className="label" htmlFor="lf-title">Title</label>
            <input id="lf-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="lf-list">List</label>
            <select id="lf-list" className="input" value={listId} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lf-date">Added</label>
            <input id="lf-date" type="date" className="input" value={addedDate} onChange={(e) => setAddedDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="lf-desc">Why do you want it?</label>
          <textarea
            id="lf-desc"
            className="input min-h-28 resize-y"
            placeholder="A friend recommended it, saw the trailer… Markdown is supported."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <span className="label">Images</span>
          <ImagePicker value={images} onChange={setImages} />
        </div>
      </form>
    </Modal>
  );
}
