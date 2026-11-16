const MESSAGES: Record<string, string> = {
  not_authenticated: "Deine Sitzung ist abgelaufen. Bitte lade die Seite neu.",
  not_joined: "Du bist noch nicht beigetreten.",
  invalid_join_code: "Diesen Beitrittscode gibt es nicht.",
  event_closed: "Das Event ist bereits beendet.",
  invalid_name: "Dein Name muss 1 bis 24 Zeichen lang sein.",
  invalid_avatar: "Bitte wähle einen Avatar.",
  invalid_token: "Dieser Wiedereinstiegs-Link ist ungültig.",
  already_joined:
    "Auf diesem Gerät bist du schon in einem Team. Der Link kann hier nicht eingelöst werden.",
  teams_locked: "Teams können jetzt nicht mehr geändert werden.",
  already_in_team: "Du bist schon in einem Team.",
  invalid_team_name: "Der Teamname muss 1 bis 40 Zeichen lang sein.",
  team_name_taken: "Diesen Teamnamen gibt es schon.",
  invalid_team_code: "Diesen Teamcode gibt es nicht.",
  team_full: "Dieses Team ist schon voll (max. 3 Personen).",
  no_team: "Dafür brauchst du ein Team.",
  submissions_closed: "Die Abgabe ist geschlossen.",
  invalid_title: "Der Projekttitel muss 1 bis 80 Zeichen lang sein.",
  invalid_url: "Der Link muss mit http:// oder https:// beginnen.",
  invalid_description: "Die Beschreibung darf höchstens 300 Zeichen lang sein.",
  invalid_screenshot: "Der Screenshot konnte nicht zugeordnet werden.",
  voting_closed: "Die Abstimmung ist gerade nicht geöffnet.",
  invalid_submission: "Diese Abgabe gibt es nicht.",
  cannot_vote_own_team: "Fürs eigene Team kannst du nicht stimmen.",
  already_voted: "Für diese Abgabe hast du schon gestimmt.",
  no_votes_left: "Du hast alle drei Stimmen vergeben.",
  not_admin: "Das darf nur die Event-Leitung.",
};

const FALLBACK = "Das hat nicht geklappt. Bitte versuch es noch einmal.";

/** Uebersetzt Fehler aus RPCs, Auth und Netzwerk in einen Satz fuer die Oberflaeche. */
export function toMessage(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";

  if (raw in MESSAGES) return MESSAGES[raw];
  if (/anonymous sign-?ins are disabled/i.test(raw)) {
    return "Die Anmeldung ist noch nicht freigeschaltet. Bitte sag der Event-Leitung Bescheid.";
  }
  if (/rate limit|too many requests/i.test(raw)) {
    return "Gerade melden sich sehr viele an. Bitte versuch es in einer Minute noch einmal.";
  }
  if (/exceeded the maximum allowed size|payload too large/i.test(raw)) {
    return "Der Screenshot ist größer als 2 MB.";
  }
  if (/row-level security/i.test(raw)) {
    return "Das ging nicht durch. Ist die Abgabe vielleicht schon geschlossen?";
  }
  if (/failed to fetch|network|load failed/i.test(raw)) {
    return "Keine Verbindung. Bitte prüfe dein Netz und versuch es noch einmal.";
  }
  return FALLBACK;
}
