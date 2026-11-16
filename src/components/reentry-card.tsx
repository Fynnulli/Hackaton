"use client";

import { useState } from "react";
import { useSession } from "@/lib/session";
import { CopyButton } from "./copy-button";
import { Card } from "./ui";

/** Der Token steht im Fragment (#), damit er in keinem Server-Log landet. */
export const reentryUrl = (token: string) => `${window.location.origin}/r#${token}`;

export function ReentryCard() {
  const { getReentryToken } = useSession();
  const [visibleLink, setVisibleLink] = useState<string | null>(null);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="label">Gerät wechseln</p>
        <p className="mt-3 text-lg">
          Mit deinem persönlichen Link kommst du auf jedem Gerät wieder rein.
        </p>
        <p className="mt-1 text-sm text-muted">
          Schick ihn dir selbst und gib ihn nicht weiter: Wer ihn öffnet, übernimmt deinen Platz.
        </p>
      </div>

      <CopyButton
        label="Link kopieren"
        getText={async () => reentryUrl(await getReentryToken())}
        onFallback={setVisibleLink}
      />

      {visibleLink ? (
        <input
          readOnly
          value={visibleLink}
          aria-label="Persönlicher Link"
          onFocus={(e) => e.currentTarget.select()}
          className="focus-ring h-12 w-full rounded-xl border border-line bg-ink px-3 font-mono text-xs text-muted"
        />
      ) : null}
    </Card>
  );
}
