import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatContent } from "./format/formatContent";
import { FormatError, type FormatResult } from "./format/types";
import { normalizeNewlines, stripBOM } from "./format/utils";
import { HighlightedTextarea } from "./components/HighlightedTextarea";
import { computeFindMatches, type FindMatch } from "./find/findMatches";

type Theme = "light" | "dark";

type ErrorLocation = {
  position: number;
  line: number;
  column: number;
};

function detectIsMacOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaDataPlatform = (navigator as unknown as { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  const platform = typeof uaDataPlatform === "string" ? uaDataPlatform : navigator.platform;
  return /mac/i.test(platform) || /iphone|ipad|ipod/i.test(platform);
}

function getDefaultTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    ? "dark"
    : "light";
}

function extractJsonParsePosition(message: string): number | null {
  const m = message.match(/position\s+(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
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

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fallback (older browsers / permissions)
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "true");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

export function App() {
  const baseUrl = import.meta.env.BASE_URL;
  const [theme, setTheme] = useState<Theme>(() => getDefaultTheme());
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [input, setInput] = useState<string>("");
  const [result, setResult] = useState<FormatResult>({
    type: "plaintext",
    label: "Plain text",
    output: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [errorLocation, setErrorLocation] = useState<ErrorLocation | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null!);
  const findInputRef = useRef<HTMLInputElement>(null!);

  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatchCase, setFindMatchCase] = useState(false);
  const [findWholeWord, setFindWholeWord] = useState(false);
  const [findRegex, setFindRegex] = useState(false);
  const [activeFindIndex, setActiveFindIndex] = useState<number>(-1);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const isMacOS = useMemo(() => detectIsMacOS(), []);
  const shortcutHint = useMemo(() => (isMacOS ? "⌘ Enter" : "Ctrl Enter"), [isMacOS]);

  const normalizedInput = useMemo(() => {
    return stripBOM(normalizeNewlines(input));
  }, [input]);

  const findComputed = useMemo(() => {
    return computeFindMatches(input, {
      query: findQuery,
      matchCase: findMatchCase,
      wholeWord: findWholeWord,
      regex: findRegex
    });
  }, [input, findQuery, findMatchCase, findWholeWord, findRegex]);

  const findMatches: FindMatch[] = findComputed.matches;
  const findError = findComputed.error;

  useEffect(() => {
    if (findMatches.length === 0) {
      setActiveFindIndex(-1);
      return;
    }
    setActiveFindIndex((prev) => {
      if (prev >= 0 && prev < findMatches.length) return prev;
      return 0;
    });
  }, [findMatches.length]);

  function openFindAndFocus(): void {
    setFindOpen(true);
    window.setTimeout(() => findInputRef.current?.focus(), 0);
  }

  function closeFind(): void {
    setFindOpen(false);
    setFindQuery("");
    setActiveFindIndex(-1);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function gotoFindIndex(nextIndex: number, opts?: { preserveFocus?: boolean }): void {
    if (findMatches.length === 0) return;
    const i = ((nextIndex % findMatches.length) + findMatches.length) % findMatches.length;
    setActiveFindIndex(i);
    const m = findMatches[i]!;
    const ta = inputRef.current;
    if (!ta) return;
    const preserveFocus = Boolean(opts?.preserveFocus);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Set selection immediately (even if not focused) so state is correct.
    ta.setSelectionRange(m.start, m.end);

    function getLineHeightPx(): number {
      const cs = window.getComputedStyle(ta);
      const lh = Number.parseFloat(cs.lineHeight);
      if (Number.isFinite(lh) && lh > 0) return lh;
      const fs = Number.parseFloat(cs.fontSize);
      return (Number.isFinite(fs) && fs > 0 ? fs : 13) * 1.5;
    }

    function scrollTextareaToIndex(index: number): void {
      // Best-effort scroll for hard line breaks. Soft wraps are handled by focus+selection.
      const lineHeight = getLineHeightPx();
      const before = ta.value.slice(0, Math.max(0, Math.min(index, ta.value.length)));
      const line = Math.max(0, before.split("\n").length - 1);
      const targetTop = line * lineHeight;
      ta.scrollTop = Math.max(0, targetTop - ta.clientHeight / 2);
    }

    // Delay focusing/scrolling until after the key event completes, otherwise "Enter"
    // can be delivered to the textarea and insert a newline over the selection.
    window.setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(m.start, m.end);
      window.requestAnimationFrame(() => ta.setSelectionRange(m.start, m.end));
      scrollTextareaToIndex(m.start);

      if (preserveFocus) {
        // Restore focus *after* scroll has happened so the viewport still follows the match.
        window.requestAnimationFrame(() => {
          window.setTimeout(() => {
            if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
            else findInputRef.current?.focus();
          }, 0);
        });
      }
    }, 0);
  }

  function gotoNextMatch(opts?: { preserveFocus?: boolean }): void {
    if (findMatches.length === 0) return;
    gotoFindIndex((activeFindIndex < 0 ? 0 : activeFindIndex + 1), opts);
  }

  function gotoPrevMatch(opts?: { preserveFocus?: boolean }): void {
    if (findMatches.length === 0) return;
    gotoFindIndex((activeFindIndex < 0 ? 0 : activeFindIndex - 1), opts);
  }

  useEffect(() => {
    function onGlobalKeyDown(e: KeyboardEvent): void {
      const key = e.key.toLowerCase();
      const isFindShortcut = (e.ctrlKey || e.metaKey) && !e.altKey && key === "f";
      if (isFindShortcut) {
        e.preventDefault();
        openFindAndFocus();
        return;
      }

      if (findOpen && e.key === "Escape") {
        e.preventDefault();
        closeFind();
      }
    }

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [findOpen]);

  async function onFormat(): Promise<void> {
    setError(null);
    setErrorLocation(null);
    setIsFormatting(true);
    try {
      const r = await formatContent(input);
      setResult(r);
      setInput(normalizeNewlines(r.output));
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      if (e instanceof FormatError && e.code === "invalid_json") {
        const position = extractJsonParsePosition(message);
        if (typeof position === "number") {
          const { line, column } = offsetToLineColumn(normalizedInput, position);
          setErrorLocation({ position, line, column });
        }
      }
      setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setIsFormatting(false);
    }
  }

  function onClear(): void {
    setInput("");
    setResult({ type: "plaintext", label: "Plain text", output: "" });
    setError(null);
    setErrorLocation(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function onCopy(): Promise<void> {
    if (!input) return;
    await copyToClipboard(input);
    setJustCopied(true);
    window.setTimeout(() => setJustCopied(false), 900);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key !== "Enter" || e.shiftKey || e.altKey) return;

    // Strict OS behavior:
    // - macOS: Cmd+Enter
    // - Windows/Linux: Ctrl+Enter
    const isShortcut = isMacOS
      ? e.metaKey && !e.ctrlKey
      : e.ctrlKey && !e.metaKey;
    if (!isShortcut) return;
    e.preventDefault();
    void onFormat();
  }

  function onFindKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) gotoPrevMatch({ preserveFocus: true });
      else gotoNextMatch({ preserveFocus: true });
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeFind();
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <div className="brand">
            <img className="brand-icon" src={`${baseUrl}icon.svg`} alt="" aria-hidden="true" />
            <h1 className="brand-text">JSON Formatter</h1>
          </div>
          <div className="hint">
            {result.label}
            {showShortcuts ? (
              <>
                {" · "}
                {shortcutHint}
              </>
            ) : null}
          </div>
          {error ? (
            <div className="error" title={error}>
              {error}
            </div>
          ) : null}
        </div>

        <div className="toolbar-right">
          <button
            type="button"
            className="btn toggle"
            aria-pressed={findOpen}
            onClick={() => (findOpen ? closeFind() : openFindAndFocus())}
            title={isMacOS ? "Find (⌘F)" : "Find (Ctrl F)"}
          >
            Find
          </button>
          <button
            type="button"
            className="btn toggle"
            aria-pressed={showShortcuts}
            onClick={() => setShowShortcuts((v) => !v)}
            title="Toggle keyboard shortcuts"
          >
            Shortcuts
          </button>
          <button
            type="button"
            className="btn toggle"
            aria-pressed={showLineNumbers}
            onClick={() => setShowLineNumbers((v) => !v)}
            title="Toggle line numbers"
          >
            Line Numbers
          </button>

          <button
            type="button"
            className="btn primary"
            onClick={() => void onFormat()}
            disabled={isFormatting || input.trim().length === 0}
            aria-label={showShortcuts ? `Format (${shortcutHint})` : "Format"}
            title={showShortcuts ? `Format (${shortcutHint})` : "Format"}
          >
            {isFormatting ? "Formatting…" : "Format"}
          </button>

          <button type="button" className="btn" onClick={onClear}>
            Clear
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => void onCopy()}
            disabled={!input}
          >
            {justCopied ? "Copied" : "Copy"}
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <main className="pane">
        <div className="pane-stack">
          {error && errorLocation ? (
            <div
              className="pane-notice"
              title={`Invalid JSON near line ${errorLocation.line}, column ${errorLocation.column} (position ${errorLocation.position}).`}
            >
              Invalid JSON near line {errorLocation.line}, column{" "}
              {errorLocation.column}.
            </div>
          ) : null}
          {findOpen ? (
            <div className="findbar" role="search" aria-label="Find">
              <div className="findbar-left">
                <div className="find-input-shell">
                  <input
                    ref={findInputRef}
                    className="find-input"
                    value={findQuery}
                    onChange={(e) => setFindQuery(e.target.value)}
                    onKeyDown={onFindKeyDown}
                    placeholder="Find…"
                    aria-label="Find query"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                  <div className="find-input-actions" aria-label="Find options">
                    <button
                      type="button"
                      className="find-icon-btn"
                      aria-pressed={findMatchCase}
                      onClick={() => setFindMatchCase((v) => !v)}
                      title="Match case"
                    >
                      Aa
                    </button>
                    <button
                      type="button"
                      className="find-icon-btn"
                      aria-pressed={findWholeWord}
                      onClick={() => setFindWholeWord((v) => !v)}
                      title="Match whole word"
                    >
                      Word
                    </button>
                    <button
                      type="button"
                      className="find-icon-btn"
                      aria-pressed={findRegex}
                      onClick={() => setFindRegex((v) => !v)}
                      title="Use regular expression"
                    >
                      .*
                    </button>
                  </div>
                </div>
                <div className="findbar-count" aria-label="Match count">
                  {findMatches.length > 0 && activeFindIndex >= 0
                    ? `${activeFindIndex + 1}/${findMatches.length}`
                    : `0/${findMatches.length}`}
                </div>
                {findError ? (
                  <div className="findbar-error" title={findError}>
                    Invalid regex
                  </div>
                ) : null}
              </div>
              <div className="findbar-right">
                <button
                  type="button"
                  className="btn"
                  onClick={() => gotoPrevMatch({ preserveFocus: true })}
                  disabled={findMatches.length === 0}
                  title="Previous match (Shift+Enter)"
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => gotoNextMatch({ preserveFocus: true })}
                  disabled={findMatches.length === 0}
                  title="Next match (Enter)"
                >
                  Next
                </button>
                <button type="button" className="btn" onClick={closeFind} title="Close (Esc)">
                  Close
                </button>
              </div>
            </div>
          ) : null}
          {showShortcuts ? (
            <div className="pane-notice multiline" role="note" aria-label="Keyboard shortcuts">
              <span className="shortcuts-title">Keyboard shortcuts:</span>{" "}
              <span className="shortcuts-item">
                Format{" "}
                <span className="kbd" aria-label="Command Enter">
                  ⌘ Enter
                </span>{" "}
                (macOS) /{" "}
                <span className="kbd" aria-label="Control Enter">
                  Ctrl Enter
                </span>{" "}
                (Windows/Linux)
              </span>
            </div>
          ) : null}
          <HighlightedTextarea
            textareaRef={inputRef}
            className="textarea"
            value={input}
            onChange={(next) => setInput(normalizeNewlines(next))}
            onKeyDown={onKeyDown}
            ariaLabel="Editor"
            placeholder="Paste JSON, XML, Python, JavaScript/TypeScript, or plain text here…"
            highlightPosition={error ? errorLocation?.position ?? null : null}
            findRanges={findOpen && !findError ? findMatches : []}
            activeFindIndex={findOpen && !findError ? activeFindIndex : -1}
            showLineNumbers={showLineNumbers}
          />
        </div>
      </main>
    </div>
  );
}


