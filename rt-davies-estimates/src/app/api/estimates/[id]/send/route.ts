import { NextRequest, NextResponse } from "next/server";
import { getEstimate, getLineItems, updateEstimateStatus } from "@/lib/services/estimates";
import { getSettings } from "@/lib/settings";
import {
  buildEstimateEmail,
  sendEstimateEmail,
} from "@/lib/email";
import { apiError, sheetsGuard } from "@/lib/apiError";

type Params = { params: Promise<{ id: string }> };

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

export async function POST(_request: NextRequest, { params }: Params) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const { id } = await params;
    const estimate = await getEstimate(id);
    if (!estimate) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!estimate.email) {
      return NextResponse.json(
        { error: "Customer email is required to send estimate" },
        { status: 400 }
      );
    }

    const lineItems = await getLineItems(id);
    const settings = await getSettings();
    const printUrl = `${appUrl()}/estimates/${id}/print`;
    const firstName = estimate.customer_name.split(" ")[0] ?? "there";

    const { subject, body } = buildEstimateEmail({
      estimate,
      lineItems,
      customerFirstName: firstName,
      representativeName:
        estimate.representative_name || settings.business_name,
      businessName: settings.business_name,
      printUrl,
    });

    const result = await sendEstimateEmail(estimate.email, subject, body);

    if (result.sent) {
      await updateEstimateStatus(id, "sent");
    }

    return NextResponse.json({
      ...result,
      subject,
      body,
    });
  } catch (error) {
    return apiError(error);
  }
}
