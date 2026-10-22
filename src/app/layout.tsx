import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "JetReset – Plan your trip and find your rhythm",
  description:
    "Organize your trip across time zones, map your flights, and follow practical destination-time recovery guidance with JetReset.",
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
            <nav aria-label="Primary">
              <ul className="flex items-center gap-4 text-sm font-medium">
                <li>
                  <Link
                    href="/trips"
                    className="text-slate-600 underline-offset-4 hover:text-surface-strong hover:underline"
                  >
                    Trips
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard"
                    className="text-slate-600 underline-offset-4 hover:text-surface-strong hover:underline"
                  >
                    Daily Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/flight-status"
                    className="text-slate-600 underline-offset-4 hover:text-surface-strong hover:underline"
                  >
                    Flight Status
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        <main className="app-main">{children}</main>

        <footer className="border-t border-slate-200 bg-surface-soft">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
            <p>&copy; {new Date().getFullYear()} JetReset. All rights reserved.</p>
            <p>Time-aware trip planning and general recovery guidance.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
