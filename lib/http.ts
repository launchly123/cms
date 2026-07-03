import { NextResponse } from "next/server";

export function apiError(status: number, error: string, details?: unknown) {
  return NextResponse.json(
    details !== undefined ? { error, details } : { error },
    { status }
  );
}

/**
 * Uniform error handling for API routes. Maps known errors to friendly
 * status codes and hides internals on unexpected failures.
 */
export function handleApiError(e: unknown) {
  if (e instanceof Error) {
    if (e.message === "supabase_not_configured") {
      return apiError(503, "supabase_not_configured");
    }
    if (e.message === "vercel_not_configured") {
      return apiError(400, "vercel_not_configured");
    }
  }
  console.error("[api]", e);
  return apiError(500, "internal_error");
}

/** Postgres unique-violation code from Supabase errors. */
export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}
