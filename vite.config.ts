import { defineConfig } from "vite";

export default defineConfig({
  base: "/Pentaspace/",
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2022",
  },
});
