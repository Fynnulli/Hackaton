"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { ServerClockProvider } from "@/lib/server-clock";
import { SessionProvider } from "@/lib/session";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ServerClockProvider>
        <SessionProvider>{children}</SessionProvider>
      </ServerClockProvider>
    </MotionConfig>
  );
}
