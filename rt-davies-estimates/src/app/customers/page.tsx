"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  PageHeader,
  Input,
  Button,
  LoadingSpinner,
  Alert,
} from "@/components/ui";
import { CustomerModal } from "@/components/CustomerModal";
import type { Customer } from "@/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const url = query
      ? `/api/customers?q=${encodeURIComponent(query)}`
      : "/api/customers";
    fetch(url)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed");
        setCustomers(json);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <>
      <PageHeader
        title="Customers"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            + Add customer
          </Button>
        }
      />

      <Card className="mb-4">
        <Input
          label="Search"
          placeholder="Name, phone, email, town…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Town</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customer_id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {c.first_name} {c.last_name}
                    {c.company_name && (
                      <span className="block text-xs text-gray-500">
                        {c.company_name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3">{c.city}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditing(c);
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
              {!customers.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <CustomerModal
        open={modalOpen}
        customer={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
      />
    </>
  );
}
