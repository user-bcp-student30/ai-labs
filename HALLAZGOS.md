# Hallazgos

## auth

### Contrato observado de login

No existe `docs/ENDPOINTS.md`; lo siguiente se deriva del código de auth y no representa un contrato acordado:

- `POST /auth/login` consume y produce JSON. El request tiene `username`, `password` y `client`; `client` no se usa en el flujo observado.
- Un request nulo, username vacío/blanco o password vacío/blanco responde `400` con un mensaje específico. Credenciales no encontradas responden `401` e incluyen el username en el mensaje.
- Si autentica, responde `200` con `token`, `expiresIn` (`3600`), `user` (`username`, `displayName`, `role`) y `debug`. El token se genera codificando en Base64 username, rol, expiración y un secreto fijo; la expiración es de una hora.
- Errores inesperados responden `500` con el mensaje y el nombre de clase de la excepción.
- En el discovery inicial, la inicialización sembraba usuarios y conservaba contraseñas en texto plano. Tras resolver H-AUTH-02, la aplicación almacena hashes PBKDF2, migra las filas heredadas y autentica verificando el hash.

### Matriz de seguimiento

| id | componente | hallazgo | tipo | explicacion | evidencia (archivo:linea) | severidad | estado |
|---|---|---|---|---|---|---|---|
| H-AUTH-01 | auth | Concatenación de credenciales en SQL | Vulnerabilidad | Resuelto: la búsqueda usa `PreparedStatement` y valores enlazados, por lo que caracteres del username se tratan como datos y no como SQL. | auth/src/main/java/com/bcp/workshop/auth/LegacyDatabase.java:60-64 | alta | Resuelto |
| H-AUTH-02 | auth | Contraseñas almacenadas en texto plano | Vulnerabilidad | Pendiente tras revisión: la migración convierte las contraseñas y elimina la columna heredada en la transacción, pero si falla, `initialize()` captura la excepción y retorna normalmente. La transacción se revierte y la base conserva la columna `password` en claro, sin impedir que la aplicación continúe en estado degradado. | auth/src/main/java/com/bcp/workshop/auth/LegacyDatabase.java:34-47,87-118 | alta | Pendiente |
| H-AUTH-03 | auth | Token Base64 sin firma con secreto embebido | Vulnerabilidad | Base64 solo codifica el contenido; no aporta integridad ni autenticidad. El secreto está en el código y se concatena al token, por lo que un consumidor no puede confiar en él como credencial firmada. | auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8,12-15 | alta | APROBADO |
| H-AUTH-04 | auth | Errores exponen detalles internos | Vulnerabilidad | La respuesta `500` entrega al cliente el mensaje y la clase de excepción; los fallos de base de datos además imprimen stack traces. Esto revela detalles de implementación que pueden facilitar el reconocimiento del sistema. | auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:54-57; auth/src/main/java/com/bcp/workshop/auth/LegacyDatabase.java:27,40 | media | Pendiente |
| H-AUTH-05 | auth | Secreto y política CORS definidos de forma fija | Vulnerabilidad | El secreto del token está escrito en Java y CORS acepta cualquier origen mediante `/.*/`; el secreto no se puede rotar externamente y la política amplía innecesariamente los sitios que pueden invocar el servicio desde navegador. | auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8; auth/src/main/resources/application.properties:4-7 | media | Pendiente |
| H-AUTH-06 | auth | Advisories conocidos en dependencias resueltas | Vulnerabilidad | Assessment Maven del 2026-11-04: 49 advisories en 11 dependencias (2 críticas, 22 altas y 25 medias). Incluye CVE-2026-75595 en `io.netty:netty-handler:4.1.133.Final` y CVE-2022-42889 en `org.apache.commons:commons-text:1.9`. Son riesgos secundarios al alcance de H-AUTH-03; no se actualizaron en este cambio. | auth/target/cve-report-1.json; auth/pom.xml:44-46; `mvn -f auth/pom.xml dependency:list -DincludeScope=runtime` | crítica | CANDIDATO |
| H-AUTH-07 | auth | Resource concentra validación, persistencia, token y respuesta | Refactor | `login` valida entradas, consulta la base, genera el token y construye la respuesta en un único método con condicionales anidados; esto dificulta probar y cambiar cada responsabilidad sin efectos colaterales. | auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:24-49 | baja | Pendiente |
| H-AUTH-08 | auth | El token no refleja `client` ni todos los claims requeridos | Contrato | El request incluye `client`, pero `login` no lo pasa al servicio ni al generador del token; el token solo serializa username, rol, expiración y secreto, sin `client` ni `iat`. | auth/src/main/java/com/bcp/workshop/auth/LoginRequest.java:6; auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:35,39; auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:13-15 | media | CANDIDATO |
| H-AUTH-09 | auth | Errores de base de datos se confunden con credenciales inválidas | Disponibilidad | `findByUsername` captura `SQLException` y devuelve `null`; el servicio trata ese valor como autenticación fallida y `/auth/login` responde `401`. La inicialización también captura errores y permite continuar. | auth/src/main/java/com/bcp/workshop/auth/LegacyDatabase.java:41-47,51-56,74-77; auth/src/main/java/com/bcp/workshop/auth/AuthService.java:16-17; auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:36-37 | media | CANDIDATO |
| H-AUTH-10 | auth | `expiresIn` no se calcula desde la expiración emitida | Contrato | La respuesta fija `expiresIn` en `3600`, mientras el token calcula `exp` por separado con `Instant.now()` y precisión de segundos; el TTL anunciado puede diferir del tiempo restante y no se observa una tolerancia documentada. | auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:39-42; auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:13-15; HU-01.md:12,19 | baja | CANDIDATO |

### Candidatos de discovery

