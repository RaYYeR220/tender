export class TenderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TenderError";
    this.code = code;
  }
}
