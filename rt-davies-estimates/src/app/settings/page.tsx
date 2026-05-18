"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Card,
  PageHeader,
  Input,
  Textarea,
  Button,
  LoadingSpinner,
  Alert,
} from "@/components/ui";
import {
  settingsFormResolver,
  type SettingsFormData,
} from "@/lib/schemas";
import { DEFAULT_SETTINGS } from "@/lib/constants";

export default function SettingsPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: settingsFormResolver,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : DEFAULT_SETTINGS))
      .then((data) => {
        reset({
          business_name: data.business_name,
          business_address: data.business_address,
          business_phone: data.business_phone,
          default_tax_rate: parseFloat(data.default_tax_rate) || 0.06625,
          default_terms: data.default_terms,
          service_categories: data.service_categories,
        });
        setLoaded(true);
      })
      .catch(() => {
        reset({
          business_name: DEFAULT_SETTINGS.business_name,
          business_address: DEFAULT_SETTINGS.business_address,
          business_phone: DEFAULT_SETTINGS.business_phone,
          default_tax_rate: parseFloat(DEFAULT_SETTINGS.default_tax_rate),
          default_terms: DEFAULT_SETTINGS.default_terms,
          service_categories: DEFAULT_SETTINGS.service_categories,
        });
        setLoaded(true);
      });
  }, [reset]);

  async function onSubmit(data: SettingsFormData) {
    setMessage(null);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(typeof json.error === "string" ? json.error : "Save failed");
      return;
    }
    setMessage("Settings saved to Google Sheets");
  }

  if (!loaded) return <LoadingSpinner />;

  return (
    <>
      <PageHeader title="Settings" />
      {message && (
        <div className="mb-4">
          <Alert type="success">{message}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Alert type="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Business info</h2>
          <div className="grid gap-3">
            <Input
              label="Business name"
              {...register("business_name")}
              error={errors.business_name?.message}
            />
            <Input
              label="Address"
              {...register("business_address")}
              error={errors.business_address?.message}
            />
            <Input
              label="Phone"
              {...register("business_phone")}
              error={errors.business_phone?.message}
            />
            <Input
              label="Default tax rate (decimal)"
              type="number"
              step="0.00001"
              {...register("default_tax_rate", { valueAsNumber: true })}
              error={errors.default_tax_rate?.message}
            />
            <Textarea
              label="Default terms"
              {...register("default_terms")}
              error={errors.default_terms?.message}
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Service categories</h2>
          <Textarea
            label="Pipe-separated (|) categories"
            rows={8}
            {...register("service_categories")}
            error={errors.service_categories?.message}
          />
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </>
  );
}
