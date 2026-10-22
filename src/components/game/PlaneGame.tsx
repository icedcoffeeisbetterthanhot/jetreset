"use client";

import Link from "next/link";
import React from "react";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  CLOUD_DODGER_COLUMNS,
  CLOUD_DODGER_OBSTACLES,
  CLOUD_DODGER_ROWS,
  CLOUD_DODGER_TICK_MS,
  CloudDodgerInput,
  CloudDodgerObstacle,
  createCloudDodgerRandom,
} from "@lib/cloudDodger";

const BOARD_COLUMNS = CLOUD_DODGER_COLUMNS;
const BOARD_ROWS = CLOUD_DODGER_ROWS;
const TICK_INTERVAL = CLOUD_DODGER_TICK_MS;
type ObstacleType = CloudDodgerObstacle;

type Obstacle = {
  id: number;
  lane: number;
  row: number;
  type: ObstacleType;
};

type GameState = {
  status: "ready" | "running" | "crashed";
  planeLane: number;
  obstacles: Obstacle[];
  score: number;
  nextObstacleId: number;
  ticks: number;
};

type GameAction =
  | { type: "start" }
  | { type: "move"; direction: -1 | 1 }
  | { type: "tick"; lane: number; obstacleType: ObstacleType };

const initialState: GameState = {
  status: "ready",
  planeLane: Math.floor(BOARD_COLUMNS / 2),
  obstacles: [],
  score: 0,
  nextObstacleId: 0,
  ticks: 0,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "start":
      return { ...initialState, status: "running" };
    case "move":
      return state.status === "running"
        ? {
            ...state,
            planeLane: Math.max(0, Math.min(BOARD_COLUMNS - 1, state.planeLane + action.direction)),
          }
        : state;
    case "tick": {
      if (state.status !== "running") {
        return state;
      }

      const movement = 1 + Math.floor(state.ticks / 8);
      const movedObstacles = state.obstacles.map((obstacle) => ({
        ...obstacle,
        row: obstacle.row + movement,
      }));
      const crashed = movedObstacles.some(
        (obstacle) =>
          obstacle.row >= BOARD_ROWS - 1 &&
          obstacle.lane === state.planeLane &&
          state.obstacles.some(
            (previous) => previous.id === obstacle.id && previous.row < BOARD_ROWS - 1,
          ),
      );
      const clearedCount = movedObstacles.filter(
        (obstacle) =>
          obstacle.row >= BOARD_ROWS - 1 &&
          obstacle.lane !== state.planeLane &&
          state.obstacles.some(
            (previous) => previous.id === obstacle.id && previous.row < BOARD_ROWS - 1,
          ),
      ).length;

      return {
        ...state,
        status: crashed ? "crashed" : "running",
        obstacles: [
          ...movedObstacles.filter((obstacle) => obstacle.row < BOARD_ROWS - 1),
          { id: state.nextObstacleId, lane: action.lane, row: 0, type: action.obstacleType },
        ],
        score: state.score + clearedCount,
        nextObstacleId: state.nextObstacleId + 1,
        ticks: state.ticks + 1,
      };
    }
  }
}

function PlaneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-current">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="M19 18H6a4 4 0 0 1-.7-7.94 6.5 6.5 0 0 1 12.4-1.51A4.8 4.8 0 0 1 19 18Z" />
    </svg>
  );
}

function BirdIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="M2 17c4-1 5-7 10-8 3-.6 5 1 7 0l3-2-1 4c-1 3-4 5-8 4l-4 3-1-3c-2 1-4 2-6 2Z" />
      <circle cx="17" cy="10" r=".7" className="fill-white" />
    </svg>
  );
}

function BalloonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="M12 2a7 7 0 0 0-7 7c0 4 3.2 7.5 6.1 9.3l.9 1.2.9-1.2C15.8 16.5 19 13 19 9a7 7 0 0 0-7-7Zm0 2a5 5 0 0 1 5 5c0 2.7-2.1 5.5-5 7.6C9.1 14.5 7 11.7 7 9a5 5 0 0 1 5-5Zm-.7 16.2L12 22l.7-1.8H11.3Z" />
    </svg>
  );
}

function ObstacleIcon({ type }: { type: ObstacleType }) {
  if (type === "cloud") {
    return <CloudIcon />;
  }

  if (type === "bird") {
    return <BirdIcon />;
  }

  return <BalloonIcon />;
}

