import { NextRequest, NextResponse } from "next/server";
import { listJobs, updateJob } from "@/lib/services/jobs";
import { apiError, sheetsGuard } from "@/lib/apiError";

export async function GET() {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const jobs = await listJobs();
    return NextResponse.json(jobs);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const { job_id, ...data } = body;
    if (!job_id) {
      return NextResponse.json({ error: "job_id required" }, { status: 400 });
    }
    const job = await updateJob(job_id, data);
    return NextResponse.json(job);
  } catch (error) {
    return apiError(error);
  }
}
