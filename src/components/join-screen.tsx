"use client";

import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { toMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { Button, FormError, TextField, Wordmark } from "./ui";

const AVATARS = [
  "🦊", "🐙", "🦄", "🐸", "🦉", "🐝", "🦖", "🐳",
  "🦜", "🐺", "🦥", "🦔", "🦆", "🤖", "👾", "🧠",
  "🚀", "🛸", "🪐", "⚡", "🔥", "🌵", "🍄", "🌈",
  "🍕", "🥨", "🧃", "🎧", "💾", "🧪", "🔮", "🎲",
];

const cleanCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

export function JoinScreen() {
  const { join } = useSession();
  // Einladungslink: /?code=XXXX fuellt den Beitrittscode vor. Die Komponente wird
  // nur im Browser gerendert (nach dem Laden der Sitzung), window ist also da.
  const [code, setCode] = useState(() =>
    cleanCode(new URLSearchParams(window.location.search).get("code") ?? ""),
  );
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = code.length >= 4 && name.trim().length > 0 && avatar !== null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await join(code, name.trim(), avatar);
    } catch (err) {
      setError(toMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-10 px-5 pt-6 pb-10 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="flex flex-col gap-6 lg:gap-10"
      >
        <Wordmark />
        <h1 className="display text-[clamp(4rem,19vw,7rem)] lg:text-[clamp(7rem,13vw,13rem)]">
          Drei
          <br />
          Stunden.
          <br />
          <span className="neon-glow text-neon">Build.</span>
        </h1>
        <p className="max-w-md text-lg text-muted sm:text-xl">
          Alle starten gleichzeitig. Das Thema erfährst du in derselben Sekunde wie alle anderen.
        </p>
      </motion.div>

      <motion.form
        onSubmit={onSubmit}
        noValidate
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
        className="flex flex-col gap-7 rounded-3xl border border-line bg-surface/80 p-5 backdrop-blur-sm sm:p-8"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="join-code" className="label">
            01 · Beitrittscode
          </label>
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="······"
            aria-required
            className="focus-ring h-20 w-full rounded-xl border border-line bg-raised pl-[0.3em] text-center font-mono text-3xl font-semibold tracking-[0.3em] text-neon caret-neon placeholder:text-muted/40 transition-colors focus:border-neon sm:text-4xl"
          />
        </div>

        <TextField
          id="display-name"
          label="02 · Dein Name"
          hint={`${name.trim().length}/24`}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          maxLength={24}
          autoComplete="nickname"
          placeholder="So sehen dich die anderen"
          aria-required
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">03 · Avatar</legend>
          <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-8 gap-1.5">
            {AVATARS.map((emoji) => {
              const selected = avatar === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Avatar ${emoji}`}
                  onClick={() => setAvatar(emoji)}
                  className={`focus-ring flex aspect-square items-center justify-center rounded-lg border-2 text-xl transition-[background-color,border-color,transform] duration-150 sm:text-2xl ${
                    selected
                      ? "scale-105 border-neon bg-raised"
                      : "border-transparent hover:bg-raised/70 active:scale-90"
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </fieldset>

        <FormError message={error} />

        <Button type="submit" busy={busy} disabled={!ready}>
          Beitreten
        </Button>
      </motion.form>
    </main>
  );
}
