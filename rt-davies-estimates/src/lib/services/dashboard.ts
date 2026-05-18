import { callRtdApi } from "../rtdApiClient";
import type { Estimate } from "@/types";

export interface DashboardData {
  draft: Estimate[];
  sent: Estimate[];
  approved: Estimate[];
  scheduledJobs: number;
  completedUnpaid: Estimate[];
  totalEstimatedRevenue: number;
  recentEstimates: Estimate[];
}

/** Shape returned by Apps Script action `dashboard`. */
interface DashboardApiPayload {
  draftEstimates: Estimate[];
  sentEstimates: Estimate[];
  approvedEstimates: Estimate[];
  scheduledJobs: number;
  completedUnpaidJobs: Estimate[];
  totalEstimatedRevenue: number;
  recentEstimates: Estimate[];
}

/** Single Apps Script call — avoids double POST / redirect auth issues. */
export async function getDashboardData(): Promise<DashboardData> {
  const raw = await callRtdApi<DashboardApiPayload>("dashboard");

  return {
    draft: raw.draftEstimates ?? [],
    sent: raw.sentEstimates ?? [],
    approved: raw.approvedEstimates ?? [],
    scheduledJobs: raw.scheduledJobs ?? 0,
    completedUnpaid: raw.completedUnpaidJobs ?? [],
    totalEstimatedRevenue: raw.totalEstimatedRevenue ?? 0,
    recentEstimates: raw.recentEstimates ?? [],
  };
}
