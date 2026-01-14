import React, { useEffect, useMemo, useRef } from "react";

export type CodeViewerHighlight = {
  line: number; // 1-based
  column?: number; // 1-based
};

type Props = {
  text: string;
  ariaLabel: string;
  placeholder?: string;
  highlight?: CodeViewerHighlight | null;
  className?: string;
};

function splitLinesPreserveTrailingEmpty(text: string): string[] {
  // `split("\n")` preserves a trailing empty line if the text ends with "\n",
  // which matches how editors show a final newline.
  return text.split("\n");
}

export const CodeViewer = React.forwardRef<HTMLDivElement, Props>(function CodeViewer(
  { text, ariaLabel, placeholder, highlight, className }: Props,
  forwardedRef
) {
  const lines = useMemo(() => splitLinesPreserveTrailingEmpty(text), [text]);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!highlightRef.current) return;
    highlightRef.current.scrollIntoView({ block: "center" });
  }, [highlight?.line, highlight?.column, text]);

  const content =
    text.length === 0 && placeholder ? (
      <div className="codeview-empty">{placeholder}</div>
    ) : (
      lines.map((lineText, idx) => {
        const lineNo = idx + 1;
        const isHighlighted = Boolean(highlight && highlight.line === lineNo);
        const col = highlight?.column;

        let rendered: React.ReactNode = lineText;
        if (isHighlighted && typeof col === "number" && col >= 1) {
          const i = col - 1;
          if (i >= 0 && i < lineText.length) {
            rendered = (
              <>
                {lineText.slice(0, i)}
                <span className="codeview-col-highlight">
                  {lineText[i] === " " ? "\u00A0" : lineText[i]}
                </span>
                {lineText.slice(i + 1)}
              </>
            );
          }
        }

        return (
          <div
            key={lineNo}
            ref={isHighlighted ? highlightRef : null}
            className={`codeview-line${isHighlighted ? " is-highlighted" : ""}`}
          >
            <div className="codeview-gutter" aria-hidden="true">
              {lineNo}
            </div>
            <div className="codeview-code">
              <span className="codeview-text">{rendered}</span>
            </div>
          </div>
        );
      })
    );

  return (
    <div
      ref={forwardedRef}
      className={`codeview ${className ?? ""}`.trim()}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
    >
      {content}
    </div>
  );
});


