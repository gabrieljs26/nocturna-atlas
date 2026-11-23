# Nocturna

[Abrir el atlas de producción](https://nocturna-atlas.vercel.app)

Atlas en español para descubrir objetos de cielo profundo y preparar una lista de observación. El catálogo se puede explorar por nombre, identificador Messier y tipo de objeto. Cada ficha incluye coordenadas, magnitud aparente, temporada orientativa para latitudes medias del hemisferio norte y un consejo de observación.

La lista se guarda en Supabase y se recupera al volver con el mismo navegador. Para empezar, abre una ficha o pulsa su marcador. Nocturna usa una cookie firmada para identificar la lista sin pedir una cuenta.

Activa **Luz roja** en la cabecera para consultar el atlas con una paleta tenue durante la observación. Tu navegador recuerda la preferencia.

## Desarrollo local

1. Usa Node.js 24 y ejecuta `npm ci`.
2. Aplica la [migración inicial](supabase/migrations/20261123134857_nocturna_catalog_and_observations.sql) en un proyecto Supabase. Crea el catálogo, sus seis entradas, la tabla de observaciones y las políticas de acceso.
3. Como administrador de la base de datos, habilita el inicio de sesión de `nocturna_app` con una contraseña exclusiva y aleatoria. Puedes ejecutar `ALTER ROLE nocturna_app LOGIN CONNECTION LIMIT 10;` y asignar la contraseña desde `psql` con `\password nocturna_app`.
4. Copia [`.env.example`](.env.example) a `.env.local`. Usa el host del pool de transacciones del panel **Connect** de Supabase y el usuario `nocturna_app.<referencia-del-proyecto>`. Genera una clave de firma con `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
5. Ejecuta `npm run dev` y abre [localhost:3000](http://localhost:3000).

## Datos y pruebas

Next.js lee el catálogo desde PostgreSQL con un rol limitado a las dos tablas de la app. La ruta de observaciones comprueba la cookie firmada y aplica el identificador dentro de cada transacción. PostgreSQL usa ese identificador en sus políticas de nivel de fila y una clave compuesta evita duplicados.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas de navegador esperan que la aplicación esté en ejecución. Usa `NOCTURNA_BASE_URL` para cambiar el destino y `NOCTURNA_BROWSER_CHANNEL=chrome` para usar un Chrome instalado. Las pruebas cubren búsqueda, filtros, fichas, teclado, móvil, persistencia y aislamiento entre sesiones.

## Agentes de desarrollo

| Rol | Responsabilidad | Instrucciones |
| --- | --- | --- |
| Orquestador | Define el alcance, coordina las iteraciones y valida la publicación | [AGENTS.md](AGENTS.md) |
| Develop | Implementa y resuelve los hallazgos de revisión | [DEVELOP.md](agents/DEVELOP.md) |
| Testing | Verifica el cambio y decide si cumple los criterios | [DIRECTRICES.md](agents/DIRECTRICES.md) |

Los perfiles de Codex están en [`.codex/agents`](.codex/agents). Para un cambio, abre Codex en la raíz y encarga el resultado al orquestador siguiendo el flujo de `AGENTS.md`.

## Referencias y créditos

- [Hubble’s Messier Catalog](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/), referencia para el catálogo.

| Imagen | Crédito y ficha original |
| --- | --- |
| Portada · Observatorio Paranal | ESO/J. Colosimo, [ESO potw1517a](https://www.eso.org/public/images/potw1517a/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| M31 · Andrómeda | NASA/JPL-Caltech, [GALEX PIA15416](https://science.nasa.gov/photojournal/andromeda/) |
| M42 · Orión | NASA, ESA, M. Robberto (STScI/ESA) y Hubble Space Telescope Orion Treasury Project Team, [ESA/Hubble heic0601a](https://esahubble.org/images/heic0601a/) |
| M45 · Pléyades | NASA/JPL-Caltech/UCLA, [WISE PIA13121](https://science.nasa.gov/photojournal/seven-sisters-get-wise/) |
| M13 · Hércules | ESA/Hubble y NASA, [ESA/Hubble potw1011a](https://esahubble.org/images/potw1011a/) |
| M51 · Remolino | NASA, ESA, S. Beckwith (STScI) y Hubble Heritage Team (STScI/AURA), [ESA/Hubble heic0506a](https://esahubble.org/images/heic0506a/) |
| M57 · Anillo | NASA, ESA y C. Robert O’Dell (Vanderbilt University), [ESA/Hubble heic1310a](https://esahubble.org/images/heic1310a/) |

Las imágenes se sirven como WebP y su encuadre se adapta a la pantalla. [Space Grotesk](public/fonts/OFL-space-grotesk.txt), [Instrument Serif](public/fonts/OFL-instrument-serif.txt) e [Inter](public/fonts/OFL-inter.txt) se distribuyen bajo SIL Open Font License.
