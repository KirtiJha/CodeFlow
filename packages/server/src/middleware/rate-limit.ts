import { createMiddleware } from "hono/factory";

const windowMs = 60_000; // 1 minute
const maxRequests = 100;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitMiddleware() {
  return createMiddleware(async (c, next) => {
    const ip = c.req.header("x-forwarded-for") ?? "local";
    const now = Date.now();

    let entry = requestCounts.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      requestCounts.set(ip, entry);
    }

    entry.count++;

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header(
      "X-RateLimit-Remaining",
      String(Math.max(0, maxRequests - entry.count)),
    );
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      return c.json({ error: "Too many requests" }, 429);
    }

    await next();
  });
}
