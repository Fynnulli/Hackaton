"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { Home } from "../home";
import { Notice } from "../ui";

/** Platzhalter: Das Abgabeformular folgt in Phase 4. */
export function SubmitPage() {
  const { status } = useSession();
  if (status !== "joined") return <Home />;

  return (
    <Notice
      title="Abgabe folgt"
      action={
        <Link
          href="/"
          className="focus-ring font-mono text-sm tracking-[0.08em] text-neon uppercase underline-offset-4 hover:underline"
        >
          ← Zurück zur Bauphase
        </Link>
      }
    >
      Das Abgabeformular kommt in der nächsten Ausbaustufe.
    </Notice>
  );
}
