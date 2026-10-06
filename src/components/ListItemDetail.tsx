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
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Gallery images={item.images} />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            {listName && <span className="chip border-accent-500/50 bg-accent-500/15 text-accent-300">{listName}</span>}
            <span>Added {formatDate(item.addedDate)}</span>
          </div>
          <Markdown text={item.description} />
        </div>
      </div>
    </Modal>
  );
}
