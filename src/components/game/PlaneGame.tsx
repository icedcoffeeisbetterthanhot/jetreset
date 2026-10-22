"use client";

import Link from "next/link";
import React from "react";
import { useEffect, useReducer, useRef, useState } from "react";
import { createCloudDodgerRandom, type CloudDodgerInput } from "@lib/cloudDodger";

const BOARD_COLUMNS = 7;
const BOARD_ROWS = 10;
const TICK_INTERVAL = 700;
const TICKS_PER_SPEED_INCREASE = 12;
const LEVEL_ONE_TARGET = 10;
const OBSTACLE_TARGET_INCREASE = 50;
const LEVEL_ONE_OBSTACLES = ["cloud", "bird", "balloon"] as const;
const LEVEL_TWO_OBSTACLES = ["star", "planet", "meteor"] as const;
const LEVEL_THREE_OBSTACLES = ["seaweed", "fish", "mine"] as const;
const LEVEL_FOUR_OBSTACLES = ["snowball", "penguin", "iceberg"] as const;

type ObstacleType =
  | (typeof LEVEL_ONE_OBSTACLES)[number]
  | (typeof LEVEL_TWO_OBSTACLES)[number]
  | (typeof LEVEL_THREE_OBSTACLES)[number]
  | (typeof LEVEL_FOUR_OBSTACLES)[number];
type Level = 1 | 2 | 3 | 4;

type Obstacle = {
  id: number;
  lane: number;
  row: number;
  type: ObstacleType;
};

type GameState = {
  status: "ready" | "running" | "crashed" | "level-complete" | "game-complete";
  level: Level;
  planeLane: number;
  obstacles: Obstacle[];
  score: number;
  nextObstacleId: number;
  ticks: number;
};

type GameAction =
  | { type: "start" }
  | { type: "advance-level" }
  | { type: "move"; direction: -1 | 1 }
  | { type: "tick"; obstacles: { lane: number; type: ObstacleType }[] };

const initialState: GameState = {
  status: "ready",
  level: 1,
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
    case "advance-level":
      if (state.status !== "level-complete") {
        return state;
      }

      if (state.level === 1) {
        return { ...initialState, level: 2, status: "running" };
      }

      if (state.level === 2) {
        return { ...initialState, level: 3, status: "running" };
      }

      if (state.level === 3) {
        return { ...initialState, level: 4, status: "running" };
      }

      return state;
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

      const movedObstacles = state.obstacles.map((obstacle) => ({
        ...obstacle,
        row: obstacle.row + 1,
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
      const score = state.score + clearedCount;
      const levelComplete = score >= getLevelTarget(state.level);
      const status = crashed
        ? "crashed"
        : levelComplete
          ? state.level === 4
            ? "game-complete"
            : "level-complete"
          : "running";

      return {
        ...state,
        status,
        obstacles: [
          ...movedObstacles.filter((obstacle) => obstacle.row < BOARD_ROWS - 1),
          ...(!crashed && !levelComplete
            ? action.obstacles.map((obstacle, index) => ({
                id: state.nextObstacleId + index,
                lane: obstacle.lane,
                row: 0,
                type: obstacle.type,
              }))
            : []),
        ],
        score: levelComplete ? getLevelTarget(state.level) : score,
        nextObstacleId:
          state.nextObstacleId + (crashed || levelComplete ? 0 : action.obstacles.length),
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

function StarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="m12 2 2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 16.2l-5.8 3.4 1.5-6.5-5-4.4 6.6-.6L12 2Z" />
    </svg>
  );
}

function PlanetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <circle cx="12" cy="12" r="6.5" />
      <path
        d="M3 15c4 2 14-7 18-5M5 18c4 2 12-5 15-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MeteorIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="M18.7 3.2a4.5 4.5 0 0 0-5.1 1L7 10.8a4.5 4.5 0 1 0 6.3 6.3l6.6-6.6a4.5 4.5 0 0 0-1.2-7.3ZM5 5l5 1-2-3-3 2ZM3 9l4 1-2-3-2 2Z" />
      <circle cx="14.5" cy="9.5" r="1" className="fill-white" />
    </svg>
  );
}

function SpaceshipIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-current">
      <path d="M12 2c4 2.5 6 6.5 6 12l-6 5-6-5c0-5.5 2-9.5 6-12Z" />
      <circle cx="12" cy="10" r="2" className="fill-sky-200" />
      <path d="m7 15-3 4 5-1m8-3 3 4-5-1M10 19l2 3 2-3" />
    </svg>
  );
}

function SubmarineIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-current">
      <path d="M3 13a2 2 0 0 1 2-2h2V8a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v2h-2v2h-2v-2H8v2H6v-2H4a1 1 0 0 1-1-1v-1Z" />
      <circle cx="11" cy="9" r="1" className="fill-teal-950" />
      <circle cx="14" cy="9" r="1" className="fill-teal-950" />
      <path
        d="M2 19c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 2-.7 3 0 2 .7 3 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SeaweedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="M11 22c1-5-2-7-1-11s4-5 3-9c4 4 1 8 0 10s2 4 1 10h-3Zm-5 0c1-4-2-5-2-8 0-2 2-3 1-5 4 3 2 6 2 8s2 3 2 5H6Zm9 0c0-4 3-5 2-9 3 2 3 5 1 9h-3Z" />
    </svg>
  );
}

function FishIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="M2 12s4-6 11-6c3 0 5 2 7 4l3-2v8l-3-2c-2 2-4 4-7 4-7 0-11-6-11-6Z" />
      <circle cx="15" cy="10" r="1" className="fill-cyan-950" />
    </svg>
  );
}

function MineIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="m12 2 2 3 4-1-1 4 4 2-3 3 2 4-4-1-2 5-3-4-4 2 1-5-4-2 4-3-1-4 4 1 1-4Z" />
      <circle cx="12" cy="12" r="3" className="fill-current" />
    </svg>
  );
}

function SnowballIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <circle cx="12" cy="12" r="8" />
      <path
        d="M7 10c2 1 3-2 5-1s3 2 5 1M8 15c2-1 3 1 5 1s2-2 4-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PenguinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <ellipse cx="12" cy="13" rx="7" ry="9" />
      <ellipse cx="12" cy="14" rx="4" ry="6" className="fill-slate-100" />
      <circle cx="10" cy="8" r=".8" className="fill-white" />
      <circle cx="14" cy="8" r=".8" className="fill-white" />
      <path d="m11 10 1 1 1-1Z" className="fill-orange-400" />
    </svg>
  );
}

function IcebergIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-current">
      <path d="m2 20 5-13 3 5 3-9 3 8 3-4 3 13H2Z" />
      <path d="m7 13 3 2 3-4 3 3 3-1 2 7H4l3-7Z" className="fill-sky-200" />
    </svg>
  );
}

function SnowmobileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7 fill-current">
      <path d="M4 13h10l3 3h4v2h-5l-3-3H8l-2 3H3v-2h2l2-3H4v-2Zm5-2 2-5h4l3 5h-3l-2-3-1 3H9Z" />
      <circle cx="7" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </svg>
  );
}

function ObstacleIcon({ type }: { type: ObstacleType }) {
  switch (type) {
    case "cloud":
      return <CloudIcon />;
    case "bird":
      return <BirdIcon />;
    case "balloon":
      return <BalloonIcon />;
    case "star":
      return <StarIcon />;
    case "planet":
      return <PlanetIcon />;
    case "meteor":
      return <MeteorIcon />;
    case "seaweed":
      return <SeaweedIcon />;
    case "fish":
      return <FishIcon />;
    case "mine":
      return <MineIcon />;
    case "snowball":
      return <SnowballIcon />;
    case "penguin":
      return <PenguinIcon />;
    case "iceberg":
      return <IcebergIcon />;
  }
}

function getObstacleName(type: ObstacleType) {
  switch (type) {
    case "cloud":
      return "white cloud";
    case "bird":
      return "bird";
    case "balloon":
      return "balloon";
    case "star":
      return "star";
    case "planet":
      return "planet";
    case "meteor":
      return "meteor";
    case "seaweed":
      return "seaweed";
    case "fish":
      return "fish";
    case "mine":
      return "sea mine";
    case "snowball":
      return "snowball";
    case "penguin":
      return "penguin";
    case "iceberg":
      return "iceberg";
  }
}

function getLevelTarget(level: Level) {
  return LEVEL_ONE_TARGET + (level - 1) * OBSTACLE_TARGET_INCREASE;
}

