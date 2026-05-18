"use client";

import { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  estimateFormResolver,
  type EstimateFormData,
} from "@/lib/schemas";
import { LineItemFields } from "./LineItemFields";
import { Card, Input, Textarea, Button, Alert } from "./ui";
import {
  calculateEstimateTotals,
  formatCurrency,
} from "@/lib/calculations";
import { DEFAULT_SERVICE_CATEGORIES } from "@/lib/constants";

const defaultLineItem = {
  service_category: "Tree Removal",
  service_description: "",
  tree_species: "",
  location_on_property: "",
  quantity: 1,
  unit: "each",
  unit_price: 0,
  taxable: true,
  crew_notes: "",
};

interface EstimateFormProps {
  initialData?: EstimateFormData;
  estimateId?: string;
  defaultTaxRate?: number;
  categories?: string[];
}

export function EstimateForm({
  initialData,
  estimateId,
  defaultTaxRate = 0.06625,
  categories = [...DEFAULT_SERVICE_CATEGORIES],
}: EstimateFormProps) {
  const router = useRouter();
  const isEdit = Boolean(estimateId);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<EstimateFormData>({
    resolver: estimateFormResolver,
    defaultValues: initialData ?? {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      street_address: "",
      city: "",
      state: "NJ",
      zip: "",
      representative_name: "",
      customer_notes: "",
      internal_notes: "",
      tax_rate: defaultTaxRate,
      line_items: [defaultLineItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  const watchAll = watch();
  const totals = useMemo(() => {
    const items = (watchAll.line_items ?? []).map((li) => ({
      quantity: Number(li.quantity) || 0,
      unit_price: Number(li.unit_price) || 0,
      taxable: Boolean(li.taxable),
    }));
    return calculateEstimateTotals(items, Number(watchAll.tax_rate) || 0);
  }, [watchAll.line_items, watchAll.tax_rate]);

  async function onSubmit(data: EstimateFormData, saveAsDraft = true) {
    try {
      const url = isEdit ? `/api/estimates/${estimateId}` : "/api/estimates";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { ...data, status: saveAsDraft ? "draft" : undefined }
        : data;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setError("root", {
          message: json.error?.message ?? json.error ?? "Save failed",
        });
        return;
      }

      const id = isEdit ? estimateId : json.estimate?.estimate_id;
      router.push(`/estimates/${id}`);
      router.refresh();
    } catch {
      setError("root", { message: "Network error — could not save estimate" });
    }
  }

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data, true))}
      className="space-y-6"
    >
      {errors.root && <Alert type="error">{errors.root.message}</Alert>}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Customer info</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="First name *" {...register("first_name")} error={errors.first_name?.message} />
          <Input label="Last name *" {...register("last_name")} error={errors.last_name?.message} />
          <Input label="Phone *" type="tel" {...register("phone")} error={errors.phone?.message} />
          <Input label="Email" type="email" {...register("email")} />
          <Input label="Street address *" className="sm:col-span-2" {...register("street_address")} error={errors.street_address?.message} />
          <Input label="Town *" {...register("city")} error={errors.city?.message} />
          <Input label="State" {...register("state")} />
          <Input label="ZIP *" {...register("zip")} error={errors.zip?.message} />
          <Input label="Representative" {...register("representative_name")} />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Work assignment</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => append(defaultLineItem)}
          >
            + Add line item
          </Button>
        </div>
        {errors.line_items?.message && (
          <div className="mb-4">
            <Alert type="error">{String(errors.line_items.message)}</Alert>
          </div>
        )}
        <LineItemFields
          fields={fields}
          register={register}
          errors={errors}
          categories={categories}
          onRemove={remove}
          watchItems={watchAll.line_items}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Totals</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="NJ tax rate"
            type="number"
            step="0.00001"
            {...register("tax_rate", { valueAsNumber: true })}
          />
          <div className="space-y-1 pt-6 text-right text-sm">
            <p>Subtotal: {formatCurrency(totals.subtotal)}</p>
            <p>Tax: {formatCurrency(totals.tax_amount)}</p>
            <p className="text-lg font-bold text-brand-700">
              Total: {formatCurrency(totals.total)}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Textarea label="Customer notes" {...register("customer_notes")} />
          <Textarea label="Internal notes" {...register("internal_notes")} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEdit ? "Save draft" : "Create estimate"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
