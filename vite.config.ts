import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
    rollupOptions: {
      // Multi-page build: the app plus the two standalone legal pages, which
      // Cloudflare serves at /impressum and /datenschutz (html_handling maps the
      // extensionless path to the .html file).
      input: {
        main: resolve(__dirname, "index.html"),
        impressum: resolve(__dirname, "impressum.html"),
        datenschutz: resolve(__dirname, "datenschutz.html"),
      },
    },
  },
});
