"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  PageHeader,
  LoadingSpinner,
  StatusBadge,
  Alert,
} from "@/components/ui";
import { formatCurrency } from "@/lib/calculations";
import type { Estimate } from "@/types";
import type { DashboardData } from "@/lib/services/dashboard";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        setData(json);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Alert type="error">{error}</Alert>
        <p className="mt-4 text-sm text-gray-600">
          See <code className="rounded bg-gray-100 px-1">docs/APPS_SCRIPT_SETUP.md</code> and check <code className="rounded bg-gray-100 px-1">/api/sheets/health</code>.
        </p>
      </>
    );
  }

  if (!data) return <LoadingSpinner />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        action={
          <Link
            href="/estimates/new"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + New estimate
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Draft" value={data.draft.length} />
        <StatCard label="Sent" value={data.sent.length} />
        <StatCard label="Approved" value={data.approved.length} />
        <StatCard label="Scheduled jobs" value={data.scheduledJobs} />
      </div>

      <Card className="mb-6">
        <p className="text-sm text-gray-500">Pipeline revenue (sent + approved + scheduled)</p>
        <p className="text-3xl font-bold text-brand-700">
          {formatCurrency(data.totalEstimatedRevenue)}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {data.completedUnpaid.length} completed, unpaid
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Recent estimates</h2>
        <EstimateTable estimates={data.recentEstimates} />
      </Card>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <p className="text-3xl font-bold text-brand-700">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </Card>
  );
}

function EstimateTable({ estimates }: { estimates: Estimate[] }) {
  if (!estimates.length) {
    return <p className="text-gray-500">No estimates yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-gray-500">
            <th className="py-2 pr-4">#</th>
            <th className="py-2 pr-4">Customer</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((e) => (
            <tr key={e.estimate_id} className="border-b hover:bg-gray-50">
              <td className="py-3 pr-4">
                <Link
                  href={`/estimates/${e.estimate_id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {e.estimate_number}
                </Link>
              </td>
              <td className="py-3 pr-4">{e.customer_name}</td>
              <td className="py-3 pr-4">
                <StatusBadge status={e.status} />
              </td>
              <td className="py-3 text-right font-medium">
                {formatCurrency(parseFloat(e.total) || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
