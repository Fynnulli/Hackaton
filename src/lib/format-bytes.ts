/** Dateigroesse fuer die Oberflaeche, z. B. "1,4 MB". */
const UNITS = ["B", "KB", "MB", "GB"];
const NUMBER = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${NUMBER.format(value)} ${UNITS[unit]}`;
}
