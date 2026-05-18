import { v4 as uuidv4 } from "uuid";
import { callRtdApi } from "../rtdApiClient";
import type { Estimate, LineItem } from "@/types";
import type { EstimateFormData } from "../schemas";
import { generateEstimateNumber } from "../estimateNumber";
import { calculateEstimateTotals, lineTotal } from "../calculations";
import { createCustomer } from "./customers";

export async function listEstimates(): Promise<Estimate[]> {
  return callRtdApi<Estimate[]>("listEstimates");
}

export async function getEstimate(id: string): Promise<Estimate | null> {
  const result = await callRtdApi<{
    estimate: Estimate | null;
    lineItems: LineItem[];
  }>("getEstimate", { estimate_id: id });
  return result.estimate;
}

export async function getLineItems(estimateId: string): Promise<LineItem[]> {
  const result = await callRtdApi<{
    estimate: Estimate | null;
    lineItems: LineItem[];
  }>("getEstimate", { estimate_id: estimateId });
  return result.lineItems;
}

export async function createEstimate(
  data: EstimateFormData
): Promise<{ estimate: Estimate; lineItems: LineItem[] }> {
  const now = new Date().toISOString();
  const estimateId = uuidv4();
  const estimateNumber = await generateEstimateNumber();

  const customer = await createCustomer({
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    email: data.email,
    street_address: data.street_address,
    city: data.city,
    state: data.state,
    zip: data.zip,
    company_name: "",
    notes: "",
  });

  const calcItems = data.line_items.map((li) => ({
    quantity: li.quantity,
    unit_price: li.unit_price,
    taxable: li.taxable,
  }));
  const totals = calculateEstimateTotals(calcItems, data.tax_rate);
  const customerName = `${data.first_name} ${data.last_name}`.trim();

  const estimate: Estimate = {
    estimate_id: estimateId,
    estimate_number: estimateNumber,
    created_at: now,
    updated_at: now,
    estimate_date: now.split("T")[0],
    customer_id: customer.customer_id,
    customer_name: customerName,
    phone: data.phone,
    email: data.email ?? "",
    property_address: data.street_address,
    property_city: data.city,
    property_state: data.state ?? "NJ",
    property_zip: data.zip,
    status: "draft",
    representative_name: data.representative_name ?? "",
    subtotal: String(totals.subtotal),
    tax_rate: String(data.tax_rate),
    tax_amount: String(totals.tax_amount),
    total: String(totals.total),
    internal_notes: data.internal_notes ?? "",
    customer_notes: data.customer_notes ?? "",
    sent_at: "",
    approved_at: "",
    scheduled_at: "",
    completed_at: "",
    paid_at: "",
  };

  const lineItems: LineItem[] = data.line_items.map((li, index) => {
    const lt = lineTotal(li.quantity, li.unit_price);
    return {
      line_item_id: uuidv4(),
      estimate_id: estimateId,
      sort_order: String(index + 1),
      service_category: li.service_category,
      service_description: li.service_description,
      tree_species: li.tree_species ?? "",
      location_on_property: li.location_on_property ?? "",
      quantity: String(li.quantity),
      unit: li.unit ?? "each",
      unit_price: String(li.unit_price),
      line_total: String(lt),
      taxable: li.taxable ? "yes" : "no",
      crew_notes: li.crew_notes ?? "",
    };
  });

  return callRtdApi<{ estimate: Estimate; lineItems: LineItem[] }>(
    "createEstimate",
    { estimate, lineItems }
  );
}

export async function updateEstimateWithLineItems(
  estimateId: string,
  data: EstimateFormData,
  status?: Estimate["status"]
): Promise<{ estimate: Estimate; lineItems: LineItem[] }> {
  const existing = await getEstimate(estimateId);
  if (!existing) throw new Error("Estimate not found");

  const calcItems = data.line_items.map((li) => ({
    quantity: li.quantity,
    unit_price: li.unit_price,
    taxable: li.taxable,
  }));
  const totals = calculateEstimateTotals(calcItems, data.tax_rate);
  const customerName = `${data.first_name} ${data.last_name}`.trim();
  const now = new Date().toISOString();

  const estimate: Estimate = {
    ...existing,
    updated_at: now,
    customer_name: customerName,
    phone: data.phone,
    email: data.email ?? "",
    property_address: data.street_address,
    property_city: data.city,
    property_state: data.state ?? "NJ",
    property_zip: data.zip,
    representative_name: data.representative_name ?? "",
    subtotal: String(totals.subtotal),
    tax_rate: String(data.tax_rate),
    tax_amount: String(totals.tax_amount),
    total: String(totals.total),
    internal_notes: data.internal_notes ?? "",
    customer_notes: data.customer_notes ?? "",
    status: status ?? existing.status,
  };

  const lineItems: LineItem[] = data.line_items.map((li, index) => {
    const lt = lineTotal(li.quantity, li.unit_price);
    return {
      line_item_id: uuidv4(),
      estimate_id: estimateId,
      sort_order: String(index + 1),
      service_category: li.service_category,
      service_description: li.service_description,
      tree_species: li.tree_species ?? "",
      location_on_property: li.location_on_property ?? "",
      quantity: String(li.quantity),
      unit: li.unit ?? "each",
      unit_price: String(li.unit_price),
      line_total: String(lt),
      taxable: li.taxable ? "yes" : "no",
      crew_notes: li.crew_notes ?? "",
    };
  });

  return callRtdApi<{ estimate: Estimate; lineItems: LineItem[] }>(
    "updateEstimate",
    { estimate, lineItems }
  );
}

export async function updateEstimateStatus(
  estimateId: string,
  status: Estimate["status"],
  extra: Partial<Estimate> = {}
): Promise<Estimate> {
  return callRtdApi<Estimate>("updateEstimateStatus", {
    estimate_id: estimateId,
    status,
    extra,
  });
}
