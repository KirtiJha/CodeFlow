import { createMiddleware } from "hono/factory";

export function validationMiddleware() {
  return createMiddleware(async (c, next) => {
    // Validate content-type for POST/PUT requests
    if (c.req.method === "POST" || c.req.method === "PUT") {
      const contentType = c.req.header("content-type");
      if (contentType && !contentType.includes("application/json")) {
        return c.json({ error: "Content-Type must be application/json" }, 415);
      }
    }

    await next();
  });
}
