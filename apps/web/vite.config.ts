import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, "../..", ""));
  return {
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [tanstackStart({ srcDirectory: "src" }), viteReact(), netlify()], //nitro()],
  };
});
