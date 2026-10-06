interface Option {
  id: string;
  name: string;
}

interface Props {
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Multi-select as toggleable chips. Nothing selected = all. */
export function TagChips({ options, selected, onChange }: Props) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange([])}
        className={`chip ${selected.length === 0 ? "border-accent-500 bg-accent-500/20 text-accent-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
      >
        All
      </button>
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            className={`chip ${on ? "border-accent-500 bg-accent-500/20 text-accent-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
