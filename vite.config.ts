import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = repoName ? `/${repoName}/` : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "json-viewer",
        short_name: "json-viewer",
        description: "Content-aware formatter for JSON, XML, and code snippets.",
        theme_color: "#0b0f17",
        background_color: "#ffffff",
        display: "standalone",
        // Relative path so it works under GitHub Pages base path (/<repo>/)
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      workbox: {
        // Relative so fallback stays within the service worker scope (incl. GitHub Pages base path)
        navigateFallback: "index.html"
      }
    })
  ]
});


