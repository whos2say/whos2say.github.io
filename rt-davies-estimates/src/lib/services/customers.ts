import { v4 as uuidv4 } from "uuid";
import { callRtdApi } from "../rtdApiClient";
import type { Customer } from "@/types";
import type { CustomerFormData } from "../schemas";

export async function listCustomers(): Promise<Customer[]> {
  return callRtdApi<Customer[]>("listCustomers");
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const result = await callRtdApi<{ customer: Customer | null }>(
    "getCustomer",
    { customer_id: id }
  );
  return result.customer;
}

export async function createCustomer(data: CustomerFormData): Promise<Customer> {
  const now = new Date().toISOString();
  const customer: Customer = {
    customer_id: uuidv4(),
    created_at: now,
    updated_at: now,
    first_name: data.first_name,
    last_name: data.last_name,
    company_name: data.company_name ?? "",
    email: data.email ?? "",
    phone: data.phone,
    street_address: data.street_address,
    city: data.city,
    state: data.state ?? "NJ",
    zip: data.zip,
    notes: data.notes ?? "",
  };

  return callRtdApi<Customer>("createCustomer", { customer });
}

export async function updateCustomer(
  id: string,
  data: Partial<CustomerFormData>
): Promise<Customer> {
  return callRtdApi<Customer>("updateCustomer", {
    customer_id: id,
    data,
  });
}

export function searchCustomers(
  customers: Customer[],
  query: string
): Customer[] {
  const q = query.toLowerCase().trim();
  if (!q) return customers;

  return customers.filter((c) => {
    const haystack = [
      c.first_name,
      c.last_name,
      c.company_name,
      c.email,
      c.phone,
      c.city,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
