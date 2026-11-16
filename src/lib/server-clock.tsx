"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { pickOffset, type ClockSample } from "./clock";
import { getSupabase, isSupabaseConfigured } from "./supabase";

const SAMPLES = 5;
const RESYNC_MS = 60_000;

/** Versatz Server minus Browser in ms (0, bis die erste Messung da ist). */
const OffsetContext = createContext<number>(0);

async function measure(): Promise<number | null> {
  const sb = getSupabase();
  const samples: ClockSample[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const sentAt = Date.now();
    const { data, error } = await sb.rpc("server_time");
    const receivedAt = Date.now();
    if (error || typeof data !== "string") continue;
    samples.push({ sentAt, receivedAt, serverMs: Date.parse(data) });
  }
  return pickOffset(samples);
}

export function ServerClockProvider({ children }: { children: ReactNode }) {
  const [offset, setOffset] = useState(0);
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const next = await measure();
      if (next !== null) setOffset(next);
    } catch {
      // Ohne Verbindung bleibt der letzte Versatz gueltig.
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync() setzt State erst nach dem await
    void sync();
    const onWake = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const timer = window.setInterval(onWake, RESYNC_MS);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [sync]);

  return <OffsetContext.Provider value={offset}>{children}</OffsetContext.Provider>;
}

export function useServerOffset(): number {
  return useContext(OffsetContext);
}

/** Aktuelle Serverzeit in ms, aktualisiert im angegebenen Takt (synchron zur vollen Sekunde). */
export function useServerNow(intervalMs = 1000): number {
  const offset = useServerOffset();
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const t = Date.now() + offset;
      setNow(t);
      // Auf die naechste Taktgrenze der Serverzeit ausrichten, damit alle Geraete gleich umspringen.
      timer = window.setTimeout(tick, intervalMs - (t % intervalMs) + 5);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [offset, intervalMs]);

  return now;
}
