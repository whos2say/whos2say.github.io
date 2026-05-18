"use client";

import { useEffect, useState } from "react";
import { PageHeader, LoadingSpinner } from "@/components/ui";
import { EstimateForm } from "@/components/EstimateForm";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { SettingsMap } from "@/types";

function parseCategories(settings: SettingsMap): string[] {
  const raw =
    settings.service_categories ?? DEFAULT_SETTINGS.service_categories;
  return raw.split("|").map((s) => s.trim()).filter(Boolean);
}

export default function NewEstimatePage() {
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : DEFAULT_SETTINGS))
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  if (!settings) return <LoadingSpinner />;

  const categories = parseCategories(settings);
  const taxRate = parseFloat(settings.default_tax_rate) || 0.06625;

  return (
    <>
      <PageHeader title="New estimate" />
      <EstimateForm
        defaultTaxRate={taxRate}
        categories={categories}
      />
    </>
  );
}
