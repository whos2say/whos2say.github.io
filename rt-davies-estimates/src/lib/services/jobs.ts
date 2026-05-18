import { v4 as uuidv4 } from "uuid";
import { callRtdApi } from "../rtdApiClient";
import type { Job, Estimate } from "@/types";

export async function listJobs(): Promise<Job[]> {
  return callRtdApi<Job[]>("listJobs");
}

export async function getJob(id: string): Promise<Job | null> {
  const result = await callRtdApi<{ job: Job | null }>("getJob", {
    job_id: id,
  });
  return result.job;
}

export async function createJobFromEstimate(
  estimate: Estimate,
  scheduledDate: string,
  crewAssigned = ""
): Promise<Job> {
  const now = new Date().toISOString();
  const propertyAddress = [
    estimate.property_address,
    estimate.property_city,
    estimate.property_state,
    estimate.property_zip,
  ]
    .filter(Boolean)
    .join(", ");

  const job: Job = {
    job_id: uuidv4(),
    estimate_id: estimate.estimate_id,
    customer_name: estimate.customer_name,
    property_address: propertyAddress,
    scheduled_date: scheduledDate,
    crew_assigned: crewAssigned,
    job_status: "scheduled",
    completion_notes: "",
    created_at: now,
    updated_at: now,
  };

  return callRtdApi<Job>("createJob", { job });
}

export async function updateJob(
  jobId: string,
  data: Partial<Job>
): Promise<Job> {
  return callRtdApi<Job>("updateJob", {
    job_id: jobId,
    data,
  });
}
