import { Temporal } from "@js-temporal/polyfill";
import {
  Body,
  Equator,
  EquatorFromVector,
  Horizon,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_EQD,
  Spherical,
  VectorFromSphere,
} from "astronomy-engine";
import { ROUTE_MAX_SUN_ALTITUDE, ROUTE_MIN_ALTITUDE } from "./night-route.ts";

export const observerCities = [
  { id: "madrid", name: "Madrid", lat: 40.4168, lon: -3.7038, timeZone: "Europe/Madrid" },
  { id: "murcia", name: "Murcia", lat: 37.9922, lon: -1.1307, timeZone: "Europe/Madrid" },
  { id: "barcelona", name: "Barcelona", lat: 41.3874, lon: 2.1686, timeZone: "Europe/Madrid" },
  { id: "tenerife", name: "Santa Cruz de Tenerife", lat: 28.4636, lon: -16.2518, timeZone: "Atlantic/Canary" },
] as const;

export type ObserverCity = (typeof observerCities)[number];
export type EquatorialPosition = { ra: number; dec: number };
export type NightWindow = { startMs: number; endMs: number };
export type NightSample = { timeMs: number; altitude: number; azimuth: number; sunAltitude: number };
export type NightPlan = NightWindow & {
  samples: NightSample[];
  horizonWindows: NightWindow[];
  darkWindows: NightWindow[];
  bestWindow: NightWindow | null;
  peakIndex: number;
};

export const NIGHT_MIN_DATE = "2000-01-01";
export const NIGHT_MAX_DATE = "2100-12-31";
export const TARGET_ALTITUDE = ROUTE_MIN_ALTITUDE;
export const DARK_SUN_ALTITUDE = ROUTE_MAX_SUN_ALTITUDE;
const SAMPLE_MS = 5 * 60_000;

export function parseJ2000(rightAscension: string, declination: string): EquatorialPosition | null {
  const raMatch = /^(\d{1,2})\s*h\s*(\d{1,2})\s*m\s*(\d{1,2}(?:\.\d+)?)\s*s$/i.exec(rightAscension.trim());
  const decMatch = /^([+\-−])\s*(\d{1,2})\s*°\s*(\d{1,2})\s*[′']\s*(\d{1,2}(?:\.\d+)?)\s*[″"]$/.exec(declination.trim());
  if (!raMatch || !decMatch) return null;

  const [h, raMinutes, raSeconds] = raMatch.slice(1).map(Number);
  const [degrees, decMinutes, decSeconds] = decMatch.slice(2).map(Number);
  if (h > 23 || raMinutes >= 60 || raSeconds >= 60 ||
      degrees > 90 || decMinutes >= 60 || decSeconds >= 60 ||
      (degrees === 90 && (decMinutes > 0 || decSeconds > 0))) return null;

  return {
    ra: h + raMinutes / 60 + raSeconds / 3600,
    dec: (decMatch[1] === "+" ? 1 : -1) * (degrees + decMinutes / 60 + decSeconds / 3600),
  };
}

export function getNightBounds(date: string, city: ObserverCity): NightWindow | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < NIGHT_MIN_DATE || date > NIGHT_MAX_DATE) return null;

  try {
    const day = Temporal.PlainDate.from(date, { overflow: "reject" });
    const start = day.toZonedDateTime({ timeZone: city.timeZone, plainTime: "18:00" });
    const end = day.add({ days: 1 }).toZonedDateTime({ timeZone: city.timeZone, plainTime: "06:00" });
    return { startMs: start.epochMilliseconds, endMs: end.epochMilliseconds };
  } catch {
    return null;
  }
}

export function currentDateInCity(city: ObserverCity, now = Date.now()) {
  return Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(city.timeZone).toPlainDate().toString();
}

type SampleRule = (sample: NightSample) => number;

// Interpolate each threshold on its own before intersecting the valid parts of a sample interval.
function thresholdWindows(samples: NightSample[], rules: readonly SampleRule[]): NightWindow[] {
  const windows: NightWindow[] = [];

  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    let lower = 0;
    let upper = 1;

    for (const rule of rules) {
      const before = rule(previous);
      const after = rule(current);

      if (before < 0 && after < 0) {
        upper = -1;
        break;
      }
      if (before < 0) lower = Math.max(lower, -before / (after - before));
      if (after < 0) upper = Math.min(upper, before / (before - after));
    }
    if (upper <= lower) continue;

    const span = current.timeMs - previous.timeMs;
    const startMs = Math.round(previous.timeMs + span * lower);
    const endMs = Math.round(previous.timeMs + span * upper);
    const last = windows.at(-1);

    if (last && last.endMs === startMs) last.endMs = endMs;
    else windows.push({ startMs, endMs });
  }

  return windows;
}

export function calculateNightPlan(
  coordinates: EquatorialPosition,
  city: ObserverCity,
  date: string,
): NightPlan | null {
  const bounds = getNightBounds(date, city);
  if (!bounds) return null;

  const observer = new Observer(city.lat, city.lon, 0);
  const targetSphere = new Spherical(coordinates.dec, coordinates.ra * 15, 1);
  const samples: NightSample[] = [];

  for (let timeMs = bounds.startMs; timeMs <= bounds.endMs; timeMs += SAMPLE_MS) {
    const time = MakeTime(new Date(timeMs));
    const target = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(time), VectorFromSphere(targetSphere, time)));
    const horizontal = Horizon(time, observer, target.ra, target.dec);
    const sun = Equator(Body.Sun, time, observer, true, true);
    const sunAltitude = Horizon(time, observer, sun.ra, sun.dec).altitude;

    samples.push({ timeMs, altitude: horizontal.altitude, azimuth: horizontal.azimuth, sunAltitude });
  }

  const astronomicalDarkness: SampleRule = ({ sunAltitude }) => DARK_SUN_ALTITUDE - sunAltitude;
  const darkWindows = thresholdWindows(samples, [astronomicalDarkness]);
  const horizonWindows = thresholdWindows(samples, [({ sunAltitude }) => -sunAltitude]);
  const favorable = thresholdWindows(samples, [
    astronomicalDarkness,
    ({ altitude }) => altitude - TARGET_ALTITUDE,
  ]);
  const bestWindow = favorable.reduce<NightWindow | null>((best, next) => (
    !best || next.endMs - next.startMs > best.endMs - best.startMs ? next : best
  ), null);
  let peakIndex = 0;
  samples.forEach((sample, index) => {
    if (sample.altitude > samples[peakIndex].altitude) peakIndex = index;
  });

  return { ...bounds, samples, horizonWindows, darkWindows, bestWindow, peakIndex };
}

const compassNames = ["Norte", "Nordeste", "Este", "Sureste", "Sur", "Suroeste", "Oeste", "Noroeste"];

export function compassDirection(azimuth: number) {
  const normalized = ((azimuth % 360) + 360) % 360;
  return compassNames[Math.round(normalized / 45) % compassNames.length];
}
