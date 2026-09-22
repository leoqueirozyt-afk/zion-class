import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/lib/**/*.test.ts",
            "tests/validation/**/*.test.ts",
            "tests/actions/**/*.test.ts",
            "tests/utils/**/*.test.ts",
          ],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["tests/setup-jsdom.ts"],
        },
      },
    ],
  },
});
