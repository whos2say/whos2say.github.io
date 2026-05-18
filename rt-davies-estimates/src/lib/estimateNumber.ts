import { callRtdApi } from "./rtdApiClient";

/** Generate next estimate number: RTD-YYYY-#### */
export async function generateEstimateNumber(): Promise<string> {
  const result = await callRtdApi<{ estimate_number: string }>(
    "generateEstimateNumber"
  );
  return result.estimate_number;
}
