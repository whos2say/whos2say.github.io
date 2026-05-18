import { NextRequest, NextResponse } from "next/server";
import { getEstimate, updateEstimateStatus } from "@/lib/services/estimates";
import { createJobFromEstimate } from "@/lib/services/jobs";
import { apiError, sheetsGuard } from "@/lib/apiError";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const { id } = await params;
    const body = await request.json();
    const scheduledDate =
      body.scheduled_date ?? new Date().toISOString().split("T")[0];
    const crewAssigned = body.crew_assigned ?? "";

    const estimate = await getEstimate(id);
    if (!estimate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const job = await createJobFromEstimate(
      estimate,
      scheduledDate,
      crewAssigned
    );
    await updateEstimateStatus(id, "scheduled");

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
