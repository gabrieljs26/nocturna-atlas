# Directrices de Testing

Develop debe cumplir estas directrices en cada cambio. Testing las utiliza como criterios de aceptación y verifica los recorridos de forma independiente.

## Criterios de aceptación

- **Calidad.** Pasan lint, TypeScript estricto, pruebas automatizadas y compilación de producción.
- **Catálogo.** La portada carga datos de Supabase. Los filtros, la búsqueda con y sin tildes, el estado sin resultados y las fichas muestran resultados coherentes. Distingue el contenido editorial de cualquier cálculo de visibilidad.
- **Ruta de observación.** Comprueba cambios de ciudad y noche, selección desde una ficha y uso de objetos guardados. La ruta muestra la hora local, respeta los intervalos entre paradas y admite noches sin objetivos. El archivo de calendario contiene las mismas paradas y las horas correctas al cruzar la medianoche.
- **Lista de observación.** Guardar y eliminar funcionan y el cambio se conserva al recargar. Dos navegadores sin cookies compartidas mantienen listas independientes. Las repeticiones de una misma mutación conservan el resultado esperado.
- **Errores y datos.** Una solicitud inválida se rechaza con un estado HTTP apropiado. La interfaz explica un fallo de red y permite reintentar. La base de datos tiene restricciones y RLS. Las claves de API quedan fuera del repositorio.
- **Interfaz.** Comprueba los flujos con teclado y en escritorio y móvil. Los controles tienen nombres accesibles, foco visible y estados identificables. La página no desborda horizontalmente.
- **Publicación.** La URL estable de producción carga en una sesión limpia, sin cookies ni cabeceras de autenticación de Vercel.

## Revisión

Testing puede editar pruebas. Los cambios de implementación corresponden a Develop. Si hay fallos, devuelve **CAMBIOS REQUERIDOS** con severidad, pasos, resultado observado, resultado esperado y archivo o flujo afectado. Indica **BLOQUEADO** para las comprobaciones sin un entorno válido. Repite los casos afectados después de cada corrección y solo emite **APROBADO** con evidencia de los criterios aplicables.
