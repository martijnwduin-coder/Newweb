import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Live mode when Supabase env vars are set (e.g. .env.local after `npm run db:start`), demo mode otherwise.
loadEnvConfig(process.cwd());
export const LIVE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", viewport: { width: 1440, height: 900 } },
  projects: [{ name: LIVE ? "live" : "demo", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
