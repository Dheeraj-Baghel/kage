import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// npm 1.2.0 provides the exact HTML/assets, but its compiled frame predates the
// registered source bundle. Resolve the configured imports to the verified
// source snapshot instead of silently substituting that older implementation.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@designcodeio/threeui/style.css",
        replacement: fileURLToPath(new URL("./vendor/threeui/src/shaders/threeui.css", import.meta.url)),
      },
      {
        find: /^@designcodeio\/threeui$/,
        replacement: fileURLToPath(new URL("./vendor/threeui/KageEntry.tsx", import.meta.url)),
      },
    ],
  },
  server: { host: "127.0.0.1", port: 4329, strictPort: true },
  preview: { host: "127.0.0.1", port: 4329, strictPort: true },
});
