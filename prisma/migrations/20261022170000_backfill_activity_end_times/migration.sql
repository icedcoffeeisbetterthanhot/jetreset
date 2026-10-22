-- Backfill end times for activities created before "endsAt" existed, using the
-- same durations the recovery-plan engine now assigns. Wall-clock arithmetic is
-- done in each activity's own time zone, so daylight-saving changes are handled.
-- Activity start times, completion records, and keys are otherwise unchanged.

WITH "local" AS (
  SELECT
    a."id",
    a."title",
    a."timeZone",
    (a."scheduledAt" AT TIME ZONE 'UTC') AT TIME ZONE a."timeZone" AS start_local,
    p."targetWakeTime"::time AS wake,
    p."targetBedtime"::time AS bedtime
  FROM "RecoveryActivity" a
  JOIN "RecoveryPlan" p ON p."id" = a."planId"
  WHERE a."endsAt" IS NULL
),
"ends" AS (
  SELECT
    "id",
    "timeZone",
    CASE "title"
      WHEN 'Keep your usual sleep routine' THEN start_local + interval '30 minutes'
      WHEN 'Target wake time' THEN start_local + interval '30 minutes'
      WHEN 'Breakfast' THEN start_local + interval '30 minutes'
      WHEN 'Get outdoor daylight when practical' THEN start_local + interval '30 minutes'
      WHEN 'Pause for water' THEN start_local + interval '10 minutes'
      WHEN 'Water break' THEN start_local + interval '10 minutes'
      WHEN 'Lunch' THEN start_local + interval '45 minutes'
      WHEN 'Gentle movement' THEN start_local + interval '30 minutes'
      WHEN 'Evening meal' THEN start_local + interval '60 minutes'
      -- Wind-down and caffeine-free periods run until bedtime when it is later that day.
      WHEN 'Keep a calm, dimmer evening' THEN
        CASE WHEN bedtime > start_local::time THEN date_trunc('day', start_local) + bedtime
             ELSE start_local + interval '60 minutes' END
      WHEN 'Caffeine-free afternoon' THEN
        CASE WHEN bedtime > start_local::time THEN date_trunc('day', start_local) + bedtime
             ELSE start_local + interval '60 minutes' END
      -- Overnight sleep runs until the next morning's wake-time target.
      WHEN 'Target bedtime' THEN date_trunc('day', start_local) + interval '1 day' + wake
    END AS end_local
  FROM "local"
)
UPDATE "RecoveryActivity" a
SET "endsAt" = (e.end_local AT TIME ZONE e."timeZone") AT TIME ZONE 'UTC'
FROM "ends" e
WHERE a."id" = e."id" AND e.end_local IS NOT NULL;

-- The old caffeine item marked a 14:00 cut-off point. Present it as the window the
-- engine now generates: from the plan's wake-time target until that cut-off.
UPDATE "RecoveryActivity" a
SET
  "title" = 'Caffeine window, if you use it',
  "guidance" = 'If you already use caffeine and it is appropriate for you, consider keeping it within this window so it is less likely to interfere with sleep. This is not a dose recommendation; skip it if you have been advised to avoid caffeine.',
  "endsAt" = a."scheduledAt",
  "scheduledAt" = (
    (date_trunc('day', (a."scheduledAt" AT TIME ZONE 'UTC') AT TIME ZONE a."timeZone")
      + p."targetWakeTime"::time)
    AT TIME ZONE a."timeZone"
  ) AT TIME ZONE 'UTC'
FROM "RecoveryPlan" p
WHERE p."id" = a."planId"
  AND a."endsAt" IS NULL
  AND a."title" = 'Keep caffeine early, if you use it'
  AND p."targetWakeTime"::time < ((a."scheduledAt" AT TIME ZONE 'UTC') AT TIME ZONE a."timeZone")::time;
