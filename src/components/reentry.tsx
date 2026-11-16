"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { Unconfigured } from "./home";
import { Notice, Splash } from "./ui";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Reentry() {
  const { status, claimReentryToken } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (status === "loading" || status === "unconfigured" || started.current) return;
    started.current = true;

    const token = window.location.hash.slice(1);
    // Token sofort aus Adresszeile und Verlauf nehmen.
    window.history.replaceState(null, "", window.location.pathname);

    const attempt = UUID.test(token)
      ? claimReentryToken(token)
      : Promise.reject(new Error("invalid_token"));
    attempt.then(
      () => router.replace("/"),
      (err) => setError(toMessage(err)),
    );
  }, [status, claimReentryToken, router]);

  if (status === "unconfigured") return <Unconfigured />;
  if (error) {
    return (
      <Notice
        title="Das hat nicht geklappt"
        action={
          <Link
            href="/"
            className="focus-ring font-mono text-sm tracking-[0.08em] text-neon uppercase underline-offset-4 hover:underline"
          >
            Zur Startseite
          </Link>
        }
      >
        {error}
      </Notice>
    );
  }
  return <Splash />;
}
