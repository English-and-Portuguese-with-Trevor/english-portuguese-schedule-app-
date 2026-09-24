import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Server code runs in UTC on Vercel; default tests to that so timezone bugs
// that only show up there are caught locally. Files needing a viewer
// timezone set process.env.TZ themselves — `forks` isolates each file's
// process so that doesn't leak.
process.env.TZ = "UTC";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    pool: "forks",
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
