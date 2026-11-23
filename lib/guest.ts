import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GUEST_COOKIE = "nocturna_guest";
export const GUEST_COOKIE_AGE = 60 * 60 * 24 * 180;

function sign(guestId: string) {
  const secret = process.env.NOCTURNA_SESSION_SECRET;

  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Falta configurar la clave de sesión.");
  }

  return createHmac("sha256", secret).update(guestId).digest();
}

export function issueGuest() {
  const id = randomBytes(32).toString("hex");
  return id + "." + sign(id).toString("hex");
}

export function readGuest(cookie?: string) {
  if (!cookie || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(cookie)) return null;

  const [id, signature] = cookie.split(".");
  return timingSafeEqual(Buffer.from(signature, "hex"), sign(id)) ? id : null;
}
