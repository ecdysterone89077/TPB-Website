import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": "/src" } },
  server: {
    port: 5173,
    // Teruskan /media dan /v1 ke API lokal agar URL relatif hasil upload tampil saat dev.
    // Produksi: atur proxy yang sama di nginx aaPanel (/media/ dan /v1/ -> 127.0.0.1:3000).
    proxy: {
      "/media": "http://127.0.0.1:3000",
      "/v1": "http://127.0.0.1:3000",
    },
  },
});
