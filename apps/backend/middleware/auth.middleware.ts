import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import { HTTPException } from "hono/http-exception";

interface CustomJWTPayload {
  sub: string;
  email: string;
}

type Env = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

const JWT_SECRET_STRING = process.env.JWT_SECRET;

if (!JWT_SECRET_STRING) {
  throw new Error("❌ JWT_SECRET is not defined in environment variables.");
}

const encodedSecret = new TextEncoder().encode(JWT_SECRET_STRING);

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, {
      message: "MISSING_COORDINATES: Authorization required",
    });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new HTTPException(401, {
      message: "MISSING_COORDINATES: Authorization required",
    });
  }

  try {
    const { payload } = await jwtVerify(token, encodedSecret);

    const userPayload = payload as unknown as CustomJWTPayload;

    if (!userPayload.sub || !userPayload.email) {
      throw new Error("Incomplete payload");
    }

    c.set("userId", userPayload.sub);
    c.set("userEmail", userPayload.email);

    await next();
  } catch (error) {
    console.error("[Auth] Token validation failed:", error);
    throw new HTTPException(401, {
      message: "SIGNAL_LOST: Invalid or expired session",
    });
  }
});
