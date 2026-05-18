import { NextRequest, NextResponse } from "next/server";
import { getCustomer, updateCustomer } from "@/lib/services/customers";
import { customerSchema } from "@/lib/schemas";
import { apiError, sheetsGuard } from "@/lib/apiError";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const guard = sheetsGuard();
  if (guard) return guard;

  try {
    const { id } = await params;
    const customer = await getCustomer(id);
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(customer);
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
    const parsed = customerSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const customer = await updateCustomer(id, parsed.data);
    return NextResponse.json(customer);
  } catch (error) {
    return apiError(error);
  }
}
