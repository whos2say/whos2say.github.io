import { NextRequest, NextResponse } from "next/server";
import {
  getEstimate,
  getLineItems,
  updateEstimateWithLineItems,
} from "@/lib/services/estimates";
import { estimateFormSchema } from "@/lib/schemas";
import { apiError, sheetsGuard } from "@/lib/apiError";
import type { EstimateStatus } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const { id } = await params;
    const estimate = await getEstimate(id);
    if (!estimate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const lineItems = await getLineItems(id);
    return NextResponse.json({ estimate, lineItems });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const { id } = await params;
    const body = await request.json();

    if (body.action && !body.line_items) {
      const { updateEstimateStatus } = await import("@/lib/services/estimates");
      const status = body.action as EstimateStatus;
      const estimate = await updateEstimateStatus(id, status);
      return NextResponse.json({ estimate });
    }

    const parsed = estimateFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const status = body.status as EstimateStatus | undefined;
    const result = await updateEstimateWithLineItems(
      id,
      parsed.data,
      status
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
