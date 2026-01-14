export type ContentType =
  | "json"
  | "xml"
  | "python"
  | "javascript"
  | "plaintext"
  | "unknown";

export type FormatResult = {
  type: ContentType;
  label: string;
  output: string;
};

export class FormatError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "FormatError";
    this.code = code;
  }
}


