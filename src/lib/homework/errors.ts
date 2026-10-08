export class HomeworkError extends Error {
  status: number;
  code: string;
  finishReason: string | null = null;
  extractMs: number | null = null;
  generateMs: number | null = null;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "HomeworkError";
    this.code = code;
    this.status = status;
  }
}
