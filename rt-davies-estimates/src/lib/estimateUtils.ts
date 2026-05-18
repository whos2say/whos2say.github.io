import type { Estimate, LineItem } from "@/types";
import type { EstimateFormData } from "./schemas";
import { parseBool } from "./calculations";

/** Client-safe: map sheet estimate + line items to form values */
export function estimateToFormData(
  estimate: Estimate,
  lineItems: LineItem[]
): EstimateFormData {
  const [first_name, ...rest] = estimate.customer_name.split(" ");
  return {
    first_name: first_name ?? "",
    last_name: rest.join(" ") ?? "",
    phone: estimate.phone,
    email: estimate.email,
    street_address: estimate.property_address,
    city: estimate.property_city,
    state: estimate.property_state,
    zip: estimate.property_zip,
    representative_name: estimate.representative_name,
    customer_notes: estimate.customer_notes,
    internal_notes: estimate.internal_notes,
    tax_rate: parseFloat(estimate.tax_rate) || 0.06625,
    line_items: lineItems.map((li) => ({
      service_category: li.service_category,
      service_description: li.service_description,
      tree_species: li.tree_species,
      location_on_property: li.location_on_property,
      quantity: parseFloat(li.quantity) || 1,
      unit: li.unit || "each",
      unit_price: parseFloat(li.unit_price) || 0,
      taxable: parseBool(li.taxable),
      crew_notes: li.crew_notes,
    })),
  };
}
