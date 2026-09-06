/**
 * CGM timestamps are the device's own wall clock (`2026-08-24T16:01:00`) with
 * no offset, because the export carries none. They are never converted: 16:01
 * means the 16:01 the sensor recorded, in whatever zone the wearer was in.
 *
 * A string in that shape parses as *local* time, so a Date built from one and
 * then formatted locally round-trips unchanged. That is the whole trick -- do
 * not reach for `toISOString()` anywhere near these values.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export const parseWallClock = (value: string): Date => new Date(value);

export const formatWallClock = (value: string): string => {
  const date = parseWallClock(value);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** `YYYY-MM-DDTHH:MM:SS` -- the shape the API's `from` / `to` expect. */
export const toWallClock = (date: Date): string => {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day}T${time}`;
};

export const shiftDays = (value: string, days: number): string => {
  const date = parseWallClock(value);
  date.setDate(date.getDate() + days);
  return toWallClock(date);
};

/** Axis and tooltip labels: the time alone inside a day, the date beyond one. */
export const formatTick = (date: Date, spanMs: number): string => {
  const withinTwoDays = spanMs < 2 * 24 * 3600 * 1000;
  if (withinTwoDays) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = `${date.getMonth() + 1}/${date.getDate()}`;
  return spanMs < 21 * 24 * 3600 * 1000 ? `${day} ${pad(date.getHours())}:00` : day;
};
