import { NextResponse } from "next/server";
import { isRtdConfigured, RtdApiError } from "./rtdApiClient";

export function sheetsGuard() {
  if (!isRtdConfigured()) {
    return NextResponse.json(
      {
        error:
          "Data service not configured. Set RTD_APPS_SCRIPT_URL and RTD_API_SECRET in .env.local.",
      },
      { status: 503 }
    );
  }
  return null;
}

export function apiError(error: unknown, status = 500) {
  if (error instanceof RtdApiError) {
    console.error("[API Error]", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  console.error("[API Error]", message);
  return NextResponse.json({ error: message }, { status });
}
