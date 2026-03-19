import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      include: [
        "src/lib/db-client.ts",
        "src/services/bgg-client.ts",
        "src/components/QuickFilters.tsx",
        "src/components/RandomPicker.tsx",
      ],
    },
  },
});
