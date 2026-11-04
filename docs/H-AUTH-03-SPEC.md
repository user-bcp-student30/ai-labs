# Token firmado con secreto externo

## Fuente

- Hallazgo aprobado: H-AUTH-03, “Token Base64 sin firma con secreto embebido”. `PLAN.md` registra la aprobación humana del alcance H-AUTH-01, H-AUTH-02 y H-AUTH-03 el 2026-11-02.
- Evidencia: `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:7-15` concatena username, rol, expiración y el secreto literal `WORKSHOP_SECRET_2026`, y codifica el resultado con Base64. `auth/src/main/resources/application.properties:1-8` no define `AUTH_TOKEN_SECRET`.
- Impacto: Base64 no aporta integridad ni autenticidad; el contenido y el secreto se pueden recuperar, por lo que un consumidor no puede confiar en los claims del token.

## Contexto actual

`POST /auth/login` emite un token Base64 cuyo contenido incluye username, rol, expiración y un secreto fijo. La respuesta anuncia `expiresIn: 3600`. La prueba de login comprueba que el token no sea nulo, pero no verifica su integridad ni su expiración.

## Problema confirmado

El token no ofrece un mecanismo criptográfico para verificar su origen o detectar modificaciones, y el secreto de emisión está embebido en el código y en el contenido decodificable del token.

## Comportamiento a preservar

- El endpoint `POST /auth/login`, sus validaciones y los resultados observados para login válido e inválido.
- Para credenciales válidas: HTTP 200 y los campos públicos actuales `token`, `expiresIn`, `user` y `debug`; mantener los datos y la forma de `user` y `expiresIn: 3600`.
- Para credenciales inválidas: HTTP 401 con el formato de respuesta existente.
- La autenticación y las cuentas ficticias existentes deben seguir funcionando.

## Alcance

- El token emitido debe permitir verificar criptográficamente su integridad y origen.
- Debe representar explícitamente la identidad, el rol y la expiración de una hora aprobados en el plan.
- La clave de emisión debe provenir de configuración externa, no estar codificada en el código ni exponerse en la respuesta o en registros.
- Las pruebas deben comprobar validación del token, rechazo de una modificación y expiración conforme al plazo acordado.

## Fuera de alcance

- Cambiar la ruta, el formato de la respuesta o los códigos existentes de `POST /auth/login`.
- Cambiar CORS, el manejo de errores o la persistencia de credenciales.
- Añadir claims o validaciones para `client`; ese comportamiento corresponde a H-AUTH-08, que no forma parte de este alcance aprobado.
- Elegir una biblioteca, algoritmo o estructura interna de clases; son decisiones de diseño posteriores.

## Criterios de aceptación

- Con credenciales válidas, `POST /auth/login` conserva HTTP 200 y la forma actual de la respuesta, incluido `expiresIn: 3600`.
- El token contiene claims verificables que representan identidad, rol y expiración de una hora.
- La verificación con la clave configurada externamente acepta el token emitido y rechaza el token si se modifica su contenido o firma.
- Cambiar la clave externa cambia la clave requerida para verificar tokens nuevos; la clave no aparece en el código ni en la respuesta.
- Las credenciales inválidas mantienen HTTP 401 y las validaciones de entrada mantienen su comportamiento HTTP 400 observado.
- Las pruebas no registran tokens ni claves y comprueban que no se filtran en la salida de la aplicación.

## Contratos afectados/protegidos

- Protegido: `POST /auth/login`; mantener request, endpoint, códigos HTTP y respuesta observada. No cambiar el campo público `token`, `expiresIn`, `user` ni `debug`.
- El formato interno del token cambiará. `PLAN.md` condiciona ese cambio a confirmar que los consumidores tratan el token como opaco y pueden verificar el nuevo formato firmado; esa compatibilidad debe resolverse antes de implementarlo.
- No existe `docs/ENDPOINTS.md` según `PLAN.md`; el contrato protegido aquí se basa en el comportamiento observado y documentado en `HALLAZGOS.md` y `PLAN.md`, no en un contrato publicado.

## Riesgos, supuestos y preguntas abiertas

- `PLAN.md` registra H-AUTH-03 dentro del plan aprobado; la matriz actual de `HALLAZGOS.md` lo marca `CANDIDATO`. Confirmar cuál es el estado de seguimiento canónico durante la revisión humana.
- Sigue pendiente confirmar con los consumidores que el token es opaco y que podrán validar el formato firmado antes de cambiar su representación.
- Acordar los nombres exactos de los claims y la tolerancia temporal para comprobar la expiración; esta spec no incorpora los claims de `client` porque H-AUTH-08 no está aprobado en este alcance.
- Definir qué debe ocurrir si la clave externa falta o es inválida, antes de convertirlo en criterio de comportamiento.