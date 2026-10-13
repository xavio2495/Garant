import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

// Pull only the variables the web app needs from the workspace .env, so other
// secrets in that file never reach this process.
const rootEnv = join(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) {
  for (const [k, v] of Object.entries(parseEnv(readFileSync(rootEnv, "utf8")))) {
    if (/^(NEXT_PUBLIC_|PARTNER_)|^TESTER_PRIVATE_KEY$/.test(k) && process.env[k] === undefined) process.env[k] = v;
  }
}

const nextConfig: NextConfig = {
  agentRules: false,
  async redirects() {
    return [
      { source: "/app", destination: "/app/cover", permanent: false },
      { source: "/cover", destination: "/app/cover", permanent: false },
      { source: "/underwrite", destination: "/app/underwrite", permanent: false },
      { source: "/dashboard", destination: "/app/dashboard", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
