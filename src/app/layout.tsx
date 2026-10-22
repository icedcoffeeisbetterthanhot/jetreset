import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { AccountNavigation } from "@components/auth/AccountNavigation";

export const metadata: Metadata = {
  title: "JetReset – Plan your trip and find your rhythm",
  description:
    "Organise your trip across time zones, map your flights, and follow practical destination-time recovery guidance with JetReset.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="app-shell">
        <header className="border-b border-slate-200 bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
            <Link
              href="/"
              aria-label="JetReset home"
              className="group flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-offset-surface"
            >
              <Image
                src="/jetreset-mark.svg"
                alt=""
                width={40}
                height={40}
                priority
                className="h-10 w-10 transition-transform duration-200 group-hover:scale-105"
              />
              <span className="text-lg font-bold tracking-tight text-surface-strong">
                Jet<span className="text-brand-dark">Reset</span>
              </span>
            </Link>
            <nav aria-label="Primary">
              <AccountNavigation />
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
