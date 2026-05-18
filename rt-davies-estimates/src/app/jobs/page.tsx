"use client";

import { useEffect, useState } from "react";
import {
  Card,
  PageHeader,
  LoadingSpinner,
  Alert,
  StatusBadge,
  Select,
  Input,
} from "@/components/ui";
import type { Job } from "@/types";
import { JOB_STATUSES } from "@/lib/constants";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/jobs")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed");
        setJobs(json);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function updateJob(jobId: string, data: Partial<Job>) {
    const res = await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, ...data }),
    });
    if (res.ok) load();
  }

  return (
    <>
      <PageHeader title="Jobs" />
      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.job_id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{job.customer_name}</h3>
                  <p className="text-sm text-gray-600">{job.property_address}</p>
                </div>
                <StatusBadge status={job.job_status} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input
                  label="Scheduled date"
                  type="date"
                  defaultValue={job.scheduled_date}
                  onBlur={(e) =>
                    updateJob(job.job_id, { scheduled_date: e.target.value })
                  }
                />
                <Input
                  label="Crew assigned"
                  defaultValue={job.crew_assigned}
                  onBlur={(e) =>
                    updateJob(job.job_id, { crew_assigned: e.target.value })
                  }
                />
                <Select
                  label="Status"
                  defaultValue={job.job_status}
                  onChange={(e) =>
                    updateJob(job.job_id, {
                      job_status: e.target.value as Job["job_status"],
                    })
                  }
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Completion notes"
                  defaultValue={job.completion_notes}
                  onBlur={(e) =>
                    updateJob(job.job_id, { completion_notes: e.target.value })
                  }
                />
              </div>
            </Card>
          ))}
          {!jobs.length && (
            <Card>
              <p className="text-gray-500">
                No jobs yet. Convert an approved estimate to create a job.
              </p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
