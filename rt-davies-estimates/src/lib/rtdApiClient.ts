/**
 * RT Davies data layer — calls the bound Google Apps Script web app.
 * Set RTD_APPS_SCRIPT_URL and RTD_API_SECRET in server env only.
 */

export class RtdApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "RtdApiError";
    this.statusCode = statusCode;
  }
}

export function isRtdConfigured(): boolean {
  return Boolean(
    process.env.RTD_APPS_SCRIPT_URL?.trim() &&
      process.env.RTD_API_SECRET?.trim()
  );
}

interface RtdApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** POST JSON { secret, action, payload } to the Apps Script web app. */
export async function callRtdApi<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const url = process.env.RTD_APPS_SCRIPT_URL?.trim();
  const secret = process.env.RTD_API_SECRET?.trim();

  if (!url || !secret) {
    throw new RtdApiError(
      "RT Davies API not configured. Set RTD_APPS_SCRIPT_URL and RTD_API_SECRET.",
      503
    );
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, action, payload }),
      cache: "no-store",
    });
  } catch {
    throw new RtdApiError("Could not reach the data service", 502);
  }

  let json: RtdApiResponse<T>;
  try {
    json = (await res.json()) as RtdApiResponse<T>;
  } catch {
    throw new RtdApiError("Invalid response from data service", 502);
  }

  if (!json.ok) {
    const errMsg = json.error ?? "Request failed";
    throw new RtdApiError(
      errMsg,
      errMsg === "Unauthorized" ? 401 : res.status >= 400 ? res.status : 500
    );
  }

  return json.data as T;
}
