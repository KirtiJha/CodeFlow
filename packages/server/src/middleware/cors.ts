import { createMiddleware } from "hono/factory";

export function corsMiddleware() {
  return createMiddleware(async (c, next) => {
    // Set CORS headers
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    c.header("Access-Control-Max-Age", "86400");

    // Handle preflight
    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  });
}
