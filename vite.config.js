import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.PUBLIC_PATH || "/",
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  build: {
    outDir: "build",
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
