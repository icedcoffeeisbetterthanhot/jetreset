"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type LeaderboardEntry = { rank: number; username: string; score: number };
type FriendRequest = {
  id: number;
  status: "pending" | "accepted" | "declined";
  direction: "sent" | "received";
  otherUser: { id: number; username: string };
};

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load community information.");
  return response.json() as Promise<T>;
}

export function CommunityDashboard({ signedIn }: { signedIn: boolean }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.all([
        readJson<{ entries: LeaderboardEntry[] }>("/api/leaderboard"),
        signedIn
          ? readJson<{ requests: FriendRequest[] }>("/api/friends")
          : Promise.resolve({ requests: [] }),
      ]);
      setEntries(results[0].entries);
      setRequests(results[1].requests);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load community information.");
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addFriend(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to send friend request.");
      setUsername("");
      setMessage("Friend request sent.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send friend request.");
    }
  }

  async function respondToRequest(id: number, accepted: boolean) {
    setError("");
    try {
      const response = await fetch(`/api/friends/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update friend request.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update friend request.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-12 md:px-6 md:py-16">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-dark">Community</p>
        <h1 className="text-3xl font-semibold tracking-tight text-surface-strong">
          Cloud Dodger leaderboard
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Compare each player’s best server-validated score. Only usernames and scores appear here;
          trip details stay private.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger-dark"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-accent-dark">
          {message}
        </p>
      )}

      <section
        aria-labelledby="leaderboard-heading"
        className="rounded-lg border border-slate-200 bg-surface p-5 sm:p-7"
      >
        <h2 id="leaderboard-heading" className="text-xl font-semibold text-surface-strong">
          Top pilots
        </h2>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading scores…</p>
        ) : entries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No verified scores yet. Sign in and play Cloud Dodger to set the first record.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-slate-100">
            {entries.map((entry) => (
              <li key={entry.rank} className="flex items-center justify-between gap-4 py-3">
                <span className="flex items-center gap-3 text-sm text-surface-strong">
                  <span className="w-8 font-semibold tabular-nums text-brand-dark">
                    #{entry.rank}
                  </span>
                  @{entry.username}
                </span>
                <span className="text-sm font-semibold tabular-nums text-surface-strong">
                  {entry.score} dodged
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {signedIn ? (
        <section
          aria-labelledby="friends-heading"
          className="rounded-lg border border-slate-200 bg-surface p-5 sm:p-7"
        >
          <h2 id="friends-heading" className="text-xl font-semibold text-surface-strong">
            Friends
          </h2>
          <form onSubmit={addFriend} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="friend-username">
              Friend’s username
            </label>
            <input
              id="friend-username"
              className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Enter a username"
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]{3,24}"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <button
              type="submit"
              className="min-h-11 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Add friend
            </button>
          </form>
          {requests.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Add friends by username to build your community.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {requests.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm text-surface-strong">
                    @{request.otherUser.username}
                    {request.status === "accepted"
                      ? " · Friend"
                      : request.status === "declined"
                        ? " · Declined"
                        : request.direction === "sent"
                          ? " · Request sent"
                          : " · Wants to be friends"}
                  </span>
                  {request.status === "pending" && request.direction === "received" && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void respondToRequest(request.id, true)}
                        className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondToRequest(request.id, false)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-surface-muted"
                      >
                        Decline
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-brand/10 bg-brand-soft p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-surface-strong">
            Play as a guest, join the board when ready
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Guest play stays available. Create an account to save your verified high scores and add
            friends.
          </p>
          <Link
            href="/account/register"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Create account
          </Link>
        </section>
      )}
    </div>
  );
}