function getObstacleName(type: ObstacleType) {
  switch (type) {
    case "cloud":
      return "white cloud";
    case "bird":
      return "bird";
    case "balloon":
      return "balloon";
  }
}

function getStatusMessage(status: GameState["status"]) {
  switch (status) {
    case "ready":
      return "Ready for takeoff. Start your flight when you are ready.";
    case "running":
      return "In flight. Dodge the storm clouds.";
    case "crashed":
      return "Flight over. Take off again to start a new flight.";
  }
}

export default function PlaneGame({ signedIn = false }: { signedIn?: boolean }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [gameError, setGameError] = useState("");
  const [scoreMessage, setScoreMessage] = useState("");
  const randomRef = useRef<() => number>(() => Math.random());
  const tickRef = useRef(0);
  const inputsRef = useRef<CloudDodgerInput[]>([]);
  const runIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const speed = 1 + Math.floor(state.ticks / 8);

  useEffect(() => {
    if (state.status !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      const lane = Math.floor(randomRef.current() * BOARD_COLUMNS);
      const obstacleType =
        CLOUD_DODGER_OBSTACLES[Math.floor(randomRef.current() * CLOUD_DODGER_OBSTACLES.length)];
      tickRef.current += 1;
      dispatch({
        type: "tick",
        lane,
        obstacleType,
      });
    }, TICK_INTERVAL);

    return () => window.clearInterval(interval);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "crashed" || !signedIn || !runIdRef.current || submittedRef.current) {
      return;
    }
    submittedRef.current = true;
    setScoreMessage("Checking your score…");
    fetch(`/api/game-runs/${runIdRef.current}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickCount: state.ticks, inputs: inputsRef.current }),
    })
      .then(async (response) => {
        const result = (await response.json()) as { score?: number; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Your score could not be verified.");
        setScoreMessage(`Verified score: ${result.score}. It is now on the leaderboard.`);
      })
      .catch((error: unknown) => {
        setGameError(error instanceof Error ? error.message : "Your score could not be verified.");
        setScoreMessage("");
      });
  }, [signedIn, state.status, state.ticks]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (state.status !== "running") {
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        inputsRef.current.push({ tick: tickRef.current, direction: -1 });
        dispatch({ type: "move", direction: -1 });
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        inputsRef.current.push({ tick: tickRef.current, direction: 1 });
        dispatch({ type: "move", direction: 1 });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.status]);

  async function startFlight() {
    setGameError("");
    setScoreMessage("");
    runIdRef.current = null;
    submittedRef.current = false;
    inputsRef.current = [];
    tickRef.current = 0;

    let seed = Math.floor(Math.random() * 2_147_483_646) + 1;
    if (signedIn) {
      try {
        const response = await fetch("/api/game-runs", { method: "POST" });
        const result = (await response.json()) as { id?: string; seed?: number; error?: string };
        if (!response.ok || !result.id || typeof result.seed !== "number") {
          throw new Error(result.error ?? "Unable to start a verified game run.");
        }
        runIdRef.current = result.id;
        seed = result.seed;
      } catch (error) {
        setGameError(
          error instanceof Error ? error.message : "Unable to start a verified game run.",
        );
        return;
      }
    }

    randomRef.current = createCloudDodgerRandom(seed);
    dispatch({ type: "start" });
  }

  function steer(direction: -1 | 1) {
    if (state.status !== "running") return;
    inputsRef.current.push({ tick: tickRef.current, direction });
    dispatch({ type: "move", direction });
  }

  const obstacleByCell = new Map(
    state.obstacles.map((obstacle) => [
      `${obstacle.row}-${obstacle.lane}`,
      { id: obstacle.id, row: obstacle.row, type: obstacle.type },
    ]),
  );
  const obstacleNames = state.obstacles.map(({ type }) => getObstacleName(type));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm font-medium text-brand-dark underline-offset-4 hover:underline"
        >
          &larr; Back to JetReset
        </Link>
      </div>

      <section className="overflow-hidden rounded-xl bg-surface shadow-soft">
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-brand-dark px-6 py-8 text-white sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-200">
            JetReset Airways
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Cloud Dodger</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-sky-100 sm:text-base">
            Keep your little plane clear of the storm clouds for as long as you can.
          </p>
        </div>

        <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_15rem] md:items-center">
          <div
            role="img"
            aria-label={`Flight path. Plane in lane ${state.planeLane + 1} of ${BOARD_COLUMNS}. Flight speed ${speed}x. Obstacles approaching: ${obstacleNames.join(", ") || "none"}.${state.status === "crashed" ? " Game over." : ""}`}
            data-speed={speed}
            className={`relative mx-auto grid aspect-[7/10] w-full max-w-[19rem] grid-cols-7 grid-rows-10 overflow-hidden rounded-lg border border-slate-300 bg-gradient-to-b from-sky-100 to-sky-50 ${state.status === "crashed" ? "grayscale" : ""}`}
          >
            {Array.from({ length: BOARD_ROWS * BOARD_COLUMNS }, (_, index) => {
              const row = Math.floor(index / BOARD_COLUMNS);
              const lane = index % BOARD_COLUMNS;
              const obstacle = obstacleByCell.get(`${row}-${lane}`);
              const hasPlane = row === BOARD_ROWS - 1 && lane === state.planeLane;

              return (
                <div
                  key={index}
                  data-obstacle-row={obstacle?.row}
                  data-obstacle-type={obstacle?.type}
                  className="flex items-center justify-center border-b border-r border-sky-200/70 text-brand-dark"
                >
                  {obstacle ? (
                    <span
                      key={obstacle.id}
                      className={
                        obstacle.type === "cloud"
                          ? "text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.65)]"
                          : obstacle.type === "bird"
                            ? "text-slate-700"
                            : "text-rose-500"
                      }
                    >
                      <ObstacleIcon type={obstacle.type} />
                    </span>
                  ) : hasPlane ? (
                    <span className="text-brand">
                      <PlaneIcon />
                    </span>
                  ) : null}
                </div>
              );
            })}
            {state.status === "crashed" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/75 px-4 text-center text-white">
                <span aria-hidden="true" className="text-4xl">
                  ✕
                </span>
                <span className="text-xl font-bold uppercase tracking-wider">Flight Over!</span>
                <span className="text-sm">You dodged {state.score} obstacles</span>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-lg bg-surface-muted p-4">
              <p className="text-sm font-medium text-slate-600">Obstacles Dodged</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-surface-strong">
                {state.score}
              </p>
              <p className="mt-1 text-xs text-slate-500">Flight pace: {speed}x</p>
            </div>

            <p role="status" aria-live="polite" className="min-h-10 text-sm text-slate-600">
              {getStatusMessage(state.status)}
            </p>

            <div className="flex flex-wrap gap-3">
              {state.status === "ready" || state.status === "crashed" ? (
                <button
                  type="button"
                  onClick={() => void startFlight()}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  {state.status === "ready" ? "Start flight" : "Fly again"}
                </button>
              ) : null}
            </div>
            {signedIn ? (
              <p role="status" aria-live="polite" className="min-h-5 text-xs text-accent-dark">
                {scoreMessage}
              </p>
            ) : (
              <p className="text-xs leading-5 text-slate-500">
                Guest scores aren’t saved.{" "}
                <Link className="font-medium text-brand-dark underline" href="/account/register">
                  Create an account
                </Link>{" "}
                to submit verified scores.
              </p>
            )}
            {gameError && (
              <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger-dark">
                {gameError}
              </p>
            )}
            <Link
              href="/community"
              className="inline-flex text-sm font-medium text-brand-dark underline-offset-4 hover:underline"
            >
              View leaderboard
            </Link>

            <div className="space-y-3 border-t border-slate-200 pt-4">
              <p className="text-xs leading-5 text-slate-500">
                Use <kbd className="rounded border border-slate-300 px-1">←</kbd> /{" "}
                <kbd className="rounded border border-slate-300 px-1">→</kbd> or A / D to steer.
              </p>
              <div className="flex gap-3" aria-label="Touch flight controls">
                <button
                  type="button"
                  aria-label="Steer left"
                  disabled={state.status !== "running"}
                  onClick={() => steer(-1)}
                  className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-lg text-surface-strong hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  &larr;
                </button>
                <button
                  type="button"
                  aria-label="Steer right"
                  disabled={state.status !== "running"}
                  onClick={() => steer(1)}
                  className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-lg text-surface-strong hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
