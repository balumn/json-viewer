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
      includeAssets: ["favicon.svg", "icon.svg", "og-image.svg", "robots.txt", "sitemap.xml"],
      manifest: {
        name: "JSON Formatter & Viewer",
        short_name: "JSON Formatter",
        description:
          "Free online JSON Formatter & JSON Viewer. Beautify, validate, and search JSON locally in your browser. Simple and easy to use.",
        theme_color: "#0b0f17",
        background_color: "#ffffff",
        display: "standalone",
        // Relative path so it works under GitHub Pages base path (/<repo>/)
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        // Relative so fallback stays within the service worker scope (incl. GitHub Pages base path)
        navigateFallback: "index.html"
      }
    })
  ]
});


