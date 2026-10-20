/**
 * Realtime client — socket.io via gateway (port 3003).
 * Browser MUST use io("/?XTransformPort=3003") — never a direct port URL.
 */
"use client";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

let shared: Socket | null = null;
let refCount = 0;

export function getSocket(): Socket {
  if (shared) return shared;
  shared = io("/?XTransformPort=3003", {
    transports: ["websocket", "polling"],
    forceNew: false,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 2000,
  });
  return shared;
}

export function useRealtime(event: string, handler: (payload: unknown) => void, deps: unknown[] = []): boolean {
  const [connected, setConnected] = useState(false);
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => {
    const s = getSocket();
    const on = (p: unknown) => ref.current(p);
    s.on(event, on);
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    queueMicrotask(() => setConnected(s.connected));
    return () => {
      s.off(event, on);
    };
  }, [event, ...deps]);
  return connected;
}

export function emitRealtime(event: string, payload?: unknown): void {
  const s = getSocket();
  if (s.connected) s.emit(event, payload);
}

/** Room join helper for display screens */
export function joinRoom(room: string): void {
  getSocket().emit("room:join", room);
}
