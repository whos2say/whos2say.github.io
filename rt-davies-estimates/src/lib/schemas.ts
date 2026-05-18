import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";

export const customerSchema = z.object({
  first_name: z.string().min(1, "First name required"),
  last_name: z.string().min(1, "Last name required"),
  company_name: z.string().default(""),
  email: z.union([z.string().email(), z.literal("")]).default(""),
  phone: z.string().min(1, "Phone required"),
  street_address: z.string().min(1, "Address required"),
  city: z.string().min(1, "City required"),
  state: z.string().default("NJ"),
  zip: z.string().min(1, "ZIP required"),
  notes: z.string().default(""),
});

export const lineItemSchema = z.object({
  service_category: z.string().min(1, "Category required"),
  service_description: z.string().min(1, "Description required"),
  tree_species: z.string().default(""),
  location_on_property: z.string().default(""),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().default("each"),
  unit_price: z.coerce.number().nonnegative("Price required"),
  taxable: z.boolean().default(true),
  crew_notes: z.string().default(""),
});

export const estimateFormSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().default(""),
  street_address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().default("NJ"),
  zip: z.string().min(1),
  representative_name: z.string().default(""),
  customer_notes: z.string().default(""),
  internal_notes: z.string().default(""),
  tax_rate: z.coerce.number().min(0).max(1).default(0.06625),
  line_items: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type LineItemFormData = z.infer<typeof lineItemSchema>;
export type EstimateFormData = z.infer<typeof estimateFormSchema>;

/** Typed resolvers (Zod input vs output mismatch with @hookform/resolvers v5) */
export const customerFormResolver: Resolver<CustomerFormData> = zodResolver(
  customerSchema
) as Resolver<CustomerFormData>;
export const estimateFormResolver: Resolver<EstimateFormData> = zodResolver(
  estimateFormSchema
) as Resolver<EstimateFormData>;

export const jobSchema = z.object({
  estimate_id: z.string().min(1),
  scheduled_date: z.string().min(1),
  crew_assigned: z.string().default(""),
  job_status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
  completion_notes: z.string().default(""),
});

export const settingsSchema = z.object({
  business_name: z.string().min(1),
  business_address: z.string().min(1),
  business_phone: z.string().min(1),
  default_tax_rate: z.coerce.number().min(0).max(1),
  default_terms: z.string().min(1),
  service_categories: z.string().min(1),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;

export const settingsFormResolver: Resolver<SettingsFormData> = zodResolver(
  settingsSchema
) as Resolver<SettingsFormData>;
