import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  root: resolve(__dirname),
  build: {
    outDir: "dist-preview",
  },
  server: {
    port: 5179,
    open: "/preview.html",
  },
});
