import type { Estimate, LineItem } from "@/types";
import type { SettingsMap } from "@/types";
import { formatCurrency, parseBool } from "@/lib/calculations";

interface PrintableEstimateProps {
  estimate: Estimate;
  lineItems: LineItem[];
  settings: SettingsMap;
}

export function PrintableEstimate({
  estimate,
  lineItems,
  settings,
}: PrintableEstimateProps) {
  const propertyAddress = [
    estimate.property_address,
    estimate.property_city,
    estimate.property_state,
    estimate.property_zip,
  ]
    .filter(Boolean)
    .join(", ");

  const taxRate = parseFloat(estimate.tax_rate) || 0;
  const taxPercent = (taxRate * 100).toFixed(3);

  return (
    <article className="mx-auto max-w-3xl bg-white p-6 text-gray-900 print:p-0 sm:p-10">
      <header className="border-b-2 border-brand-600 pb-4">
        <h1 className="text-2xl font-bold text-brand-700">
          {settings.business_name}
        </h1>
        <p className="text-sm text-gray-600">{settings.business_address}</p>
        <p className="text-sm text-gray-600">{settings.business_phone}</p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">
            Estimate
          </p>
          <p className="text-lg font-bold">{estimate.estimate_number}</p>
          <p className="text-sm">Date: {estimate.estimate_date}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{estimate.customer_name}</p>
          <p>{propertyAddress}</p>
          <p>{estimate.phone}</p>
          {estimate.email && <p>{estimate.email}</p>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 border-b font-semibold">Work assignment / scope</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs uppercase text-gray-600">
              <th className="py-2 pr-2">Service</th>
              <th className="py-2 pr-2">Description / location</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((li) => (
              <tr key={li.line_item_id} className="border-b align-top">
                <td className="py-3 pr-2 font-medium">{li.service_category}</td>
                <td className="py-3 pr-2">
                  <p>{li.service_description}</p>
                  {li.tree_species && (
                    <p className="text-gray-500">Species: {li.tree_species}</p>
                  )}
                  {li.location_on_property && (
                    <p className="text-gray-500">Location: {li.location_on_property}</p>
                  )}
                </td>
                <td className="py-3 pr-2 text-right">
                  {li.quantity} {li.unit}
                </td>
                <td className="py-3 pr-2 text-right">
                  {formatCurrency(parseFloat(li.unit_price) || 0)}
                </td>
                <td className="py-3 text-right font-medium">
                  {formatCurrency(parseFloat(li.line_total) || 0)}
                  {parseBool(li.taxable) && (
                    <span className="block text-xs text-gray-500">taxable</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(parseFloat(estimate.subtotal) || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>NJ sales tax ({taxPercent}%)</span>
            <span>{formatCurrency(parseFloat(estimate.tax_amount) || 0)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(parseFloat(estimate.total) || 0)}</span>
          </div>
        </div>
      </section>

      {estimate.customer_notes && (
        <section className="mt-6 text-sm">
          <h3 className="font-semibold">Notes</h3>
          <p className="whitespace-pre-wrap text-gray-700">
            {estimate.customer_notes}
          </p>
        </section>
      )}

      <section className="mt-8 border-t pt-4 text-xs text-gray-600">
        <h3 className="mb-2 font-semibold uppercase">Terms</h3>
        <p>{settings.default_terms}</p>
      </section>

      <section className="mt-12 grid gap-8 sm:grid-cols-2">
        <div>
          <p className="border-t border-gray-400 pt-2 text-sm">
            Customer signature / approval
          </p>
        </div>
        <div>
          <p className="border-t border-gray-400 pt-2 text-sm">Date</p>
        </div>
      </section>

      {estimate.representative_name && (
        <p className="mt-8 text-sm text-gray-600">
          Prepared by: {estimate.representative_name}
        </p>
      )}
    </article>
  );
}
