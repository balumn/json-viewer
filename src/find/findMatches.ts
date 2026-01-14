export type FindOptions = {
  query: string;
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
};

export type FindMatch = {
  start: number; // 0-based, inclusive
  end: number; // 0-based, exclusive
};

function isWordChar(ch: string): boolean {
  // Editor-ish "word" definition; intentionally ASCII-centric.
  return /^[A-Za-z0-9_]$/.test(ch);
}

function isWholeWord(text: string, start: number, end: number): boolean {
  const leftOk = start <= 0 ? true : !isWordChar(text[start - 1] ?? "");
  const rightOk = end >= text.length ? true : !isWordChar(text[end] ?? "");
  return leftOk && rightOk;
}

export function computeFindMatches(
  text: string,
  options: FindOptions
): { matches: FindMatch[]; error: string | null } {
  const query = options.query;
  if (!query) return { matches: [], error: null };

  const matches: FindMatch[] = [];

  // Guardrail: don't let extremely repetitive matches lock the UI.
  const MAX_MATCHES = 5000;

  if (options.regex) {
    try {
      const flags = `g${options.matchCase ? "" : "i"}`;
      const re = new RegExp(query, flags);
      let m: RegExpExecArray | null;

      while ((m = re.exec(text)) !== null) {
        const start = m.index ?? 0;
        const value = m[0] ?? "";
        const end = start + value.length;

        // Avoid infinite loops for zero-length matches.
        if (value.length === 0) {
          if (re.lastIndex < text.length) re.lastIndex += 1;
          else break;
          continue;
        }

        if (options.wholeWord && !isWholeWord(text, start, end)) continue;
        matches.push({ start, end });
        if (matches.length >= MAX_MATCHES) break;
      }

      return { matches, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { matches: [], error: message || "Invalid regular expression" };
    }
  }

  const hay = options.matchCase ? text : text.toLowerCase();
  const needle = options.matchCase ? query : query.toLowerCase();
  if (!needle) return { matches: [], error: null };

  let i = 0;
  while (true) {
    const idx = hay.indexOf(needle, i);
    if (idx === -1) break;
    const start = idx;
    const end = idx + needle.length;

    if (!options.wholeWord || isWholeWord(text, start, end)) {
      matches.push({ start, end });
      if (matches.length >= MAX_MATCHES) break;
    }

    i = idx + Math.max(needle.length, 1);
  }

  return { matches, error: null };
}


