import React, { useEffect, useMemo, useRef } from "react";

export type HighlightRange = {
  start: number; // 0-based, inclusive
  end: number; // 0-based, exclusive
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  ariaLabel: string;
  highlightPosition?: number | null; // 0-based index into `value`
  findRanges?: HighlightRange[];
  activeFindIndex?: number;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  showLineNumbers?: boolean;
};

type Segment =
  | { type: "text"; value: string }
  | { type: "find"; value: string; isCurrent: boolean }
  | { type: "error"; value: string };

function clampRanges(textLen: number, ranges: HighlightRange[] | undefined): HighlightRange[] {
  if (!ranges || ranges.length === 0) return [];
  const out: HighlightRange[] = [];
  for (const r of ranges) {
    const start = Math.max(0, Math.min(textLen, r.start));
    const end = Math.max(0, Math.min(textLen, r.end));
    if (end <= start) continue;
    out.push({ start, end });
  }
  out.sort((a, b) => (a.start - b.start) || (a.end - b.end));
  return out;
}

function renderWithHighlights(
  text: string,
  highlightPosition: number | null | undefined,
  findRanges: HighlightRange[] | undefined,
  activeFindIndex: number | undefined
): React.ReactNode {
  const ranges = clampRanges(text.length, findRanges);
  const errorPos =
    typeof highlightPosition === "number" && Number.isFinite(highlightPosition)
      ? highlightPosition
      : null;

  const segs: Segment[] = [];
  let cursor = 0;
  let errorRendered = false;

  function pushText(s: string): void {
    if (!s) return;
    segs.push({ type: "text", value: s });
  }

  function pushErrorChar(ch: string): void {
    // Ensure spaces still occupy width inside the highlighted span.
    const v = ch === " " ? "\u00A0" : ch;
    segs.push({ type: "error", value: v });
  }

  for (let idx = 0; idx < ranges.length; idx += 1) {
    let { start, end } = ranges[idx];
    if (end <= cursor) continue;
    if (start < cursor) start = cursor;

    // Text before match (with optional error highlight inside it).
    if (cursor < start) {
      if (typeof errorPos === "number" && !errorRendered && errorPos >= cursor && errorPos < start) {
        pushText(text.slice(cursor, errorPos));
        pushErrorChar(text[errorPos] ?? "");
        errorRendered = true;
        cursor = errorPos + 1;
        if (cursor < start) pushText(text.slice(cursor, start));
      } else {
        pushText(text.slice(cursor, start));
      }
      cursor = start;
    }

    // Match itself (split around error highlight if it falls inside).
    if (typeof errorPos === "number" && !errorRendered && errorPos >= start && errorPos < end) {
      const before = text.slice(start, errorPos);
      const ch = text[errorPos] ?? "";
      const after = text.slice(errorPos + 1, end);
      if (before) segs.push({ type: "find", value: before, isCurrent: idx === activeFindIndex });
      pushErrorChar(ch);
      errorRendered = true;
      if (after) segs.push({ type: "find", value: after, isCurrent: idx === activeFindIndex });
      cursor = end;
      continue;
    }

    segs.push({
      type: "find",
      value: text.slice(start, end),
      isCurrent: idx === activeFindIndex
    });
    cursor = end;
  }

  // Tail (with optional error highlight inside it).
  if (cursor < text.length) {
    if (typeof errorPos === "number" && !errorRendered && errorPos >= cursor && errorPos < text.length) {
      pushText(text.slice(cursor, errorPos));
      pushErrorChar(text[errorPos] ?? "");
      errorRendered = true;
      cursor = errorPos + 1;
      pushText(text.slice(cursor));
    } else {
      pushText(text.slice(cursor));
    }
  }

  // If there were no ranges and no earlier segments, handle error-only highlight.
  if (segs.length === 0 && typeof errorPos === "number" && errorPos >= 0 && errorPos < text.length) {
    return (
      <>
        {text.slice(0, errorPos)}
        <span className="ht-highlight">{text[errorPos] === " " ? "\u00A0" : text[errorPos]}</span>
        {text.slice(errorPos + 1)}
      </>
    );
  }

  // If nothing to render specially, return the raw text.
  if (segs.length === 0) return text;

  return (
    <>
      {segs.map((s, i) => {
        if (s.type === "text") return <React.Fragment key={i}>{s.value}</React.Fragment>;
        if (s.type === "error") return <span key={i} className="ht-highlight">{s.value}</span>;
        return (
          <span key={i} className={`ht-find${s.isCurrent ? " is-current" : ""}`}>
            {s.value}
          </span>
        );
      })}
    </>
  );
}

export function HighlightedTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  ariaLabel,
  highlightPosition,
  findRanges,
  activeFindIndex,
  className,
  textareaRef,
  showLineNumbers
}: Props) {
  const localTextareaRef = useRef<HTMLTextAreaElement>(null!);
  const ref = textareaRef ?? localTextareaRef;
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const mirrored = useMemo(
    () => renderWithHighlights(value, highlightPosition, findRanges, activeFindIndex),
    [value, highlightPosition, findRanges, activeFindIndex]
  );

  const lineNumbersText = useMemo(() => {
    const lines = value.split("\n").length || 1;
    const nums = Array.from({ length: lines }, (_, i) => String(i + 1)).join("\n");
    return `${nums}\n`;
  }, [value]);

  function syncScroll(): void {
    const ta = ref.current;
    const bd = backdropRef.current;
    if (!ta || !bd) return;
    bd.scrollTop = ta.scrollTop;
    bd.scrollLeft = ta.scrollLeft;
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }

  useEffect(() => {
    syncScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, highlightPosition]);

  return (
    <div className={`ht-shell${showLineNumbers ? " has-gutter" : ""}`.trim()}>
      {showLineNumbers ? (
        <div className="ht-gutter" ref={gutterRef} aria-hidden="true">
          <pre className="ht-gutter-pre">{lineNumbersText}</pre>
        </div>
      ) : null}
      <div className="ht-container">
        <div className="ht-backdrop" ref={backdropRef} aria-hidden="true">
          <pre className={`ht-mirror ${className ?? ""}`.trim()}>
            {mirrored}
            {"\n"}
          </pre>
        </div>
        <textarea
          ref={ref}
          className={className}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={ariaLabel}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}


