import { NextRequest, NextResponse } from "next/server";
import {
  listCustomers,
  createCustomer,
  searchCustomers,
} from "@/lib/services/customers";
import { customerSchema } from "@/lib/schemas";
import { apiError, sheetsGuard } from "@/lib/apiError";

export async function GET(request: NextRequest) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    let customers = await listCustomers();
    if (q) customers = searchCustomers(customers, q);
    return NextResponse.json(customers);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const customer = await createCustomer(parsed.data);
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
