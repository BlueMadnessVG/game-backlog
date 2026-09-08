import { cors } from "hono/cors";

export const corsMiddleware = cors({
  origin: (origin) => {
    const normalized = origin.toLowerCase();

    if (normalized.startsWith("http://localhost:")) {
      return origin;
    }

    if (
      normalized === "tauri://localhost" ||
      normalized === "http://tauri.localhost" ||
      normalized.startsWith("ipc://")
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
