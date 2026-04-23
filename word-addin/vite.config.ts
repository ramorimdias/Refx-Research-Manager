import { defineConfig } from "vite";
import { getHttpsServerOptions } from "office-addin-dev-certs";

const httpsOptions = await getHttpsServerOptions(365);

export default defineConfig({
  server: {
    host: "localhost",
    port: 5174,
    https: httpsOptions,
  },
  preview: {
    host: "localhost",
    port: 5174,
    https: httpsOptions,
  },
});
