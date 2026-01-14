import { FormatError, type FormatResult } from "./types";
import {
  ensureFinalNewline,
  normalizeNewlines,
  stripBOM,
  trimTrailingWhitespacePerLine
} from "./utils";

function looksLikeJson(trimmed: string): boolean {
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function looksLikeXml(trimmed: string): boolean {
  return trimmed.startsWith("<");
}

function detectPythonish(trimmed: string): boolean {
  // Very lightweight heuristic (MVP: whitespace cleanup only).
  return (
    /(^|\n)\s*(def|class)\s+[A-Za-z_]\w*\s*\(?.*\)\s*:\s*(#.*)?$/m.test(
      trimmed
    ) ||
    /(^|\n)\s*(import|from)\s+[A-Za-z_][\w.]*\s*(import\s+[\w*, ]+)?\s*(#.*)?$/m.test(
      trimmed
    )
  );
}

function detectJavaScriptish(trimmed: string): boolean {
  return (
    /(^|\n)\s*(import|export)\s/m.test(trimmed) ||
    /\b(const|let|var|function|return|class|interface|type)\b/.test(trimmed) ||
    /=>/.test(trimmed) ||
    /[;{}]\s*$/.test(trimmed)
  );
}

function formatJson(raw: string): FormatResult {
  try {
    const parsed = JSON.parse(raw);
    const output = ensureFinalNewline(JSON.stringify(parsed, null, 2));
    return { type: "json", label: "JSON", output };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new FormatError(`Invalid JSON: ${message}`, "invalid_json");
  }
}

function formatXml(raw: string): FormatResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "application/xml");

  const parserErrors = doc.getElementsByTagName("parsererror");
  if (parserErrors.length > 0) {
    const text = parserErrors.item(0)?.textContent?.trim() ?? "Parse error";
    throw new FormatError(`Invalid XML: ${text}`, "invalid_xml");
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  const output = ensureFinalNewline(prettyPrintXml(serialized));
  return { type: "xml", label: "XML", output };
}

function prettyPrintXml(xml: string): string {
  // Minimal, dependency-free XML pretty printer.
  const tokens = xml
    .replace(/>\s+</g, "><")
    .split(/(<[^>]+>)/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  let indent = 0;
  const out: string[] = [];

  for (const token of tokens) {
    const isTag = token.startsWith("<") && token.endsWith(">");
    if (!isTag) {
      // Text node
      out.push(`${"  ".repeat(indent)}${token}`);
      continue;
    }

    const isClosing = /^<\/.+>$/.test(token);
    const isDeclaration = /^<\?xml/.test(token);
    const isComment = /^<!--/.test(token);
    const isCdata = /^<!\[CDATA\[/.test(token);
    const isDoctype = /^<!DOCTYPE/i.test(token);
    const isSelfClosing = /\/>$/.test(token);

    if (isClosing) indent = Math.max(0, indent - 1);

    out.push(`${"  ".repeat(indent)}${token}`);

    if (
      !isClosing &&
      !isSelfClosing &&
      !isDeclaration &&
      !isComment &&
      !isCdata &&
      !isDoctype
    ) {
      indent += 1;
    }
  }

  return out.join("\n");
}

function formatPythonBasic(raw: string): FormatResult {
  const normalized = normalizeNewlines(raw).replace(/\t/g, "    ");
  const output = ensureFinalNewline(trimTrailingWhitespacePerLine(normalized));
  return { type: "python", label: "Python (basic)", output };
}

async function formatJavaScriptWithPrettier(raw: string): Promise<FormatResult> {
  const input = normalizeNewlines(raw);

  // Avoid locking up the UI on huge inputs.
  if (input.length > 400_000) {
    const basic = ensureFinalNewline(trimTrailingWhitespacePerLine(input));
    return {
      type: "javascript",
      label: "JavaScript/TypeScript (basic)",
      output: basic
    };
  }

  const [{ format }, babelPlugin, tsPlugin] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/typescript")
  ]);

  const plugins = [babelPlugin, tsPlugin];
  const options = {
    tabWidth: 2,
    semi: true,
    singleQuote: false,
    trailingComma: "es5" as const,
    printWidth: 80,
    plugins
  };

  try {
    const output = ensureFinalNewline(
      await format(input, { ...options, parser: "typescript" })
    );
    return { type: "javascript", label: "JavaScript/TypeScript", output };
  } catch {
    const output = ensureFinalNewline(
      await format(input, { ...options, parser: "babel" })
    );
    return { type: "javascript", label: "JavaScript", output };
  }
}

export async function formatContent(inputRaw: string): Promise<FormatResult> {
  const raw = stripBOM(normalizeNewlines(inputRaw));
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { type: "plaintext", label: "Plain text", output: "" };
  }

  // If it *looks* like a specific structured format, prefer a helpful error
  // over silently falling back to plain text.
  if (looksLikeJson(trimmed)) return formatJson(raw);
  if (looksLikeXml(trimmed)) return formatXml(trimmed);

  // Otherwise, try JSON (non-leading-brace cases like a JSON string).
  try {
    return formatJson(raw);
  } catch {
    // ignore
  }

  if (detectPythonish(trimmed)) return formatPythonBasic(raw);

  if (detectJavaScriptish(trimmed)) {
    try {
      return await formatJavaScriptWithPrettier(raw);
    } catch {
      // If Prettier can't parse it, treat as plain text.
    }
  }

  // Plain text fallback: normalize line endings + preserve content.
  return { type: "plaintext", label: "Plain text", output: raw };
}


