import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  use: { baseURL: process.env.TROY_TEST_URL ?? "http://127.0.0.1:3213", trace: "retain-on-failure" },
  webServer: process.env.TROY_TEST_URL ? undefined : {
    command: "npm run dev -- --port 3213",
    url: "http://127.0.0.1:3213",
    reuseExistingServer: !process.env.CI,
  },
});
