import { NextRequest, NextResponse } from "next/server";
import { listEstimates, createEstimate } from "@/lib/services/estimates";
import { estimateFormSchema } from "@/lib/schemas";
import { apiError, sheetsGuard } from "@/lib/apiError";

export async function GET() {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const estimates = await listEstimates();
    return NextResponse.json(estimates);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = estimateFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await createEstimate(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
