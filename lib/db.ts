import "server-only";

import postgres from "postgres";
import type { CatalogObject, ObservationMutation } from "@/lib/catalog";
import { SUPABASE_POOLER_CA } from "@/lib/supabase-ca";

let client: ReturnType<typeof postgres> | undefined;

function database() {
  if (client) return client;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta configurar la base de datos.");

  client = postgres(url, {
    ssl: { ca: SUPABASE_POOLER_CA, rejectUnauthorized: true },
    prepare: false,
    max: 1,
    connect_timeout: 10,
    idle_timeout: 20,
  });

  return client;
}

export async function getCatalog() {
  const sql = database();

  return sql<CatalogObject[]>`
    select id, title, category, object_type, constellation, season, instrument,
      magnitude::float8 as magnitude, right_ascension, declination, distance,
      summary, description, observation_tip, image_path, image_alt
    from public.nocturna_objects
    order by display_order
  `;
}

export async function getObservations(guestId: string) {
  return database().begin(async (sql) => {
    await sql`select set_config('nocturna.guest_id', ${guestId}, true)`;

    const rows = await sql<{ object_id: string }[]>`
      select object_id
      from public.nocturna_observations
      where guest_id = ${guestId}
      order by saved_at desc, object_id
    `;
    return rows.map((row) => row.object_id);
  });
}

export async function setObservation(guestId: string, { objectId, saved }: ObservationMutation) {
  return database().begin(async (sql) => {
    await sql`select set_config('nocturna.guest_id', ${guestId}, true)`;
    const objects = await sql<{ id: string }[]>`
      select id from public.nocturna_objects where id = ${objectId}
    `;

    if (objects.length === 0) return false;

    if (saved) {
      await sql`
        insert into public.nocturna_observations (guest_id, object_id)
        values (${guestId}, ${objectId})
        on conflict (guest_id, object_id) do nothing
      `;
    } else {
      await sql`
        delete from public.nocturna_observations
        where guest_id = ${guestId} and object_id = ${objectId}
      `;
    }

    return true;
  });
}
