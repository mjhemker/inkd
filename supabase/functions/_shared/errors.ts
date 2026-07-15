// A single JSON error envelope shape shared by every function, so clients get a
// predictable `{ error: { code, message } }` body regardless of which function
// or failure they hit.
import { corsHeaders } from "./cors.ts";

export interface ErrorBody {
  error: { code: string; message: string };
}

/** A domain error with an HTTP status + stable machine-readable code. */
export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const errors = {
  unauthorized: (msg = "Authentication required") =>
    new AppError(401, "unauthorized", msg),
  forbidden: (msg = "Not permitted") => new AppError(403, "forbidden", msg),
  notFound: (msg = "Not found") => new AppError(404, "not_found", msg),
  badRequest: (msg = "Invalid request") =>
    new AppError(400, "bad_request", msg),
  conflict: (msg = "Conflict") => new AppError(409, "conflict", msg),
  server: (msg = "Internal error") => new AppError(500, "server_error", msg),
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

/** Convert any thrown value into a CORS-safe JSON error response. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    return jsonResponse(body, err.status);
  }
  // ConfigError (missing secrets) and everything unexpected → 500, no leak of
  // internal detail beyond the message.
  const message = err instanceof Error ? err.message : "Unexpected error";
  const body: ErrorBody = { error: { code: "server_error", message } };
  return jsonResponse(body, 500);
}
