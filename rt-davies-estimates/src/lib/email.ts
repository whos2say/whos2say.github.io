import type { Estimate, LineItem } from "@/types";
import { formatCurrency } from "./calculations";

export interface EstimateEmailParams {
  estimate: Estimate;
  lineItems: LineItem[];
  customerFirstName: string;
  representativeName: string;
  businessName: string;
  printUrl: string;
}

export function buildScopeSummary(lineItems: LineItem[]): string {
  return lineItems
    .slice(0, 5)
    .map((li) => {
      const desc = li.service_description || li.service_category;
      return `• ${li.service_category}: ${desc}`;
    })
    .join("\n");
}

export function buildEstimateEmail(params: EstimateEmailParams): {
  subject: string;
  body: string;
} {
  const {
    estimate,
    lineItems,
    customerFirstName,
    representativeName,
    businessName,
    printUrl,
  } = params;

  const scope = buildScopeSummary(lineItems);
  const total = formatCurrency(parseFloat(estimate.total) || 0);
  const propertyAddress = [
    estimate.property_address,
    estimate.property_city,
    estimate.property_state,
    estimate.property_zip,
  ]
    .filter(Boolean)
    .join(", ");

  const subject = `Estimate from ${businessName}`;

  const body = `Hi ${customerFirstName},

Thank you for giving us the opportunity to look at the work at ${propertyAddress}.

Below is your estimate for:

${scope}

Estimated total: ${total}

View your estimate: ${printUrl}

Please reply to this email with any questions or approval.

Thank you,

${representativeName}
${businessName}`;

  return { subject, body };
}

/** mailto: link for MVP when Resend is not configured */
export function buildMailtoLink(
  to: string,
  subject: string,
  body: string
): string {
  const params = new URLSearchParams({
    subject,
    body,
  });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

/** Send via Resend if RESEND_API_KEY is set */
export async function sendEstimateEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ sent: boolean; method: "resend" | "mailto"; mailto?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (apiKey && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend failed: ${err}`);
    }
    return { sent: true, method: "resend" };
  }

  return {
    sent: false,
    method: "mailto",
    mailto: buildMailtoLink(to, subject, body),
  };
}
