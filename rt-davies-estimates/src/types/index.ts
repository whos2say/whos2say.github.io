import type { EstimateStatus, JobStatus } from "@/lib/constants";

export interface Customer {
  customer_id: string;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

export interface Estimate {
  estimate_id: string;
  estimate_number: string;
  created_at: string;
  updated_at: string;
  estimate_date: string;
  customer_id: string;
  customer_name: string;
  phone: string;
  email: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  status: EstimateStatus;
  representative_name: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  internal_notes: string;
  customer_notes: string;
  sent_at: string;
  approved_at: string;
  scheduled_at: string;
  completed_at: string;
  paid_at: string;
}

export interface LineItem {
  line_item_id: string;
  estimate_id: string;
  sort_order: string;
  service_category: string;
  service_description: string;
  tree_species: string;
  location_on_property: string;
  quantity: string;
  unit: string;
  unit_price: string;
  line_total: string;
  taxable: string;
  crew_notes: string;
}

export interface Job {
  job_id: string;
  estimate_id: string;
  customer_name: string;
  property_address: string;
  scheduled_date: string;
  crew_assigned: string;
  job_status: JobStatus;
  completion_notes: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  setting_key: string;
  setting_value: string;
}

export type SettingsMap = Record<string, string>;
