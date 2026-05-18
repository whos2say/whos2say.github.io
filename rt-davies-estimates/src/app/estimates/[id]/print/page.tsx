"use client";

import { useEffect, useState, use } from "react";
import { PrintableEstimate } from "@/components/PrintableEstimate";
import { Button, LoadingSpinner, Alert } from "@/components/ui";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { Estimate, LineItem } from "@/types";
import type { SettingsMap } from "@/types";

export default function PrintEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

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
        setSettings(settingsJson);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!estimate) return <LoadingSpinner />;

  return (
    <>
      <div className="no-print mb-4 flex gap-2">
        <Button onClick={() => window.print()}>Print</Button>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>
      <PrintableEstimate
        estimate={estimate}
        lineItems={lineItems}
        settings={settings}
      />
    </>
  );
}
