import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: (origin) => {
    if (origin.startsWith("http://localhost:")) {
      return origin;
    }

    if (
      origin === "tauri://localhost" ||
      origin === "http://tauri.localhost" ||
      origin.startsWith("ipc://")
    ) {
      return origin;
    }

    return null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Request-With"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
});
