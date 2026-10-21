import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "JetReset – Calm recovery from jet lag",
  description:
    "JetReset helps travellers recover from jet lag with practical, time-aware recovery guidance.",
  icons: {
    icon: "/favicon.ico"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">
        <header className="border-b border-slate-200 bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
            <a href="/" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand-dark font-semibold">
                JR
              </span>
              <span className="text-base font-semibold tracking-tight text-surface-strong">
                JetReset
              </span>
            </a>
            <nav aria-label="Primary">
              <span className="text-sm text-slate-500">
                Premium jet lag recovery, coming soon.
              </span>
            </nav>
          </div>
        </header>

        <main className="app-main">{children}</main>

        <footer className="border-t border-slate-200 bg-surface-soft">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
            <p>&copy; {new Date().getFullYear()} JetReset. All rights reserved.</p>
            <p>
              Feature 1: Application foundation only. Product features are not yet
              implemented.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
