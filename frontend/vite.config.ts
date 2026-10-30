import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  // Serve repo-root assets/ as the public directory so paths like
  // /backgrounds/room/room_preview.png work without any prefix.
  publicDir: resolve(__dirname, "../assets"),

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  build: {
    outDir: "dist",
    target: "es2022",
  },

  server: {
    port: 5173,
    open: true,
  },
});
