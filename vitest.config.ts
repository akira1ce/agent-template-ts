import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@core": path.resolve(__dirname, "./src/core"),
      "@tools": path.resolve(__dirname, "./src/tools"),
      "@agents": path.resolve(__dirname, "./src/agents"),
    },
  },
});
