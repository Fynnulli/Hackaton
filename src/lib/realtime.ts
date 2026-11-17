"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

const DEBOUNCE_MS = 250;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000];
/**
 * Lasttest (60 Clients): Direkt nach SUBSCRIBED stellt Supabase unter Last noch nicht alle
 * Aenderungen zu. Deshalb wird nach dieser Anlaufzeit ein zweites Mal frisch geladen.
 */
const WARMUP_RELOAD_MS = 3_000;

/**
 * Realtime als Ausloeser: Jede Aenderung an einer der Tabellen ruft `onChange` auf
 * (entprellt). Payloads werden bewusst nicht ausgewertet, der Aufrufer laedt frisch.
 * Bricht der Kanal ab, wird mit Backoff neu abonniert und danach ebenfalls `onChange`
 * aufgerufen, um Verpasstes nachzuholen. Gibt zurueck, ob der Kanal gerade steht.
 */
export function useRealtimeReload(
  name: string,
  tables: readonly string[],
  onChange: () => void,
  enabled: boolean,
): boolean {
  const [live, setLive] = useState(false);
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  const tableKey = tables.join(",");

  useEffect(() => {
    if (!enabled) return;
    const sb = getSupabase();
    let channel: RealtimeChannel | null = null;
    let disposed = false;
    let attempt = 0;
    let debounce = 0;
    let retry = 0;
    let warmup = 0;

    const fire = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => callback.current(), DEBOUNCE_MS);
    };

    const connect = () => {
      if (disposed) return;
      let ch = sb.channel(`${name}-${Date.now()}`);
      for (const table of tableKey.split(",")) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, fire);
      }
      channel = ch;
      ch.subscribe((state) => {
        if (disposed || channel !== ch) return;
        if (state === "SUBSCRIBED") {
          attempt = 0;
          setLive(true);
          fire();
          window.clearTimeout(warmup);
          warmup = window.setTimeout(() => callback.current(), WARMUP_RELOAD_MS);
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setLive(false);
          channel = null;
          void sb.removeChannel(ch);
          const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
          attempt += 1;
          window.clearTimeout(retry);
          retry = window.setTimeout(connect, delay);
        }
      });
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(debounce);
      window.clearTimeout(retry);
      window.clearTimeout(warmup);
      if (channel) void sb.removeChannel(channel);
      setLive(false);
    };
  }, [name, tableKey, enabled]);

  return live;
}
