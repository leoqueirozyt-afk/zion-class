export function normalizeKeyword(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function keywordsMatch(stored: string, submitted: string): boolean {
  if (!stored) return false;
  return normalizeKeyword(stored) === normalizeKeyword(submitted);
}
