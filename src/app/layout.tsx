import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "JetReset – Calm recovery from jet lag",
  description:
    "JetReset helps travellers recover from jet lag with practical, time-aware recovery guidance.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">
        <header className="border-b border-slate-200 bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-dark font-semibold">
                JR
              </span>
              <span className="text-base font-semibold tracking-tight text-surface-strong">
                JetReset
              </span>
            </Link>
          </div>
        </header>

        <main className="app-main">{children}</main>

        <footer className="border-t border-slate-200 bg-surface-soft">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
            <p>&copy; {new Date().getFullYear()} JetReset. All rights reserved.</p>
            <p>Trip planning is in development. Recovery guidance is coming soon.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
