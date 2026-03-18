import { useEffect, useRef, useCallback } from "react";
import { SSE_CONFIG } from "@/lib/constants";
import { useAppStore } from "@/stores/app-store";

type SSECallback = (data: Record<string, unknown>) => void;

const listeners = new Map<string, Set<SSECallback>>();
let eventSource: EventSource | null = null;
let retryCount = 0;

function connect() {
  if (eventSource?.readyState === EventSource.OPEN) return;

  eventSource = new EventSource("/api/events");

  eventSource.onopen = () => {
    retryCount = 0;
    useAppStore.getState().setConnected(true);
  };

  eventSource.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      const type = parsed.type as string;
      const callbacks = listeners.get(type);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(parsed.data);
        }
      }
    } catch {
      // Ignore malformed SSE data
    }
  };

  eventSource.onerror = () => {
    useAppStore.getState().setConnected(false);
    eventSource?.close();
    eventSource = null;

    if (retryCount < SSE_CONFIG.maxRetries) {
      retryCount++;
      setTimeout(connect, SSE_CONFIG.reconnectInterval);
    }
  };
}

function disconnect() {
  eventSource?.close();
  eventSource = null;
  retryCount = 0;
}

export function useSSE(eventType: string, callback: SSECallback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const stableCallback: SSECallback = useCallback((data) => {
    callbackRef.current(data);
  }, []);

  useEffect(() => {
    // Ensure connection
    connect();

    // Register listener
    if (!listeners.has(eventType)) {
      listeners.set(eventType, new Set());
    }
    listeners.get(eventType)!.add(stableCallback);

    return () => {
      listeners.get(eventType)?.delete(stableCallback);
      if (listeners.get(eventType)?.size === 0) {
        listeners.delete(eventType);
      }
      // Disconnect when no more listeners
      if (listeners.size === 0) {
        disconnect();
      }
    };
  }, [eventType, stableCallback]);
}
