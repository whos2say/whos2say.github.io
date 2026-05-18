/** Sheet tab names — must match the Google Spreadsheet exactly */
export const SHEET_NAMES = {
  CUSTOMERS: "Customers",
  ESTIMATES: "Estimates",
  LINE_ITEMS: "Estimate_Line_Items",
  JOBS: "Jobs",
  SETTINGS: "Settings",
} as const;

export type SheetName = (typeof SHEET_NAMES)[keyof typeof SHEET_NAMES];

export const ESTIMATE_STATUSES = [
  "draft",
  "sent",
  "approved",
  "rejected",
  "scheduled",
  "completed",
  "paid",
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const JOB_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const DEFAULT_SERVICE_CATEGORIES = [
  "Tree Removal",
  "Stump Grinding",
  "Limb Removal",
  "Tree Pruning",
  "Shrub Pruning",
  "Fertilization",
  "Deep Root Feeding",
  "Spraying",
  "Insect Management",
  "Consulting",
  "Tree Planting",
  "Yearly Maintenance Program",
  "Other",
] as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  business_name: "R.T. Davies Tree Experts",
  business_address: "2101 Bridge Avenue, Point Pleasant, NJ 08742",
  business_phone: "732-899-0328",
  default_tax_rate: "0.06625",
  default_terms:
    "Payment in full upon completion of work unless otherwise specified.",
  service_categories: DEFAULT_SERVICE_CATEGORIES.join("|"),
};

export const UNITS = ["each", "hour", "day", "tree", "limb", "stump"] as const;
