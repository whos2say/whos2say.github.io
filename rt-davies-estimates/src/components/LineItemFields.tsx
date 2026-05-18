"use client";

import {
  UseFieldArrayReturn,
  UseFormRegister,
  FieldErrors,
} from "react-hook-form";
import { Input, Select, Textarea, Button } from "./ui";
import type { EstimateFormData } from "@/lib/schemas";
import { UNITS } from "@/lib/constants";
import { formatCurrency, lineTotal } from "@/lib/calculations";

interface LineItemFieldsProps {
  fields: UseFieldArrayReturn<EstimateFormData, "line_items">["fields"];
  register: UseFormRegister<EstimateFormData>;
  errors: FieldErrors<EstimateFormData>;
  categories: string[];
  onRemove: (index: number) => void;
  watchItems: EstimateFormData["line_items"];
}

export function LineItemFields({
  fields,
  register,
  errors,
  categories,
  onRemove,
  watchItems,
}: LineItemFieldsProps) {
  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const item = watchItems?.[index];
        const qty = item?.quantity ?? 0;
        const price = item?.unit_price ?? 0;
        const total = lineTotal(Number(qty), Number(price));

        return (
          <div
            key={field.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                Line item {index + 1}
              </h3>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onRemove(index)}
                  className="text-red-600"
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Service category"
                {...register(`line_items.${index}.service_category`)}
                error={
                  errors.line_items?.[index]?.service_category?.message
                }
              >
                <option value="">Select…</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>

              <Input
                label="Tree species"
                placeholder="e.g. Oak"
                {...register(`line_items.${index}.tree_species`)}
              />

              <div className="sm:col-span-2">
                <Textarea
                  label="Description"
                  placeholder="Remove right side rear neighbor's oak, cut low"
                  {...register(`line_items.${index}.service_description`)}
                  error={
                    errors.line_items?.[index]?.service_description?.message
                  }
                />
              </div>

              <Input
                label="Location on property"
                placeholder="right side rear / neighbor side"
                {...register(`line_items.${index}.location_on_property`)}
              />

              <Input
                label="Quantity"
                type="number"
                step="0.01"
                min="0"
                {...register(`line_items.${index}.quantity`, {
                  valueAsNumber: true,
                })}
                error={errors.line_items?.[index]?.quantity?.message}
              />

              <Select
                label="Unit"
                {...register(`line_items.${index}.unit`)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>

              <Input
                label="Unit price ($)"
                type="number"
                step="0.01"
                min="0"
                {...register(`line_items.${index}.unit_price`, {
                  valueAsNumber: true,
                })}
                error={errors.line_items?.[index]?.unit_price?.message}
              />

              <label className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-gray-300"
                  {...register(`line_items.${index}.taxable`)}
                />
                <span className="text-sm font-medium">Taxable (NJ sales tax)</span>
              </label>

              <div className="sm:col-span-2">
                <Textarea
                  label="Crew notes"
                  {...register(`line_items.${index}.crew_notes`)}
                />
              </div>

              <p className="text-right text-sm font-semibold text-brand-700 sm:col-span-2">
                Line total: {formatCurrency(total)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
