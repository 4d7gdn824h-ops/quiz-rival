import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3210",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "node e2e/serve.mjs",
    url: "http://127.0.0.1:3210",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
