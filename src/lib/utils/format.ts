export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(epochMs: number): string {
  const dt = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function nextTuesdayISO(
  fromISO: string = new Date().toISOString().slice(0, 10)
): string {
  const d = new Date(`${fromISO}T12:00:00Z`);
  const day = d.getUTCDay();
  let delta = (2 - day + 7) % 7;
  if (delta === 0) delta = 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
