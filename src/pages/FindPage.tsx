import { ask } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ListItemDetail } from "../components/ListItemDetail";
import { ListItemForm } from "../components/ListItemForm";
import { MediaCard } from "../components/MediaCard";
import { PromptModal } from "../components/PromptModal";
import { ReviewForm } from "../components/ReviewForm";
import { useToast } from "../components/Toast";
import { errorMessage, shuffle } from "../lib/util";
import { coverOf, imageSrc, selectionFromImages } from "../services/images";
import * as listItems from "../services/listItems";
import * as lists from "../services/lists";
import { listTags } from "../services/tags";
import type { ListItem, MediaList, Tag } from "../types";

export function FindPage() {
  const toast = useToast();
  const [allLists, setAllLists] = useState<MediaList[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reloadLists = useCallback(async () => {
    try {
      setAllLists(await lists.listLists());
    } catch (e) {
      toast(`Could not load lists: ${errorMessage(e)}`, "error");
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    void reloadLists();
  }, [reloadLists]);

  const openList = allLists.find((l) => l.id === openId);
  if (openList) {
    return (
      <ListView
        key={openList.id}
        list={openList}
        lists={allLists}
        onBack={() => {
          setOpenId(null);
          void reloadLists();
        }}
        onListsChanged={reloadLists}
      />
    );
  }
  return <ListsOverview lists={allLists} loaded={loaded} onOpen={setOpenId} onChanged={reloadLists} />;
}

// ---------------------------------------------------------------- list picker

function ListsOverview({
  lists: all,
  loaded,
  onOpen,
  onChanged,
}: {
  lists: MediaList[];
  loaded: boolean;
  onOpen: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [covers, setCovers] = useState<Record<string, string[]>>({});

  // A small collage of covers per list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result: Record<string, string[]> = {};
      for (const l of all) {
        const items = await listItems.itemsOfList(l.id).catch(() => []);
        result[l.id] = shuffle(items)
          .slice(0, 3)
          .map((i) => coverOf(i.images)?.thumbnailPath)
          .filter((p): p is string => !!p);
      }
      if (!cancelled) setCovers(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [all]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const list = await lists.createList(name);
      setName("");
      await onChanged();
      onOpen(list.id);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Find something to watch, read or play</h1>
          <p className="text-sm text-zinc-400">Pick a list. Items come up in a new random order every time.</p>
        </div>
        <form onSubmit={create} className="flex gap-2">
          <input className="input w-56" placeholder="New list name, e.g. Watchlist" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" disabled={!name.trim()}>
            Create list
          </button>
        </form>
      </div>

      {loaded && all.length === 0 ? (
        <div className="py-24 text-center text-zinc-500">
          <p className="text-lg text-zinc-300">No lists yet</p>
          <p className="text-sm">Create one above, e.g. "Anime watchlist" or "Books to read".</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {all.map((l) => (
            <button
              key={l.id}
              onClick={() => onOpen(l.id)}
              className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left transition hover:-translate-y-0.5 hover:border-zinc-600"
            >
              <div className="flex h-36 gap-0.5 overflow-hidden bg-zinc-800">
                {(covers[l.id] ?? []).length > 0 ? (
                  covers[l.id].map((p) => <img key={p} src={imageSrc(p)} alt="" className="h-full min-w-0 flex-1 object-cover" />)
                ) : (
                  <div className="flex flex-1 items-center justify-center text-3xl text-zinc-600">☰</div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium">{l.name}</h3>
                <p className="text-xs text-zinc-500">
                  {l.itemCount} item{l.itemCount === 1 ? "" : "s"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- a single list

type Panel =
  | { kind: "new" }
  | { kind: "view"; id: string }
  | { kind: "edit"; id: string }
  | { kind: "done"; id: string }
  | null;

function ListView({
  list,
  lists: allLists,
  onBack,
  onListsChanged,
}: {
  list: MediaList;
  lists: MediaList[];
  onBack: () => void;
  onListsChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [items, setItems] = useState<ListItem[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [loaded, setLoaded] = useState(false);

  /** Reloads items; keeps the current random order, new items go in at a random position. */
  const reload = useCallback(
    async (reshuffle = false) => {
      try {
        const [fresh, t] = await Promise.all([listItems.itemsOfList(list.id), listTags()]);
        setItems(fresh);
        setTags(t);
        setOrder((prev) => {
          if (reshuffle) return shuffle(fresh.map((i) => i.id));
          const ids = new Set(fresh.map((i) => i.id));
          const next = prev.filter((id) => ids.has(id));
          for (const id of ids) {
            if (!next.includes(id)) next.splice(Math.floor(Math.random() * (next.length + 1)), 0, id);
          }
          return next;
        });
      } catch (e) {
        toast(`Could not load the list: ${errorMessage(e)}`, "error");
      } finally {
        setLoaded(true);
      }
    },
    [list.id, toast],
  );

  useEffect(() => {
    void reload(true);
  }, [reload]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return order
      .map((id) => byId.get(id))
      .filter((i): i is ListItem => !!i)
      .filter((i) => !q || i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }, [order, byId, search]);

  const current = panel && panel.kind !== "new" ? byId.get(panel.id) : undefined;

  const removeItem = async (item: ListItem) => {
    const ok = await ask(`Delete "${item.title}" from ${list.name}?\n\nIts image folder will be permanently deleted.`, {
      title: "Delete item",
      kind: "warning",
      okLabel: "Delete",
    });
    if (!ok) return;
    try {
      await listItems.deleteListItem(item.id);
      setPanel(null);
      toast("Item deleted.");
      await reload();
    } catch (e) {
      toast(`Could not delete: ${errorMessage(e)}`, "error");
    }
  };

  const [renaming, setRenaming] = useState(false);

  const guessTag = (): string | undefined => {
    const name = list.name.toLowerCase();
    return tags.find((t) => name.includes(t.name.toLowerCase()))?.id;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost -ml-2 px-2" onClick={onBack}>
          ← Lists
        </button>
        <h1 className="mr-2 text-xl font-semibold">{list.name}</h1>
        <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => setRenaming(true)}>
          Rename
        </button>
        <div className="flex-1" />
        <input className="input w-60" type="search" placeholder="Search this list…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn btn-secondary" onClick={() => reload(true)} title="Random order again">
          ⤮ Shuffle again
        </button>
        <button className="btn btn-primary" onClick={() => setPanel({ kind: "new" })}>
          + Add item
        </button>
      </div>

      {loaded && visible.length === 0 ? (
        <div className="py-24 text-center text-zinc-500">
          {search ? (
            <p>Nothing matches “{search}”.</p>
          ) : (
            <>
              <p className="text-lg text-zinc-300">This list is empty</p>
              <p className="text-sm">Add something you want to watch, read or play.</p>
            </>
          )}
        </div>
      ) : (
        <div className="card-grid">
          {visible.map((i) => (
            <MediaCard key={i.id} title={i.title} images={i.images} onClick={() => setPanel({ kind: "view", id: i.id })} />
          ))}
        </div>
      )}

      {renaming && (
        <PromptModal
          title="Rename list"
          label="List name"
          initial={list.name}
          onClose={() => setRenaming(false)}
          onSubmit={async (name) => {
            await lists.renameList(list.id, name);
            await onListsChanged();
            toast("List renamed.");
          }}
        />
      )}

      {panel?.kind === "view" && current && (
        <ListItemDetail
          item={current}
          listName={list.name}
          onClose={() => setPanel(null)}
          onEdit={() => setPanel({ kind: "edit", id: current.id })}
          onDelete={() => removeItem(current)}
          onMarkDone={() => setPanel({ kind: "done", id: current.id })}
        />
      )}

      {panel?.kind === "new" && (
        <ListItemForm
          heading={`Add to ${list.name}`}
          lists={allLists}
          listId={list.id}
          onClose={() => setPanel(null)}
          onSubmit={async (input) => {
            await listItems.createListItem(input);
            toast("Added.");
            setPanel(null);
            await reload();
            await onListsChanged();
          }}
        />
      )}

      {panel?.kind === "edit" && current && (
        <ListItemForm
          heading={`Edit “${current.title}”`}
          lists={allLists}
          listId={list.id}
          item={current}
          onClose={() => setPanel({ kind: "view", id: current.id })}
          onSubmit={async (input) => {
            await listItems.updateListItem(current.id, input);
            toast(input.listId === list.id ? "Saved." : "Saved and moved to another list.");
            await reload();
            await onListsChanged();
            setPanel(input.listId === list.id ? { kind: "view", id: current.id } : null);
          }}
        />
      )}

      {panel?.kind === "done" && current && (
        <ReviewForm
          heading={`Review “${current.title}”`}
          tags={tags}
          prefill={{ title: current.title, images: selectionFromImages(current.images), tagId: guessTag() }}
          submitLabel="Save review & remove from list"
          onClose={() => setPanel({ kind: "view", id: current.id })}
          onSubmit={async (input) => {
            await listItems.markAsDone(current.id, input);
            toast(`“${input.title.trim()}” moved to your reviews.`);
            setPanel(null);
            await reload();
            await onListsChanged();
          }}
        />
      )}
    </div>
  );
}
