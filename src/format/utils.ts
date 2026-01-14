export function normalizeNewlines(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function trimTrailingWhitespacePerLine(input: string): string {
  return input
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

export function ensureFinalNewline(input: string): string {
  if (input.length === 0) return input;
  return input.endsWith("\n") ? input : `${input}\n`;
}

export function stripBOM(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}


