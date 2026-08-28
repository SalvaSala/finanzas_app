/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo, Vite reenvía las llamadas a /api hacia el backend FastAPI.
// En producción, FastAPI sirve estos estáticos compilados y la API bajo /api
// desde el mismo origen, por lo que no hace falta CORS.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    // Los flujos con Radix + userEvent sobre jsdom son lentos.
    testTimeout: 20000,
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Tipos generados, punto de entrada y los propios tests no cuentan.
      exclude: ["src/api/schema.d.ts", "src/main.tsx", "src/test/**", "src/**/*.test.{ts,tsx}"],
    },
  },
});
