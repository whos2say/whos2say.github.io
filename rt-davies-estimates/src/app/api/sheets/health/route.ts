import { NextResponse } from "next/server";
import { callRtdApi, isRtdConfigured } from "@/lib/rtdApiClient";
import { SHEET_NAMES } from "@/lib/constants";

const REQUIRED_TABS = Object.values(SHEET_NAMES);

export async function GET() {
  const envUrl = Boolean(process.env.RTD_APPS_SCRIPT_URL?.trim());
  const envSecret = Boolean(process.env.RTD_API_SECRET?.trim());

  const result = {
    ok: false,
    env: {
      apps_script_url_configured: envUrl,
      api_secret_configured: envSecret,
    },
    apps_script: {
      reachable: false,
      message: "",
    },
    tabs: {
      found: [] as string[],
      missing: [] as string[],
      required: REQUIRED_TABS,
    },
  };

  if (!isRtdConfigured()) {
    return NextResponse.json(
      {
        ...result,
        apps_script: {
          reachable: false,
          message: "Environment variables not set",
        },
      },
      { status: 503 }
    );
  }

  try {
    const health = await callRtdApi<{
      tabs: string[];
      spreadsheet_title?: string;
    }>("health");

    result.apps_script.reachable = true;
    result.apps_script.message = "ok";
    result.tabs.found = health.tabs ?? [];

    const foundSet = new Set(result.tabs.found);
    result.tabs.missing = REQUIRED_TABS.filter((t) => !foundSet.has(t));
    result.ok =
      result.tabs.missing.length === 0 && result.apps_script.reachable;

    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    result.apps_script.message =
      error instanceof Error ? error.message : "Health check failed";
    return NextResponse.json(result, { status: 503 });
  }
}
