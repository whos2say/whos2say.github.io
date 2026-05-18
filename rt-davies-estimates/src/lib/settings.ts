import { callRtdApi } from "./rtdApiClient";
import { DEFAULT_SETTINGS } from "./constants";
import type { SettingsMap } from "@/types";

export async function getSettings(): Promise<SettingsMap> {
  try {
    const rows = await callRtdApi<SettingsMap>("getSettings");
    return { ...DEFAULT_SETTINGS, ...rows };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await callRtdApi("updateSettings", {
    settings: { [key]: value },
  });
}

export async function updateSettings(settings: SettingsMap): Promise<SettingsMap> {
  return callRtdApi<SettingsMap>("updateSettings", { settings });
}

export function getServiceCategories(settings: SettingsMap): string[] {
  const raw =
    settings.service_categories ?? DEFAULT_SETTINGS.service_categories;
  return raw.split("|").map((s) => s.trim()).filter(Boolean);
}
