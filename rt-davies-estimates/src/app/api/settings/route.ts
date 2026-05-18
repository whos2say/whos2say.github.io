import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { settingsSchema } from "@/lib/schemas";
import { apiError, sheetsGuard } from "@/lib/apiError";

export async function GET() {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const settings = await updateSettings({
      business_name: data.business_name,
      business_address: data.business_address,
      business_phone: data.business_phone,
      default_tax_rate: String(data.default_tax_rate),
      default_terms: data.default_terms,
      service_categories: data.service_categories,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return apiError(error);
  }
}
