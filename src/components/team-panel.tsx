"use client";

import { useState, type FormEvent } from "react";
import { toMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { MAX_TEAM_SIZE } from "@/lib/types";
import { CopyButton } from "./copy-button";
import { Button, Card, FormError, TextField } from "./ui";

interface TeamPanelProps {
  /** Team gruenden oder beitreten ist moeglich (Lobby, oder zu spaet Gekommene ohne Team). */
  canGetTeam: boolean;
  /** Team verlassen ist moeglich (nur Lobby). */
  canLeaveTeam: boolean;
}

export function TeamPanel({ canGetTeam, canLeaveTeam }: TeamPanelProps) {
  const { team } = useSession();
  if (team) return <MyTeam canLeave={canLeaveTeam} />;
  if (canGetTeam) return <TeamSetup />;
  return (
    <Card>
      <p className="label">Team</p>
      <p className="mt-3 text-lg text-muted">
        Du bist in keinem Team, und die Teams stehen inzwischen fest. Wende dich an die
        Event-Leitung, falls das ein Versehen ist.
      </p>
    </Card>
  );
}

function MyTeam({ canLeave }: { canLeave: boolean }) {
  const { team, teammates, participant, leaveTeam } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!team) return null;

  const freeSlots = Math.max(0, MAX_TEAM_SIZE - teammates.length);

  async function onLeave() {
    setBusy(true);
    setError(null);
    try {
      await leaveTeam();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-6">
      <div>
        <p className="label">Dein Team</p>
        <h2 className="display mt-3 text-4xl break-words sm:text-5xl">{team.name}</h2>
      </div>

      <ul className="flex flex-col gap-2">
        {teammates.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2.5"
          >
            <span className="text-2xl" aria-hidden>
              {member.avatar}
            </span>
            <span className="min-w-0 flex-1 truncate text-lg">{member.display_name}</span>
            {member.id === participant?.id ? <span className="label text-neon">Du</span> : null}
          </li>
        ))}
        {Array.from({ length: freeSlots }, (_, i) => (
          <li
            key={`free-${i}`}
            className="label flex h-[3.25rem] items-center rounded-xl border border-dashed border-line px-4"
          >
            Platz frei
          </li>
        ))}
      </ul>

      {freeSlots > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="label">Teamcode zum Weitergeben</p>
          <div className="flex items-stretch gap-2">
            <output className="flex h-14 flex-1 items-center justify-center rounded-xl border border-line bg-ink pl-[0.3em] font-mono text-2xl font-semibold tracking-[0.3em] text-neon">
              {team.team_code}
            </output>
            <CopyButton getText={() => team.team_code} label="Kopieren" />
          </div>
        </div>
      ) : null}

      <FormError message={error} />

      {canLeave ? (
        <Button variant="quiet" onClick={onLeave} busy={busy} className="self-start">
          Team verlassen
        </Button>
      ) : null}
    </Card>
  );
}

function TeamSetup() {
  const { createTeam, joinTeam } = useSession();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "create" | "join", event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === "create") await createTeam(name.trim());
      else await joinTeam(code);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="flex flex-col gap-6">
      <div>
        <p className="label">Team</p>
        <h2 className="display mt-3 text-4xl sm:text-5xl">Such dir ein Team</h2>
        <p className="mt-3 text-muted">
          Ein bis drei Personen. Allein unterwegs? Gründe einfach ein Team für dich.
        </p>
      </div>

      <form onSubmit={(e) => run("create", e)} className="flex flex-col gap-3" noValidate>
        <TextField
          id="team-name"
          label="Neues Team gründen"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          maxLength={40}
          placeholder="Teamname"
          autoComplete="off"
        />
        <Button type="submit" busy={busy === "create"} disabled={!name.trim() || busy !== null}>
          Team gründen
        </Button>
      </form>

      <div className="flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="label">oder</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={(e) => run("join", e)} className="flex flex-col gap-3" noValidate>
        <TextField
          id="team-code"
          label="Mit Teamcode beitreten"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))
          }
          placeholder="·····"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="pl-[calc(1rem+0.3em)] text-center font-mono text-2xl font-semibold tracking-[0.3em] text-neon"
        />
        <Button
          type="submit"
          variant="ghost"
          busy={busy === "join"}
          disabled={code.length < 5 || busy !== null}
        >
          Beitreten
        </Button>
      </form>

      <FormError message={error} />
    </Card>
  );
}
