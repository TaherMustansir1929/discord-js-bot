import * as chrono from "chrono-node";

export function parseNaturalLanguageDate(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parsed = chrono.parseDate(trimmed, new Date(), { forwardDate: true });
  return parsed ?? null;
}

export function formatShortDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16);
}
