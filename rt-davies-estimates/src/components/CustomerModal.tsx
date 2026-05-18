"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { customerFormResolver, type CustomerFormData } from "@/lib/schemas";
import { Button, Input, Textarea } from "./ui";
import type { Customer } from "@/types";

interface CustomerModalProps {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CustomerModal({
  open,
  customer,
  onClose,
  onSaved,
}: CustomerModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: customerFormResolver,
  });

  useEffect(() => {
    if (open) {
      reset(
        customer
          ? {
              first_name: customer.first_name,
              last_name: customer.last_name,
              company_name: customer.company_name,
              email: customer.email,
              phone: customer.phone,
              street_address: customer.street_address,
              city: customer.city,
              state: customer.state,
              zip: customer.zip,
              notes: customer.notes,
            }
          : {
              first_name: "",
              last_name: "",
              company_name: "",
              email: "",
              phone: "",
              street_address: "",
              city: "",
              state: "NJ",
              zip: "",
              notes: "",
            }
      );
    }
  }, [open, customer, reset]);

  if (!open) return null;

  async function onSubmit(data: CustomerFormData) {
    const url = customer
      ? `/api/customers/${customer.customer_id}`
      : "/api/customers";
    const method = customer ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">
          {customer ? "Edit customer" : "Add customer"}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="First name *" {...register("first_name")} error={errors.first_name?.message} />
            <Input label="Last name *" {...register("last_name")} error={errors.last_name?.message} />
            <Input label="Company" className="sm:col-span-2" {...register("company_name")} />
            <Input label="Phone *" {...register("phone")} error={errors.phone?.message} />
            <Input label="Email" type="email" {...register("email")} />
            <Input label="Address *" className="sm:col-span-2" {...register("street_address")} error={errors.street_address?.message} />
            <Input label="City *" {...register("city")} error={errors.city?.message} />
            <Input label="State" {...register("state")} />
            <Input label="ZIP *" {...register("zip")} error={errors.zip?.message} />
          </div>
          <Textarea label="Notes" {...register("notes")} />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
