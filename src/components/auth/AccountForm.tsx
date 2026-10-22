"use client";

import Link from "next/link";
import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AccountFormProps = { mode: "register" | "login" };
type AccountResult = {
  error?: string;
  guestTripCount?: number;
};

const fieldClass =
  "w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-surface-strong focus-visible:ring-2 focus-visible:ring-brand";

export function AccountForm({ mode }: AccountFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [transferCount, setTransferCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const title = mode === "register" ? "Create your account" : "Welcome back";

  async function finishSignIn(transfer: boolean) {
    setError("");
    setSubmitting(true);
    try {
      if (transfer) {
        const response = await fetch("/api/auth/transfer-trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        });
        if (!response.ok) {
          const result = (await response.json()) as AccountResult;
          throw new Error(result.error ?? "Unable to transfer guest trips.");
        }
      }
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = (await response.json()) as AccountResult;
      if (!response.ok) throw new Error(result.error ?? "Unable to complete the account request.");
      if (result.guestTripCount && result.guestTripCount > 0) {
        setTransferCount(result.guestTripCount);
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete the account request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-surface-strong">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {mode === "register"
          ? "Create an account with a username and password to add friends and save your Cloud Dodger scores. You can keep using JetReset as a guest."
          : "Sign in with your username and password to access your trips, friends, and saved game scores."}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1 text-sm font-medium text-surface-strong">
          Username
          <input
            className={fieldClass}
            autoComplete="username"
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_]{3,24}"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm font-medium text-surface-strong">
          Password
          <input
            className={fieldClass}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "register" && (
            <span className="block text-xs font-normal text-slate-500">
              Use at least 12 characters and store it safely. Password recovery is unavailable.
            </span>
          )}
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger-dark">
            {error}
          </p>
        )}
        {transferCount !== null && (
          <div className="space-y-3 rounded-md border border-slate-200 bg-surface-muted p-4">
            <p className="text-sm leading-6 text-slate-700">
              This guest session has {transferCount} trip{transferCount === 1 ? "" : "s"}. Transfer
              them to your account, or keep them separate as guest data.
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void finishSignIn(true)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              Transfer trips to my account
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void finishSignIn(false)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-surface px-4 py-2 text-sm font-semibold text-surface-strong hover:bg-surface-muted disabled:opacity-60"
            >
              Keep guest trips separate
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Please wait…" : title}
        </button>
      </form>

      <nav aria-label="Account links" className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode !== "login" && (
          <Link
            className="text-brand-dark underline-offset-4 hover:underline"
            href="/account/sign-in"
          >
            Sign in
          </Link>
        )}
        {mode !== "register" && (
          <Link
            className="text-brand-dark underline-offset-4 hover:underline"
            href="/account/register"
          >
            Create account
          </Link>
        )}
      </nav>
    </section>
  );
}
