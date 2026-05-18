"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Alert } from "./ui";
import type { Estimate } from "@/types";

export function EstimateActions({ estimate }: { estimate: Estimate }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mailto, setMailto] = useState<string | null>(null);

  async function setStatus(action: string) {
    setLoading(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/estimates/${estimate.estimate_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed");
      }
      router.refresh();
      setMessage(`Marked as ${action}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  async function sendEstimate() {
    setLoading("send");
    setMessage(null);
    setMailto(null);
    try {
      const res = await fetch(
        `/api/estimates/${estimate.estimate_id}/send`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");

      if (json.method === "resend") {
        setMessage("Estimate emailed successfully");
      } else if (json.mailto) {
        setMailto(json.mailto);
        setMessage("Resend not configured — open your email client to send");
        window.open(json.mailto, "_blank");
      }
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Send failed");
    } finally {
      setLoading(null);
    }
  }

  async function convertToJob() {
    setLoading("job");
    const scheduled = prompt(
      "Scheduled date (YYYY-MM-DD)",
      new Date().toISOString().split("T")[0]
    );
    if (!scheduled) {
      setLoading(null);
      return;
    }
    const crew = prompt("Crew assigned (optional)", "") ?? "";
    try {
      const res = await fetch(
        `/api/estimates/${estimate.estimate_id}/job`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduled_date: scheduled,
            crew_assigned: crew,
          }),
        }
      );
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed");
      }
      setMessage("Job created");
      router.push("/jobs");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4 no-print">
      {message && <Alert type="info">{message}</Alert>}
      {mailto && (
        <a href={mailto} className="text-sm text-brand-600 underline">
          Open email draft
        </a>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={`/estimates/${estimate.estimate_id}/print`}>
          <Button type="button" variant="secondary">
            Print estimate
          </Button>
        </Link>

        <Button
          type="button"
          onClick={sendEstimate}
          disabled={loading === "send"}
        >
          {loading === "send" ? "Sending…" : "Send estimate"}
        </Button>

        {estimate.status !== "approved" && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStatus("approved")}
            disabled={!!loading}
          >
            Mark approved
          </Button>
        )}

        {estimate.status !== "rejected" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStatus("rejected")}
            disabled={!!loading}
          >
            Mark rejected
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          onClick={convertToJob}
          disabled={loading === "job"}
        >
          Convert to job
        </Button>
      </div>
    </div>
  );
}
