"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  PageHeader,
  LoadingSpinner,
  Alert,
  StatusBadge,
  Card,
} from "@/components/ui";
import { EstimateForm } from "@/components/EstimateForm";
import { EstimateActions } from "@/components/EstimateActions";
import { estimateToFormData } from "@/lib/estimateUtils";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { Estimate, LineItem } from "@/types";
import type { SettingsMap } from "@/types";
import type { EstimateFormData } from "@/lib/schemas";

export default function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [formData, setFormData] = useState<EstimateFormData | null>(null);
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/estimates/${id}`).then((r) => r.json()),
      fetch("/api/settings")
        .then((r) => (r.ok ? r.json() : DEFAULT_SETTINGS))
        .catch(() => DEFAULT_SETTINGS),
    ])
      .then(([estJson, settingsJson]) => {
        if (estJson.error) throw new Error(estJson.error);
        setEstimate(estJson.estimate);
        setLineItems(estJson.lineItems);
        setFormData(estimateToFormData(estJson.estimate, estJson.lineItems));
        setSettings(settingsJson);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (error || !estimate || !formData) {
    return <Alert type="error">{error ?? "Estimate not found"}</Alert>;
  }

  const categories = (
    settings.service_categories ?? DEFAULT_SETTINGS.service_categories
  )
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const taxRate = parseFloat(settings.default_tax_rate) || 0.06625;

  return (
    <>
      <PageHeader
        title={estimate.estimate_number}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={estimate.status} />
            <Link
              href={`/estimates/${id}/print`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Print
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <EstimateActions estimate={estimate} />
      </Card>

      <EstimateForm
        initialData={formData}
        estimateId={id}
        defaultTaxRate={taxRate}
        categories={categories}
      />
    </>
  );
}
