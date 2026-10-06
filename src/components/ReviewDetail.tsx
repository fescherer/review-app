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
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Gallery images={review.images} />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {tag && <span className="chip border-accent-500/50 bg-accent-500/15 text-accent-300">{tag.name}</span>}
            <span className="text-sm text-zinc-400">{formatDate(review.reviewDate)}</span>
          </div>
          <StarRating grade={review.grade} size={26} showValue />
          <Markdown text={review.reviewText} />
        </div>
      </div>
    </Modal>
  );
}
