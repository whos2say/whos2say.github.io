import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/AppNav";

export const metadata: Metadata = {
  title: "R.T. Davies — Estimates",
  description: "Tree service estimate system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppNav />
        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