### H-AUTH-03 — El token no tiene firma criptográfica y expone el secreto embebido
- Estado: APROBADO
- Evidencia: `LegacyTokenUtil.create` concatena username, rol, expiración y el literal `WORKSHOP_SECRET_2026`, y solo codifica el resultado con Base64 (`auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:7-15`). `application.properties` no configura `AUTH_TOKEN_SECRET` (`auth/src/main/resources/application.properties:1-8`). La prueba de login solo exige un token no nulo; no comprueba integridad ni manipulación (`auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java:10-23`).
- Impacto: el valor puede decodificarse y modificarse sin una firma verificable; el secreto no se puede rotar mediante configuración y queda expuesto en cada token emitido.
- Prioridad propuesta: Alta.
- Contrato potencialmente afectado: formato, integridad y confianza del campo `token` de `POST /auth/login`; gestión del secreto indicada en HU-01.
- Cómo validarlo: decodificar un token de prueba y comprobar que contiene el secreto literal; modificar un claim y volver a codificarlo para demostrar que el formato no incluye una firma verificable. Revisar además que la configuración de producción requiera un secreto externo y que nunca se registre.

### H-AUTH-06 — Advisories conocidos en dependencias resueltas
- Estado: CANDIDATO
- Evidencia: el inventario `mvn -f auth/pom.xml dependency:list -DincludeScope=runtime` y el assessment de `auth/target/cve-report-1.json` informan 49 advisories en 11 dependencias: 2 críticas, 22 altas y 25 medias. Entre ellas, CVE-2026-75595 afecta `io.netty:netty-handler:4.1.133.Final` y CVE-2022-42889 afecta `org.apache.commons:commons-text:1.9` (`auth/pom.xml:44-46`). El assessment no reportó la extensión `quarkus-smallrye-jwt-build` ni `jose4j` entre los paquetes afectados.
- Impacto: dependencias del servicio tienen advisories conocidos; este resultado por sí solo no confirma explotabilidad en las rutas de auth.
- Prioridad propuesta: Crítica.
- Contrato potencialmente afectado: seguridad y disponibilidad del servicio; no cambia directamente el contrato HTTP observado.
- Cómo validarlo: revisar cada advisory y su alcance de uso, acordar actualización en un issue aprobado, aplicar las versiones corregidas compatibles y repetir el assessment y `python tools/lab.py test auth`.

### H-AUTH-08 — El token no refleja `client` ni todos los claims requeridos
- Estado: CANDIDATO
- Evidencia: `LoginRequest` define `client` (línea 6), pero `AuthResource.login` solo pasa username y password a `AuthService` y crea el token con username y rol (`AuthResource.java:35,39`). `LegacyTokenUtil` serializa username, rol, expiración y secreto, sin `client` ni `iat` (`LegacyTokenUtil.java:13-15`). HU-01 requiere `sub`, `client`, `iat` y `exp` y que `client` venga de la solicitud (`HU-01.md:10-11,18`).
- Impacto: el token no puede identificar el cliente que originó el login ni cumplir el contrato de claims indicado en HU-01.
- Prioridad propuesta: Media.
- Contrato potencialmente afectado: `POST /auth/login`, contenido de `token` y validación de `client` definida por HU-01.
- Cómo validarlo: agregar una prueba de integración con distintos valores de `client`; decodificar/verificar el token y comprobar `sub`, `client`, `iat` y `exp`, además del rechazo de un `client` inválido. Ejecutar `python tools/lab.py test auth`.

### H-AUTH-09 — Errores de base de datos se confunden con credenciales inválidas
- Estado: CANDIDATO
- Evidencia: `LegacyDatabase.findByUsername` captura `SQLException` y devuelve `null` (`LegacyDatabase.java:51-56,74-77`); `AuthService.authenticate` usa `null` para el caso de usuario inexistente o password incorrecto (`AuthService.java:16-17`), y `AuthResource.login` convierte ese resultado en `401` (`AuthResource.java:36-37`). También se captura y solo se imprime cualquier excepción de inicialización (`LegacyDatabase.java:41-47`).
- Impacto: una caída, esquema inválido o error de almacenamiento puede presentarse al cliente como credenciales inválidas, ocultando una falla del servicio y dificultando su diagnóstico.
- Prioridad propuesta: Media.
- Contrato potencialmente afectado: códigos de respuesta de `POST /auth/login` ante errores internos de persistencia.
- Cómo validarlo: en una prueba aislada, configurar una base SQLite con tabla/esquema inválido y comprobar que el error de persistencia no termina como `401`; comprobar también que un fallo de inicialización impide aceptar el servicio como listo. Ejecutar `python tools/lab.py test auth`.

### H-AUTH-10 — `expiresIn` no se calcula desde la expiración emitida
- Estado: CANDIDATO
- Evidencia: `AuthResource.login` responde el valor fijo `3600` (`AuthResource.java:42`), mientras `LegacyTokenUtil.create` calcula la expiración por separado desde `Instant.now()` y la trunca a segundos (`LegacyTokenUtil.java:13-15`). HU-01 exige coherencia entre `expiresIn` y `exp - now` dentro de una tolerancia documentada (`HU-01.md:12,19`).
- Impacto: clientes que programen renovación o expiración usando `expiresIn` pueden observar una discrepancia con el tiempo realmente restante; no se encontró una tolerancia acordada para esa diferencia.
- Prioridad propuesta: Baja.
- Contrato potencialmente afectado: campo `expiresIn` de `POST /auth/login` respecto de la expiración del token.
- Cómo validarlo: probar el token emitido y comparar su expiración con `expiresIn` desde el instante de emisión, fijando y documentando una tolerancia; ejecutar `python tools/lab.py test auth`.