function getStatusMessage(status: GameState["status"], level: Level) {
  switch (status) {
    case "ready":
      return "Ready for takeoff. Start your flight when you are ready.";
    case "running":
      return level === 3
        ? "Underwater. Dodge the hazards."
        : level === 4
          ? "On the ice. Dodge the arctic hazards."
          : "In flight. Dodge the obstacles.";
    case "crashed":
      return "Flight over. Restart to return to level 1.";
    case "level-complete":
      return `Level ${level} complete! You dodged every obstacle.`;
    case "game-complete":
      return "You completed every level! The whole journey is yours.";
  }
}

function Confetti() {
  const colors = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7"];

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 36 }, (_, index) => (
        <span
          key={index}
          className="game-confetti-piece absolute top-[-1rem] h-3 w-2 rounded-sm"
          style={{
            left: `${(index * 37) % 100}%`,
            backgroundColor: colors[index % colors.length],
            animationDelay: `${(index % 12) * 90}ms`,
            transform: `rotate(${index * 29}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function PlaneGame({ signedIn = false }: { signedIn?: boolean }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [scoreMessage, setScoreMessage] = useState("");
  const [gameError, setGameError] = useState("");
  const inputsRef = useRef<CloudDodgerInput[]>([]);
  const tickRef = useRef(0);
  const runIdRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const randomRef = useRef(Math.random);
  const speed = 1 + Math.floor(state.ticks / TICKS_PER_SPEED_INCREASE);
  const obstacleTypes =
    state.level === 1
      ? LEVEL_ONE_OBSTACLES
      : state.level === 2
        ? LEVEL_TWO_OBSTACLES
        : state.level === 3
          ? LEVEL_THREE_OBSTACLES
          : LEVEL_FOUR_OBSTACLES;
  const isSpaceLevel = state.level === 2;
  const isOceanLevel = state.level === 3;
  const isArcticLevel = state.level === 4;

  useEffect(() => {
    if (state.status !== "running") {
      return;
    }

    const obstacleCount = Math.min(3, 1 + Math.floor((speed - 1) / 2));
    const interval = window.setInterval(() => {
      tickRef.current += 1;
      const lanes: number[] = [];
      while (lanes.length < obstacleCount) {
        let lane = Math.floor(Math.random() * BOARD_COLUMNS);
        while (lanes.includes(lane)) {
          lane = (lane + 1) % BOARD_COLUMNS;
        }
        lanes.push(lane);
      }

      dispatch({
        type: "tick",
        obstacles: lanes.map((lane) => ({
          lane,
          type: obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)],
        })),
      });
    }, TICK_INTERVAL);

    return () => window.clearInterval(interval);
  }, [state.level, state.status, speed]);

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

      {(state.status === "level-complete" || state.status === "game-complete") && <Confetti />}

      <section
        className={`overflow-hidden rounded-xl shadow-soft ${
          isSpaceLevel
            ? "bg-slate-950 text-white"
            : isOceanLevel
              ? "bg-cyan-950 text-white"
              : isArcticLevel
                ? "bg-slate-100 text-slate-900"
                : "bg-surface"
        }`}
      >
        <div
          className={`px-6 py-8 text-white sm:px-10 ${
            isSpaceLevel
              ? "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900"
              : isOceanLevel
                ? "bg-gradient-to-br from-cyan-950 via-teal-900 to-blue-950"
                : isArcticLevel
                  ? "bg-gradient-to-br from-slate-700 via-sky-800 to-blue-950"
                  : "bg-gradient-to-br from-slate-900 via-blue-950 to-brand-dark"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-200">
            JetReset{" "}
            {isSpaceLevel
              ? "spaceways"
              : isOceanLevel
                ? "deep sea"
                : isArcticLevel
                  ? "arctic expedition"
                  : "airways"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {isSpaceLevel
              ? "Cosmic Dodger"
              : isOceanLevel
                ? "Reef Runner"
                : isArcticLevel
                  ? "Arctic Dash"
                  : "Cloud Dodger"}
          </h1>
          <p className="mt-2 text-sm font-medium text-sky-200">
            Level {state.level}
            {state.status !== "game-complete"
              ? ` · ${state.score}/${getLevelTarget(state.level)} obstacles`
              : " · Journey complete"}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-sky-100 sm:text-base">
            {isSpaceLevel
              ? "Take your spaceship into the dark and steer clear of stars, planets, and meteors."
              : isOceanLevel
                ? "Pilot a submarine through glowing reefs, curious fish, and sea mines."
                : isArcticLevel
                  ? "Ride a snowmobile across the ice and dodge snowballs, penguins, and icebergs."
                  : "Keep your little plane clear of the clouds, birds, and balloons."}
          </p>
        </div>

        <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_15rem] md:items-center">
          <div
            role="img"
            aria-label={`${isSpaceLevel ? "Space flight" : isOceanLevel ? "Ocean run" : isArcticLevel ? "Arctic run" : "Flight path"}. ${isSpaceLevel ? "Spaceship" : isOceanLevel ? "Submarine" : isArcticLevel ? "Snowmobile" : "Plane"} in lane ${state.planeLane + 1} of ${BOARD_COLUMNS}. Flight speed ${speed}x. Obstacles approaching: ${obstacleNames.join(", ") || "none"}.${state.status === "crashed" ? " Game over." : ""}${state.status === "level-complete" ? " Level complete." : ""}${state.status === "game-complete" ? " Game complete." : ""}`}
            data-speed={speed}
            data-level={state.level}
            className={`relative mx-auto grid aspect-[7/10] w-full max-w-[19rem] grid-cols-7 grid-rows-10 overflow-hidden rounded-lg border ${
              isArcticLevel
                ? "border-sky-300 bg-gradient-to-b from-sky-100 via-blue-100 to-white"
                : isOceanLevel
                  ? "border-cyan-700 bg-gradient-to-b from-cyan-950 via-teal-950 to-blue-950"
                  : isSpaceLevel
                    ? "border-slate-700 bg-gradient-to-b from-slate-950 via-blue-950 to-black"
                    : "border-slate-300 bg-gradient-to-b from-sky-100 to-sky-50"
            }`}
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
                  className={`flex items-center justify-center border-b border-r ${
                    isArcticLevel
                      ? "border-sky-200 text-slate-700"
                      : isOceanLevel
                        ? "border-cyan-800/80 text-cyan-50"
                        : isSpaceLevel
                          ? "border-slate-700/80 text-slate-100"
                          : "border-sky-200/70 text-brand-dark"
                  }`}
                >
                  {obstacle ? (
                    <span
                      key={obstacle.id}
                      className={
                        obstacle.type === "cloud"
                          ? "text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.65)]"
                          : obstacle.type === "bird"
                            ? "text-slate-700"
                            : obstacle.type === "balloon"
                              ? "text-rose-500"
                              : obstacle.type === "star"
                                ? "text-yellow-300"
                                : obstacle.type === "planet"
                                  ? "text-fuchsia-400"
                                  : obstacle.type === "meteor"
                                    ? "text-orange-400"
                                    : obstacle.type === "seaweed"
                                      ? "text-emerald-400"
                                      : obstacle.type === "fish"
                                        ? "text-cyan-300"
                                        : obstacle.type === "mine"
                                          ? "text-rose-400"
                                          : obstacle.type === "snowball"
                                            ? "text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.65)]"
                                            : obstacle.type === "penguin"
                                              ? "text-slate-800"
                                              : obstacle.type === "iceberg"
                                                ? "text-sky-500"
                                                : "text-rose-400"
                      }
                    >
                      <ObstacleIcon type={obstacle.type} />
                    </span>
                  ) : hasPlane ? (
                    <span
                      className={
                        isArcticLevel
                          ? "text-sky-700"
                          : isOceanLevel
                            ? "text-teal-300"
                            : isSpaceLevel
                              ? "text-sky-300"
                              : "text-brand"
                      }
                    >
                      {isSpaceLevel ? (
                        <SpaceshipIcon />
                      ) : isOceanLevel ? (
                        <SubmarineIcon />
                      ) : isArcticLevel ? (
                        <SnowmobileIcon />
                      ) : (
                        <PlaneIcon />
                      )}
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
                <span className="text-xl font-bold uppercase tracking-wider">
                  {isOceanLevel
                    ? "Dive over!"
                    : isArcticLevel
                      ? "Expedition over!"
                      : "Flight over!"}
                </span>
                <span className="text-sm">You dodged {state.score} obstacles</span>
              </div>
            )}
            {(state.status === "level-complete" || state.status === "game-complete") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-emerald-950/95 to-blue-950/95 px-4 text-center text-white">
                <span aria-hidden="true" className="text-5xl">
                  ★
                </span>
                <span className="text-2xl font-bold uppercase tracking-wider">
                  {state.status === "game-complete"
                    ? "Journey complete!"
                    : `Level ${state.level} complete!`}
                </span>
                <span className="text-sm">
                  You cleared all {getLevelTarget(state.level)} obstacles.
                </span>
              </div>
            )}
          </div>

          <div
            className={`space-y-5 ${
              isSpaceLevel || isOceanLevel || isArcticLevel ? "text-slate-100" : ""
            }`}
          >
            <div
              className={`rounded-lg p-4 ${
                isArcticLevel
                  ? "bg-sky-900"
                  : isOceanLevel
                    ? "bg-cyan-900"
                    : isSpaceLevel
                      ? "bg-slate-800"
                      : "bg-surface-muted"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  isSpaceLevel || isOceanLevel || isArcticLevel
                    ? "text-slate-300"
                    : "text-slate-600"
                }`}
              >
                Obstacles Dodged
              </p>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums ${
                  isSpaceLevel || isOceanLevel || isArcticLevel
                    ? "text-white"
                    : "text-surface-strong"
                }`}
              >
                {state.score}
              </p>
              <p
                className={`mt-1 text-xs ${
                  isSpaceLevel || isOceanLevel || isArcticLevel
                    ? "text-slate-300"
                    : "text-slate-500"
                }`}
              >
                Flight pace: {speed}x
              </p>
            </div>

            <p
              role="status"
              aria-live="polite"
              className={`min-h-10 text-sm ${
                isSpaceLevel || isOceanLevel || isArcticLevel ? "text-slate-200" : "text-slate-600"
              }`}
            >
              {getStatusMessage(state.status, state.level)}
            </p>

            <div className="flex flex-wrap gap-3">
              {state.status === "ready" ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "start" })}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Start flight
                </button>
              ) : state.status === "crashed" ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "start" })}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Restart from level 1
                </button>
              ) : state.status === "level-complete" ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: "advance-level" })}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  {`Launch level ${state.level + 1}`}
                </button>
              ) : state.status === "game-complete" ? (
                <button
                  type="button"
                  onClick={() => void startFlight()}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Play again
                </button>
              ) : null}
            </div>
            {signedIn ? (
              <p
                role="status"
                aria-label="Score submission status"
                aria-live="polite"
                className="min-h-5 text-xs text-accent-dark"
              >
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

            <div
              className={`space-y-3 border-t pt-4 ${
                isArcticLevel
                  ? "border-sky-800"
                  : isOceanLevel
                    ? "border-cyan-800"
                    : isSpaceLevel
                      ? "border-slate-700"
                      : "border-slate-200"
              }`}
            >
              <p
                className={`text-xs leading-5 ${
                  isArcticLevel
                    ? "text-slate-700"
                    : isSpaceLevel || isOceanLevel
                      ? "text-slate-300"
                      : "text-slate-500"
                }`}
              >
                Use <kbd className="rounded border border-slate-300 px-1">←</kbd> /{" "}
                <kbd className="rounded border border-slate-300 px-1">→</kbd> or A / D to steer.
              </p>
              <div className="flex gap-3" aria-label="Touch flight controls">
                <button
                  type="button"
                  aria-label="Steer left"
                  disabled={state.status !== "running"}
                  onClick={() => steer(-1)}
                  className={`flex-1 rounded-md border px-4 py-2 text-lg disabled:cursor-not-allowed disabled:opacity-50 ${
                    isArcticLevel
                      ? "border-sky-700 text-white hover:bg-sky-900"
                      : isOceanLevel
                        ? "border-cyan-700 text-white hover:bg-cyan-900"
                        : isSpaceLevel
                          ? "border-slate-600 text-white hover:bg-slate-800"
                          : "border-slate-300 text-surface-strong hover:bg-surface-muted"
                  }`}
                >
                  &larr;
                </button>
                <button
                  type="button"
                  aria-label="Steer right"
                  disabled={state.status !== "running"}
                  onClick={() => steer(1)}
                  className={`flex-1 rounded-md border px-4 py-2 text-lg disabled:cursor-not-allowed disabled:opacity-50 ${
                    isArcticLevel
                      ? "border-sky-700 text-white hover:bg-sky-900"
                      : isOceanLevel
                        ? "border-cyan-700 text-white hover:bg-cyan-900"
                        : isSpaceLevel
                          ? "border-slate-600 text-white hover:bg-slate-800"
                          : "border-slate-300 text-surface-strong hover:bg-surface-muted"
                  }`}
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
