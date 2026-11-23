import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "../test-results",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.NOCTURNA_BASE_URL ?? "http://localhost:3000",
    channel: process.env.NOCTURNA_BROWSER_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
});
