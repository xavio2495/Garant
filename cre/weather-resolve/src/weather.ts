export type WeatherSpec = { lat1e4: number; lon1e4: number; yyyymmdd: number };

export const OUTCOME = { NO: 0, YES: 1, VOID: 2 } as const;

export type Decision =
  | { kind: "report"; outcome: number; observedA: bigint; observedB: bigint }
  | { kind: "retry"; reason: string };

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(ymd: number): string {
  const y = Math.floor(ymd / 10000);
  const m = Math.floor(ymd / 100) % 100;
  const d = ymd % 100;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function sourceAUrl(s: WeatherSpec): string {
  const day = isoDate(s.yyyymmdd);
  return (
    "https://archive-api.open-meteo.com/v1/archive" +
    `?latitude=${s.lat1e4 / 1e4}&longitude=${s.lon1e4 / 1e4}` +
    `&start_date=${day}&end_date=${day}&daily=precipitation_sum&timezone=auto`
  );
}

export function sourceBUrl(s: WeatherSpec): string {
  return (
    "https://power.larc.nasa.gov/api/temporal/daily/point" +
    `?parameters=PRECTOTCORR&community=AG&latitude=${s.lat1e4 / 1e4}&longitude=${s.lon1e4 / 1e4}` +
    `&start=${s.yyyymmdd}&end=${s.yyyymmdd}&format=JSON`
  );
}

// Returns millimetres, or null when the day is not published yet.
export function parseA(json: any): number | null {
  const v = json?.daily?.precipitation_sum?.[0];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parseB(json: any, yyyymmdd: number): number | null {
  const v = json?.properties?.parameter?.PRECTOTCORR?.[String(yyyymmdd)];
  const fill = json?.header?.fill_value ?? -999;
  return typeof v === "number" && Number.isFinite(v) && v !== fill && v >= 0 ? v : null;
}

const toCentiMm = (mm: number) => BigInt(Math.round(mm * 100));

// strike is mm*100; the event happens when observed >= strike.
export function decide(a: number | null, b: number | null, strike: bigint): Decision {
  if (a === null) return { kind: "retry", reason: "source A not published" };
  if (b === null) return { kind: "retry", reason: "source B not published" };
  const observedA = toCentiMm(a);
  const observedB = toCentiMm(b);
  const yesA = observedA >= strike;
  const yesB = observedB >= strike;
  const outcome = yesA !== yesB ? OUTCOME.VOID : yesA ? OUTCOME.YES : OUTCOME.NO;
  return { kind: "report", outcome, observedA, observedB };
}
