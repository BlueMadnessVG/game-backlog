import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export const errorHandler = async (err: Error, c: Context) => {
  console.error(`[SERVER ERROR]: ${err.message}`);

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  if (err.name === "ValidError") {
    return c.json(
      {
        error: "Validation Failed",
        details: err,
      },
      400,
    );
  }

  return c.json({
    error: "Internal Command Center Failure",
    message:
      process.env.VITE_APP_ENV === "development"
        ? err.message
        : "Unknown Error",
  });
};
