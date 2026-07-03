import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@openmotion/shared"],
  },
  server: {
    port: 4000,
    proxy: {
      "/api": {
        target: "http://localhost:7000",
        changeOrigin: true,
      },
    },
  },
});
