import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MediaCard } from "../components/MediaCard";
import { ReviewDetail } from "../components/ReviewDetail";
import { ReviewForm } from "../components/ReviewForm";
import { StarRating } from "../components/Stars";
import { TagChips } from "../components/TagChips";
import { useToast } from "../components/Toast";
import { useDebounced } from "../lib/hooks";
import { errorMessage } from "../lib/util";
import * as reviews from "../services/reviews";
import { listTags } from "../services/tags";
import type { Review, ReviewFilters, ReviewSortField, Tag } from "../types";

const SORT_LABELS: Record<ReviewSortField, string> = {
  reviewDate: "Review date",
  grade: "Grade",
  title: "Title",
  createdAt: "Date added",
};

type Panel = { kind: "new" } | { kind: "view"; id: string } | { kind: "edit"; id: string } | null;

export function ReviewsPage() {
  const toast = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReviewFilters>(reviews.DEFAULT_FILTERS);
  const [panel, setPanel] = useState<Panel>(null);
  const text = useDebounced(filters.text);
  const query = useMemo(() => ({ ...filters, text }), [filters, text]);

  const set = <K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const reload = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([listTags(), reviews.searchReviews(query)]);
      setTags(t);
      setItems(r);
    } catch (e) {
      toast(`Could not load reviews: ${errorMessage(e)}`, "error");
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const current = panel && panel.kind !== "new" ? items.find((r) => r.id === panel.id) : undefined;


  const remove = async (review: Review) => {
    const ok = await ask(`Delete "${review.title}"?\n\nThe review and its image folder will be permanently deleted.`, {
      title: "Delete review",
      kind: "warning",
      okLabel: "Delete",
    });
    if (!ok) return;
    try {
      await reviews.deleteReview(review.id);
      setPanel(null);
      toast("Review deleted.");
      await reload();
    } catch (e) {
      toast(`Could not delete: ${errorMessage(e)}`, "error");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-sm flex-1"
          type="search"
          placeholder="Search titles and reviews…"
          value={filters.text}
          onChange={(e) => set("text", e.target.value)}
        />
        <div className="flex items-center gap-1">
          <select
            className="input w-auto"
            value={filters.sortBy}
            onChange={(e) => set("sortBy", e.target.value as ReviewSortField)}
            aria-label="Sort by"
          >
            {Object.entries(SORT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-ghost px-2.5"
            onClick={() => set("sortDir", filters.sortDir === "asc" ? "desc" : "asc")}
            title={filters.sortDir === "asc" ? "Ascending" : "Descending"}
          >
            {filters.sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>
        <div className="flex-1" />
        <button className="btn btn-primary" onClick={() => setPanel({ kind: "new" })} disabled={!tags.length}>
          + New review
        </button>
      </div>

      <TagChips options={tags} selected={filters.tagIds} onChange={(ids) => set("tagIds", ids)} />

      {!loading && (
        <p className="-mt-2 text-xs text-zinc-500">
          {items.length} review{items.length === 1 ? "" : "s"}
        </p>
      )}

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center text-zinc-500">
          {filters.text || filters.tagIds.length ? (
            <p>No reviews match your search.</p>
          ) : (
            <>
              <p className="text-lg text-zinc-300">No reviews yet</p>
              <p className="text-sm">Write about something you've watched, read or played.</p>
              <button className="btn btn-primary mt-2" onClick={() => setPanel({ kind: "new" })} disabled={!tags.length}>
                + New review
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="card-grid">
          {items.map((r) => (
            <MediaCard key={r.id} title={r.title} images={r.images} onClick={() => setPanel({ kind: "view", id: r.id })}>
              <div className="mt-auto flex items-center justify-between gap-2">
                <StarRating grade={r.grade} size={14} />
                <span className="truncate text-[11px] text-zinc-500">{tagById.get(r.tagId)?.name}</span>
              </div>
            </MediaCard>
          ))}
        </div>
      )}

      {panel?.kind === "view" && current && (
        <ReviewDetail
          review={current}
          tag={tagById.get(current.tagId)}
          onClose={() => setPanel(null)}
          onEdit={() => setPanel({ kind: "edit", id: current.id })}
          onDelete={() => remove(current)}
        />
      )}

      {panel?.kind === "new" && (
        <ReviewForm
          heading="New review"
          tags={tags}
          submitLabel="Create review"
          onClose={() => setPanel(null)}
          onSubmit={async (input) => {
            const created = await reviews.createReview(input);
            toast("Review saved.");
            await reload();
            setPanel({ kind: "view", id: created.id });
          }}
        />
      )}

      {panel?.kind === "edit" && current && (
        <ReviewForm
          heading={`Edit “${current.title}”`}
          tags={tags}
          review={current}
          onClose={() => setPanel({ kind: "view", id: current.id })}
          onSubmit={async (input) => {
            await reviews.updateReview(current.id, input);
            toast("Review updated.");
            await reload();
            setPanel({ kind: "view", id: current.id });
          }}
        />
      )}
    </div>
  );
}
