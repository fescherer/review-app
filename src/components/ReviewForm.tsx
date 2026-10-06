import { useState, type FormEvent } from "react";
import { useImageSelection } from "../lib/hooks";
import { errorMessage, today } from "../lib/util";
import { selectionFromImages } from "../services/images";
import { ValidationError } from "../services/validation";
import type { ImageSelection, Review, ReviewInput, Tag } from "../types";
import { ImagePicker } from "./ImagePicker";
import { Markdown } from "./Markdown";
import { Modal } from "./Modal";
import { StarInput } from "./Stars";
import { useToast } from "./Toast";

interface Props {
  heading: string;
  tags: Tag[];
  /** Edit an existing review. */
  review?: Review;
  /** Pre-filled values, e.g. from "Mark as done". */
  prefill?: { title: string; images: ImageSelection; tagId?: string };
  submitLabel?: string;
  onSubmit: (input: ReviewInput) => Promise<void>;
  onClose: () => void;
}

export function ReviewForm({ heading, tags, review, prefill, submitLabel = "Save", onSubmit, onClose }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(review?.title ?? prefill?.title ?? "");
  const [tagId, setTagId] = useState(review?.tagId ?? prefill?.tagId ?? tags[0]?.id ?? "");
  const [reviewDate, setReviewDate] = useState(review?.reviewDate ?? today());
  const [grade, setGrade] = useState(review?.grade ?? 0);
  const [reviewText, setReviewText] = useState(review?.reviewText ?? "");
  const [preview, setPreview] = useState(false);
  const [images, setImages] = useImageSelection(
    () => prefill?.images ?? (review ? selectionFromImages(review.images) : { drafts: [], coverKey: "" }),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ title, tagId, reviewDate, grade, reviewText, images });
    } catch (err) {
      if (err instanceof ValidationError) setError(err.message);
      else toast(`Could not save the review: ${errorMessage(err)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={heading}
      onClose={onClose}
      locked={saving}
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => submit()} disabled={saving}>
            {saving ? "Saving…" : submitLabel}
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
            <label className="label" htmlFor="rf-title">Title</label>
            <input id="rf-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="rf-tag">Tag</label>
            <select id="rf-tag" className="input" value={tagId} onChange={(e) => setTagId(e.target.value)}>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rf-date">Review date</label>
            <input id="rf-date" type="date" className="input" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
          </div>
        </div>

        <div>
          <span className="label">Grade</span>
          <StarInput value={grade} onChange={setGrade} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label mb-0" htmlFor="rf-text">Review</label>
            <div className="flex gap-1 text-xs">
              <button type="button" className={`rounded px-2 py-0.5 ${!preview ? "bg-zinc-700" : "text-zinc-400"}`} onClick={() => setPreview(false)}>
                Write
              </button>
              <button type="button" className={`rounded px-2 py-0.5 ${preview ? "bg-zinc-700" : "text-zinc-400"}`} onClick={() => setPreview(true)}>
                Preview
              </button>
            </div>
          </div>
          {preview ? (
            <div className="min-h-40 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
              <Markdown text={reviewText} />
            </div>
          ) : (
            <textarea
              id="rf-text"
              className="input min-h-40 resize-y font-mono text-[13px] leading-relaxed"
              placeholder="What did you think? Markdown is supported."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
          )}
        </div>

        <div>
          <span className="label">Images</span>
          <ImagePicker value={images} onChange={setImages} />
        </div>
      </form>
    </Modal>
  );
}
