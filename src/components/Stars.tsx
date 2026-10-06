import { useState } from "react";

const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z";

/** fill: 0 (empty), 0.5 (half) or 1 (full). */
function Star({ fill, size }: { fill: number; size: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0 text-zinc-700">
        <path d={STAR_PATH} fill="currentColor" />
      </svg>
      {fill > 0 && (
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
          <svg viewBox="0 0 24 24" width={size} height={size} className="text-amber-400">
            <path d={STAR_PATH} fill="currentColor" />
          </svg>
        </span>
      )}
    </span>
  );
}

const starFill = (grade: number, i: number) => (grade >= 2 * i + 2 ? 1 : grade === 2 * i + 1 ? 0.5 : 0);

/** Read-only star display: grade 0–10 -> 0–5 stars in half steps. */
export function StarRating({ grade, size = 16, showValue }: { grade: number; size?: number; showValue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${grade / 2} / 5 (${grade}/10)`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={starFill(grade, i)} size={size} />
      ))}
      {showValue && <span className="ml-1.5 text-sm tabular-nums text-zinc-400">{grade / 2}</span>}
    </span>
  );
}

/** Clickable stars. Left half of a star = half value. Emits the 0–10 integer grade. */
export function StarInput({ value, onChange, size = 32 }: { value: number; onChange: (grade: number) => void; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  const gradeAt = (i: number, e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? 2 * i + 1 : 2 * i + 2;
  };

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex" onMouseLeave={() => setHover(null)} role="slider" aria-valuemin={0} aria-valuemax={10} aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(10, value + 1));
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, value - 1));
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="cursor-pointer px-0.5"
            onMouseMove={(e) => setHover(gradeAt(i, e))}
            onClick={(e) => onChange(gradeAt(i, e))}
          >
            <Star fill={starFill(shown, i)} size={size} />
          </span>
        ))}
      </div>
      <span className="w-24 text-sm tabular-nums text-zinc-400">
        {shown / 2} / 5 <span className="text-zinc-600">({shown}/10)</span>
      </span>
      {value > 0 && (
        <button type="button" className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => onChange(0)}>
          Clear
        </button>
      )}
    </div>
  );
}
