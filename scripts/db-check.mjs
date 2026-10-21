import { checkDatabaseHealth } from "../src/server/db-check.ts";

(async () => {
  try {
    const ok = await checkDatabaseHealth();
    if (!ok) {
      console.error("Database health check failed.");
      process.exit(1);
    }
    console.log("Database connectivity verified.");
    process.exit(0);
  } catch (error) {
    console.error(
      "Database health check error:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
})();

