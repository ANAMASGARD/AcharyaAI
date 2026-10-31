import { ApiAuthError } from "./auth";
import { ZodError } from "zod";
import { RagError } from "./contracts";
export function failure(error: unknown): Response {
  const status =
    error instanceof ApiAuthError || error instanceof RagError
      ? error.status
      : error instanceof ZodError
        ? 400
        : 500;
  const message =
    error instanceof ApiAuthError || error instanceof RagError
      ? error.message
      : error instanceof ZodError
        ? "Invalid request fields."
        : "Processing failed. Please retry.";
  return Response.json({ error: message }, { status });
}
