import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import * as v from "valibot";

import { validate } from "../validate";
import { errorHandler } from "../../middleware/error.handler";

const Body = v.object({
  email: v.pipe(v.string(), v.email("Enter a valid email")),
  profile: v.object({ age: v.pipe(v.number(), v.minValue(18, "Must be an adult")) }),
});

const app = new Hono();
app.post("/json", validate("json", Body), (c) => c.json({ got: c.req.valid("json") }));
app.get("/query", validate("query", v.object({ page: v.pipe(v.string(), v.regex(/^\d+$/, "page must be a number")) })), (c) =>
  c.json({ got: c.req.valid("query") }),
);
app.onError(errorHandler);

const post = (body: unknown) =>
  app.request("/json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("validate", () => {
  it("passes valid input through, typed, to the handler", async () => {
    const res = await post({ email: "a@b.io", profile: { age: 30 } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ got: { email: "a@b.io", profile: { age: 30 } } });
  });

  it("answers invalid input with the API's 400 shape: first problem as the message, all problems as issues", async () => {
    const res = await post({ email: "nope", profile: { age: 5 } });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      status: "ERROR",
      code: "VALIDATION_FAILED",
      message: "Enter a valid email",
      issues: [
        { path: "email", message: "Enter a valid email" },
        { path: "profile.age", message: "Must be an adult" },
      ],
    });
  });

  it("reports a missing field with its path", async () => {
    const res = await post({ profile: { age: 30 } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.issues.map((i: { path: string }) => i.path)).toEqual(["email"]);
  });

  it("validates the query string too", async () => {
    const bad = await app.request("/query?page=abc");
    const good = await app.request("/query?page=3");

    expect(bad.status).toBe(400);
    expect((await bad.json()).message).toBe("page must be a number");
    expect(good.status).toBe(200);
  });

  it("answers malformed JSON as a JSON 400 as well", async () => {
    const res = await app.request("/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: "ERROR" });
  });
});
