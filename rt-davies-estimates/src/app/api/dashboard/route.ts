import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/services/dashboard";
import { apiError, sheetsGuard } from "@/lib/apiError";

export async function GET() {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const data = await getDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error);
  }
}
