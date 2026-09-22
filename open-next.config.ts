import { defineCloudflareConfig, type OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  ...defineCloudflareConfig(),
  buildCommand: "npx next build",
};

export default config;
