"use client";

import Link from "next/link";
import React from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type AccountState = { signedIn: false } | { signedIn: true; username: string };

export function AccountNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<AccountState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    fetch("/api/auth/session")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load account status.");
        return (await response.json()) as AccountState;
      })
      .then((result) => {
        if (active) setAccount(result);
      })
      .catch(() => {
        if (active) setError("Account status unavailable.");
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  async function signOut() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to sign out. Please try again.");
      setAccount({ signedIn: false });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign out.");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      <Link
        href="/trips"
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-brand-dark hover:underline"
      >
        Your Trips
      </Link>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-surface-strong hover:underline"
      >
        Daily Dashboard
      </Link>
      <Link
        href="/flight-status"
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-surface-strong hover:underline"
      >
        Flight Status
      </Link>
      <Link
        href="/travel-metrics"
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-brand-dark hover:underline"
      >
        Travel Metrics
      </Link>
      <Link
        href="/community"
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-brand-dark hover:underline"
      >
        Leaderboard
      </Link>
      <details className="group relative">
        <summary
          aria-label="Account menu"
          title="Account"
          className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-300 bg-surface text-slate-600 transition hover:border-brand hover:bg-brand-soft hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5"
          >
            <circle cx="12" cy="8" r="3.25" />
            <path d="M5.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
          </svg>
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-slate-200 bg-surface p-2 shadow-lg">
          {account === null ? (
            <p className="px-3 py-2 text-sm text-slate-500" role="status">
              {error || "Loading account…"}
            </p>
          ) : account.signedIn ? (
            <>
              <p className="px-3 py-2 text-sm text-slate-500">@{account.username}</p>
              <Link
                href="/account/settings"
                className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-soft hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Account settings
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/account/sign-in"
                className="block rounded-md px-3 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Sign in
              </Link>
              <Link
                href="/account/register"
                className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-brand-soft hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Create account
              </Link>
            </>
          )}
        </div>
      </details>
      {error && (
        <span role="status" className="sr-only">
          {error}
        </span>
      )}
    </div>
  );
}
