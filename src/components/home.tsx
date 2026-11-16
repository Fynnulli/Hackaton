"use client";

import { toMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { JoinScreen } from "./join-screen";
import { Button, Notice, Splash } from "./ui";
import { WelcomeScreen } from "./welcome-screen";

export function Home() {
  const { status, loadError, refresh } = useSession();

  if (status === "loading") return <Splash />;
  if (status === "unconfigured") return <Unconfigured />;
  if (status === "error") {
    return (
      <Notice
        title="Keine Verbindung"
        action={<Button onClick={() => void refresh()}>Nochmal versuchen</Button>}
      >
        {toMessage(loadError)}
      </Notice>
    );
  }
  if (status === "guest") return <JoinScreen />;
  return <WelcomeScreen />;
}

export function Unconfigured() {
  return (
    <Notice title="Fast fertig">
      Die Verbindung zu Supabase ist noch nicht eingerichtet. Es fehlen{" "}
      <code className="font-mono text-sm text-paper">NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
      <code className="font-mono text-sm text-paper">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
    </Notice>
  );
}
