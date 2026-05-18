"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/estimates/new", label: "New Estimate" },
  { href: "/jobs", label: "Jobs" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();
  const isPrint = pathname?.includes("/print");

  if (isPrint) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-brand-100 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="shrink-0">
          <span className="text-lg font-bold text-brand-600">R.T. Davies</span>
          <span className="hidden text-sm text-gray-500 sm:inline">
            {" "}
            Estimates
          </span>
        </Link>
        <nav className="flex flex-wrap justify-end gap-1 text-sm">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/dashboard" &&
                pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 font-medium transition-colors ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
