// Node: engine, protocol and client models
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "web/src/**/*.test.ts"],
    exclude: ["test/server/**", "**/node_modules/**"],
  },
});
