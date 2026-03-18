type EventListener = (event: ServerEvent) => void;

export interface ServerEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

/**
 * Server-sent events manager for live updates.
 * Singleton that manages SSE connections.
 */
export class EventEmitter {
  private static instance: EventEmitter;
  private listeners = new Set<EventListener>();

  static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
    }
    return EventEmitter.instance;
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type: string, data: unknown): void {
    const event: ServerEvent = { type, data, timestamp: Date.now() };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener error, remove it
        this.listeners.delete(listener);
      }
    }
  }

  get connectionCount(): number {
    return this.listeners.size;
  }
}
