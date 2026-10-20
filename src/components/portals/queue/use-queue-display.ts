"use client";
/**
 * Queue display data hook — polls GET /api/queue/display every 10s and reacts
 * to realtime "queue:called" (socket room "display") with instant refresh +
 * flash + optional WebAudio chime. No patient names ever rendered (privacy).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { joinRoom, useRealtime } from "@/lib/realtime-client";

export interface QueueRow {
  pointAr: string;
  pointEn: string;
  code: string;
  room: string;
  waitingCount: number;
}

const FLASH_MS = 6000;

export interface QueueDisplayState {
  rows: QueueRow[] | null;
  error: boolean;
  flash: string | null;
  muted: boolean;
  connected: boolean;
  toggleMute: () => void;
  retry: () => void;
}

export function useQueueDisplay(): QueueDisplayState {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const codesRef = useRef<Map<string, string>>(new Map());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const beep = useCallback(() => {
    if (muted) return;
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioRef.current ??= new Ctor();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* audio unavailable — silent */ }
  }, [muted]);

  const flashCode = useCallback((code: string) => {
    setFlash(code);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<{ display: QueueRow[] }>("/api/queue/display");
      const list = r.display ?? [];
      const prev = codesRef.current;
      let changed: string | null = null;
      for (const row of list) {
        if (prev.has(row.pointEn) && prev.get(row.pointEn) !== row.code && row.code !== "—") changed = row.code;
      }
      codesRef.current = new Map(list.map((row) => [row.pointEn, row.code]));
      setRows(list);
      setError(false);
      if (changed) {
        flashCode(changed);
        beep();
      }
    } catch {
      setError(true);
    }
  }, [beep, flashCode]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  const connected = useRealtime("queue:called", (payload) => {
    const p = payload as { code?: string };
    void load();
    if (p?.code) {
      flashCode(p.code);
      beep();
    }
  });

  // join the "display" room on every (re)connect — the API emits room-scoped
  useEffect(() => {
    if (connected) joinRoom("display");
  }, [connected]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (m) {
        // un-mute inside the user gesture → prime/resume AudioContext
        try {
          const Ctor = window.AudioContext
            ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctor) {
            audioRef.current ??= new Ctor();
            void audioRef.current.resume();
          }
        } catch { /* noop */ }
      }
      return !m;
    });
  }, []);

  return { rows, error, flash, muted, connected, toggleMute, retry: () => void load() };
}
