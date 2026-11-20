export const COUNTRY_NAMES: Record<string, string> = {
  NL: "Netherlands",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  PL: "Poland",
};
export const FLAGS: Record<string, string> = { NL: "🇳🇱", DE: "🇩🇪", FR: "🇫🇷", ES: "🇪🇸", PL: "🇵🇱" };

export function money(value: number | null | undefined, currency = "EUR"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat(currency === "PLN" ? "pl-PL" : "nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function pct(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "–";
  return `${value.toFixed(digits)}%`;
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  const fut = diff < 0;
  const s = Math.abs(diff);
  const unit =
    s < 60 ? [Math.round(s), "s"] : s < 3600 ? [Math.round(s / 60), "min"] : s < 86400 ? [Math.round(s / 3600), "h"] : [Math.round(s / 86400), "d"];
  return fut ? `in ${unit[0]} ${unit[1]}` : `${unit[0]} ${unit[1]} ago`;
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(iso));
}

export function bandColor(p: number): string {
  if (p >= 50) return "bg-good text-white dark:text-black";
  if (p >= 40) return "bg-good/85 text-white dark:text-black";
  if (p >= 30) return "bg-accent text-white";
  if (p >= 20) return "bg-text text-bg";
  if (p >= 10) return "bg-panel-2 text-text border border-border";
  return "bg-panel-2 text-muted border border-border";
}
