export interface LineItemCalc {
  quantity: number;
  unit_price: number;
  taxable: boolean;
}

export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function calculateEstimateTotals(
  items: LineItemCalc[],
  taxRate: number
): { subtotal: number; tax_amount: number; total: number } {
  const subtotal = items.reduce(
    (sum, item) => sum + lineTotal(item.quantity, item.unit_price),
    0
  );

  const taxableSubtotal = items
    .filter((i) => i.taxable)
    .reduce((sum, item) => sum + lineTotal(item.quantity, item.unit_price), 0);

  const tax_amount = Math.round(taxableSubtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax_amount) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount,
    total,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function parseBool(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (!value) return false;
  const v = String(value).toLowerCase();
  return v === "yes" || v === "true" || v === "1";
}
