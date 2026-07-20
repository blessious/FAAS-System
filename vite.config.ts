import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 8081,

    // Allow access through Apache/Laragon virtual host
    allowedHosts: [
      "faas.icts.net",
      "localhost",
      "192.168.0.18"
    ],

    hmr: {
      host: "192.168.0.18",
      port: 8081,
      protocol: "ws",
    },
  },

  plugins: [
    react(),
    mode === "development" && componentTagger()
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));