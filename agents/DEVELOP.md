# Develop

Antes de escribir código, lee [las directrices de Testing](DIRECTRICES.md) y confirma los criterios de aceptación del cambio.

- Mantén App Router, TypeScript estricto y componentes de servidor como punto de partida. Usa componentes de cliente para la interacción que necesite estado o eventos.
- Mantén el acceso a Supabase y la identidad de la lista guardada en el servidor. Valida la entrada de las rutas y evita exponer datos de otra sesión.
- Mantén el atlas accesible en pantalla estrecha, con teclado y con preferencias de movimiento reducido. Proporciona estados vacíos y de error con acciones comprensibles.
- Ejecuta lint, tipos, pruebas y compilación. Devuelve las rutas cambiadas, qué comprobaste y qué depende de un entorno remoto.
- Cuando Testing señale un fallo, reproduce el caso, corrige su causa y devuelve los comandos o pasos para repetirlo. Espera la siguiente revisión antes de declarar el cambio finalizado.
