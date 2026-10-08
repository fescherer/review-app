import { formatDate } from "../lib/util";
import type { Review, Tag } from "../types";
import { Gallery } from "./Gallery";
import { Markdown } from "./Markdown";
import { Modal } from "./Modal";
import { StarRating } from "./Stars";

interface Props {
  review: Review;
  tag?: Tag;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ReviewDetail({ review, tag, onEdit, onDelete, onClose }: Props) {
  return (
    <Modal
      title={review.title}
      onClose={onClose}
      size="xl"
      columnScroll
      footer={
        <>
          <button className="btn btn-danger mr-auto" onClick={onDelete}>
            Delete
          </button>
          <button className="btn btn-secondary" onClick={onEdit}>
            Edit
          </button>
        </>
      }
    >
      {/* Only the text column scrolls; the media column stays in view. */}
      <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-[minmax(0,1fr)]">
        <div className="md:min-h-0 md:overflow-y-auto">
          <Gallery images={review.images} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0">
          <div className="flex flex-wrap items-center gap-3">
            {tag && <span className="chip border-accent-500/50 bg-accent-500/15 text-accent-300">{tag.name}</span>}
            <span className="text-sm text-zinc-400">{formatDate(review.reviewDate)}</span>
          </div>
          <StarRating grade={review.grade} size={26} showValue />
          {/* Tag, date and stars stay visible; only the text scrolls. */}
          <div className="border-t border-zinc-800 pt-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-2">
            <Markdown text={review.reviewText} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
