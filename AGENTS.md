# Orquestación de Nocturna

Nocturna es un atlas de observación astronómica en español. El agente principal delimita cada cambio, coordina la implementación y decide cuándo una revisión está lista para publicarse.

## Flujo de trabajo

1. Define el resultado esperado, los criterios de aceptación, los archivos implicados y el entorno en el que se debe verificar.
2. Delega la implementación a **Develop**. Incluye las rutas de [Develop](agents/DEVELOP.md) y de las [directrices de Testing](agents/DIRECTRICES.md).
3. Entrega a **Testing** el cambio y las comprobaciones de Develop. Pide que reproduzca los flujos de forma independiente y devuelva su dictamen con evidencia.
4. Devuelve cada fallo de Testing a Develop con su reproducción. Haz que Testing verifique la corrección y las regresiones asociadas. Repite hasta que el dictamen sea **APROBADO**.
5. Integra, documenta y verifica producción con una sesión nueva y sin autenticación de Vercel. Si alguna prueba queda bloqueada, registra qué falta y conserva ese estado en el informe.

Develop es responsable de la implementación. Testing es responsable de las pruebas y del dictamen. El orquestador controla la configuración remota y las publicaciones. Usa una rama o un ámbito de archivos distinto si hay trabajo en paralelo.
