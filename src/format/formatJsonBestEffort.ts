import { ensureFinalNewline } from "./utils";

export type BestEffortFormatResult = {
  output: string;
  // Highlight location in the OUTPUT (1-based), if we were given an error position.
  highlight?: { line: number; column: number };
};

function nextNonWhitespaceIndex(text: string, start: number, limit: number): number {
  for (let i = start; i < limit; i += 1) {
    const c = text[i];
    if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") return i;
  }
  return -1;
}

function offsetToLineColumn(text: string, position: number): {
  line: number;
  column: number;
} {
  const p = Math.max(0, Math.min(position, text.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < p; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

/**
 * Best-effort JSON formatter:
 * - Does NOT require valid JSON.
 * - Preserves characters (except whitespace, which is normalized).
 * - Respects strings and escapes.
 * - If errorPosition is provided, inserts a sentinel in the output so we can
 *   compute highlight line/column, then removes it from the final output.
 */
export function formatJsonBestEffort(
  raw: string,
  errorPosition?: number | null
): BestEffortFormatResult {
  const sentinel = "\u0000";

  const limit = raw.length;
  const out: string[] = [];

  let indent = 0;
  let inString = false;
  let escaping = false;
  let pendingSpace = false;
  let insertedSentinel = false;

  const maybeInsertSentinel = (srcIndex: number) => {
    if (insertedSentinel) return;
    if (typeof errorPosition !== "number") return;
    if (!Number.isFinite(errorPosition)) return;
    if (srcIndex !== errorPosition) return;
    out.push(sentinel);
    insertedSentinel = true;
  };

  const pushIndent = () => {
    out.push("  ".repeat(Math.max(0, indent)));
  };

  for (let i = 0; i < limit; i += 1) {
    maybeInsertSentinel(i);

    const ch = raw[i];

    if (inString) {
      out.push(ch);
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    // Outside strings: normalize whitespace.
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      pendingSpace = true;
      continue;
    }

    if (pendingSpace) {
      // Insert at most one space where it makes sense (e.g., between literals),
      // but avoid introducing spaces after newlines/indent.
      const last = out[out.length - 1] ?? "";
      const lastIsNewline = last.endsWith("\n");
      if (!lastIsNewline && last.length > 0) out.push(" ");
      pendingSpace = false;
    }

    if (ch === '"') {
      inString = true;
      out.push(ch);
      continue;
    }

    if (ch === "{" || ch === "[") {
      // Handle {} / [] compactly.
      const close = ch === "{" ? "}" : "]";
      const j = nextNonWhitespaceIndex(raw, i + 1, limit);
      if (j !== -1 && raw[j] === close) {
        out.push(ch, close);
        i = j; // skip to close
        continue;
      }

      out.push(ch, "\n");
      indent += 1;
      pushIndent();
      continue;
    }

    if (ch === "}" || ch === "]") {
      out.push("\n");
      indent = Math.max(0, indent - 1);
      pushIndent();
      out.push(ch);
      continue;
    }

    if (ch === ",") {
      out.push(",", "\n");
      pushIndent();
      continue;
    }

    if (ch === ":") {
      out.push(": ");
      continue;
    }

    out.push(ch);
  }

  // Sentinel at end-of-input (position === raw.length)
  if (!insertedSentinel && typeof errorPosition === "number") {
    if (Number.isFinite(errorPosition) && errorPosition === raw.length) {
      out.push(sentinel);
      insertedSentinel = true;
    }
  }

  const withSentinel = out.join("");
  const sentinelIndex = withSentinel.indexOf(sentinel);
  const highlight =
    sentinelIndex >= 0 ? offsetToLineColumn(withSentinel, sentinelIndex) : undefined;
  const output = ensureFinalNewline(withSentinel.replace(sentinel, ""));

  return highlight ? { output, highlight } : { output };
}


