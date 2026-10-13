import { formatDate } from "../lib/util";
import type { ListItem } from "../types";
import { Gallery } from "./Gallery";
import { Markdown } from "./Markdown";
import { Modal } from "./Modal";

interface Props {
  item: ListItem;
  listName?: string;
  onEdit: () => void;
  onDelete: () => void;
  onMarkDone: () => void;
  onClose: () => void;
}

export function ListItemDetail({ item, listName, onEdit, onDelete, onMarkDone, onClose }: Props) {
  return (
    <Modal
      title={item.title}
      onClose={onClose}
      size="xl"
      columnScroll
      closeOnBackdrop
      footer={
        <>
          <button className="btn btn-danger mr-auto" onClick={onDelete}>
            Delete
          </button>
          <button className="btn btn-secondary" onClick={onEdit}>
            Edit
          </button>
          <button className="btn btn-primary" onClick={onMarkDone}>
            ✓ Mark as done
          </button>
        </>
      }
    >
      {/* Only the text column scrolls; the media column stays in view. */}
      <div className="grid gap-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-[minmax(0,1fr)]">
        <div className="md:min-h-0 md:overflow-y-auto">
          <Gallery images={item.images} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 md:min-h-0">
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            {listName && <span className="chip border-accent-500/50 bg-accent-500/15 text-accent-300">{listName}</span>}
            <span>Added {formatDate(item.addedDate)}</span>
          </div>
          {/* List and date stay visible; only the description scrolls. */}
          <div className="border-t border-zinc-800 pt-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-2">
            <Markdown text={item.description} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
