export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function assertDefined<T>(value: T | null | undefined, error: HttpError): T {
  if (value === null || value === undefined) {
    throw error;
  }
  return value;
}
