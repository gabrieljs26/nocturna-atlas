import { type NextRequest, NextResponse } from "next/server";
import { parseObservationMutation } from "@/lib/catalog";
import { getObservations, setObservation } from "@/lib/db";
import { GUEST_COOKIE, GUEST_COOKIE_AGE, issueGuest, readGuest } from "@/lib/guest";

const responseHeaders = { "Cache-Control": "private, no-store" };

function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: responseHeaders });
}

function unavailable(error: unknown) {
  console.error("Nocturna: error al consultar la lista.", error instanceof Error ? error.message : error);
  return respond({ error: "La lista no está disponible en este momento." }, 503);
}

export async function GET(request: NextRequest) {
  try {
    const existingGuest = readGuest(request.cookies.get(GUEST_COOKIE)?.value);
    const objectIds = existingGuest ? await getObservations(existingGuest) : [];
    const response = respond({ objectIds });

    if (!existingGuest) {
      response.cookies.set(GUEST_COOKIE, issueGuest(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: GUEST_COOKIE_AGE,
      });
    }

    return response;
  } catch (error) {
    return unavailable(error);
  }
}

function sameOrigin(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "none" && fetchSite !== "same-origin") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  // Next puede normalizar la dirección local a localhost al construir nextUrl.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol + ":"
    : request.nextUrl.protocol;

  return origin === protocol + "//" + host.toLowerCase();
}

export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) {
    return respond({ error: "Este origen no puede modificar la lista." }, 403);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return respond({ error: "Envía un objeto JSON válido." }, 400);
  }

  const mutation = parseObservationMutation(input);
  if (!mutation) return respond({ error: "Indica un objeto del catálogo y su estado." }, 400);

  try {
    const guest = readGuest(request.cookies.get(GUEST_COOKIE)?.value);
    if (!guest) return respond({ error: "Vuelve a abrir tu lista antes de guardar." }, 409);

    const exists = await setObservation(guest, mutation);
    if (!exists) return respond({ error: "Este objeto no está en el catálogo." }, 404);

    return respond(mutation);
  } catch (error) {
    return unavailable(error);
  }
}
