import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { EventEmitter, type ServerEvent } from "../sse/event-emitter.js";

export const eventsRoute = new Hono();

eventsRoute.get("/events", (c) => {
  return streamSSE(c, async (stream) => {
    const emitter = EventEmitter.getInstance();

    const unsubscribe = emitter.subscribe((event: ServerEvent) => {
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event.data),
      });
    });

    // Keep connection alive with periodic heartbeats
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: "heartbeat", data: "" });
    }, 30_000);

    // Wait until the stream is closed by the client
    stream.onAbort(() => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    // Keep stream open
    await new Promise(() => {});
  });
});
