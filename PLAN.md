# Plan

## auth

### Alcance y contrato a preservar

Este plan cubre únicamente H-AUTH-01, H-AUTH-02 y H-AUTH-03. H-AUTH-01 está resuelto, H-AUTH-02 sigue pendiente y H-AUTH-03 está aprobado en `HALLAZGOS.md`. No existe `docs/ENDPOINTS.md`; se toma como referencia el contrato observado allí: `POST /auth/login`, sus validaciones y códigos HTTP, y la respuesta exitosa con `token`, `expiresIn` de `3600`, `user` y `debug`. Se conservarán el endpoint, los campos de respuesta, la expiración de una hora y el comportamiento de autenticación válida e inválida.

La representación interna del token debe cambiar para que sea verificable. Como no hay contrato acordado que documente cómo lo interpretan los consumidores, confirmar con sus responsables que tratan el token como opaco y acuerdan verificar el formato firmado antes de implementar. Esa coordinación no amplía el alcance de lectura o cambios de este plan.

Las pruebas de caracterización descritas abajo se ejecutaron antes de modificar código. Las pruebas posteriores de seguridad verifican los nuevos invariantes; los resultados reales se registran al final de este plan.

### H-AUTH-01 — Concatenación de credenciales en SQL

- **Hallazgo:** H-AUTH-01, “Concatenación de credenciales en SQL”, estado `Pendiente` en `HALLAZGOS.md`.
- **Problema:** `LegacyDatabase.findByCredentials` interpola username y password en la consulta. La entrada puede alterar la sintaxis y el resultado de autenticación.
- **Cambio propuesto:** sustituir `Statement` por `PreparedStatement`, con parámetros para username y password. Mantener el comportamiento de autenticación válido/inválido y el mapeo de usuario existente; no ampliar este cambio al manejo de errores de H-AUTH-04.
- **Archivos a tocar:** `auth/src/main/java/com/bcp/workshop/auth/LegacyDatabase.java`; `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java`; y, si las pruebas del repositorio requieren aislamiento, una prueba nueva en `auth/src/test/java/com/bcp/workshop/auth/`.
- **Caracterización antes de editar:** ampliar las pruebas HTTP para fijar que el usuario ficticio válido continúa respondiendo `200` con sus datos de usuario y que credenciales incorrectas responden `401` con el formato observado. Ejecutar estas pruebas contra la implementación actual antes de modificar `LegacyDatabase`.
- **Verificación posterior:** agregar una prueba aislada de persistencia que confirme que valores con caracteres especiales se tratan como valores literales, no como parte de la consulta; repetir los casos HTTP y comprobar que la consulta no concatena entradas.

### H-AUTH-02 — Contraseñas almacenadas en texto plano

- **Hallazgo:** H-AUTH-02, “Contraseñas almacenadas en texto plano”, estado `Pendiente` en `HALLAZGOS.md`.
- **Problema:** el esquema y las cuentas sembradas almacenan contraseñas legibles; la consulta compara directamente el valor recibido con la columna. Una copia de la base expone las credenciales.
- **Cambio propuesto:** usar un hash lento con salt individual (por ejemplo, BCrypt, como recomienda `docs/GOOD_PRACTICES.md`) y comparar mediante una operación de verificación, nunca leyendo la contraseña en claro desde la base. Se usará `PBKDF2WithHmacSHA256` mediante la API criptográfica estándar del JDK, sin implementar el algoritmo ni agregar dependencia. Incluir una migración única y transaccional de las filas existentes en texto plano para evitar bloquear los usuarios ya sembrados o volver a hashear filas en cada inicio. Mantener las cuentas ficticias autenticables y no registrar contraseñas ni hashes.
- **Archivos a tocar:** `auth/src/main/java/com/bcp/workshop/auth/LegacyDatabase.java`; `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java` y una capa de servicio acotada para verificar credenciales; `auth/src/main/java/com/bcp/workshop/auth/UserRecord.java` o un tipo interno específico para credenciales persistidas, sin exponer el hash en la respuesta; pruebas nuevas de hash/migración y `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java`. Se permite `auth/src/test/resources/application.properties` para aislar la base SQLite del perfil de pruebas, sin alterar la configuración de producción.
- **Caracterización antes de editar:** fijar mediante pruebas HTTP que las cuentas ficticias actuales autentican con `200`, que una contraseña incorrecta responde `401` y que la respuesta exitosa conserva exactamente los campos y datos públicos observados. Ejecutarlas antes de cambiar esquema o verificación.
- **Verificación posterior:** comprobar que el hash almacenado no coincide con la contraseña, que sales distintos producen hashes distintos, que la verificación correcta/fallida se comporta como se espera, que una fila heredada se migra una sola vez y que las cuentas siguen autenticando sin exponer hash ni contraseña en la respuesta.

### H-AUTH-03 — Token Base64 sin firma con secreto embebido

- **Hallazgo:** H-AUTH-03, “Token Base64 sin firma con secreto embebido”, estado `APROBADO` en `HALLAZGOS.md`.
- **Problema:** Base64 no ofrece integridad ni autenticidad. El contenido y el secreto fijo son recuperables, por lo que un consumidor no puede confiar en que los claims provienen del servicio.
- **Cambio propuesto:** emitir un token estándar firmado con claims explícitos de identidad/rol y expiración de una hora. Usar soporte JWT mantenido compatible con Quarkus, no criptografía casera. La clave de firma se suministrará externamente (por configuración segura o montaje de secreto), nunca desde el código. Preservar el campo público `token`, `expiresIn: 3600` y el resto de la respuesta observada. Agregar la dependencia de emisión solo si la revisión del árbol Maven confirma que no está disponible ya; justificarla por la firma/claims estándar, gestionarla con el BOM de Quarkus y revisarla con SCA. No modificar la política CORS de H-AUTH-05 en este alcance.
- **Archivos a tocar:** `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java` o su reemplazo de emisión; `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java` y la capa de servicio acotada si la emisión se extrae de Resource; `auth/src/main/resources/application.properties` para la configuración externa de la clave; `auth/pom.xml` solo si se aprueba la dependencia; pruebas de token y `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java`.
- **Caracterización antes de editar:** extender la prueba HTTP de login exitoso para fijar el status `200`, la presencia de `token`, `expiresIn: 3600`, `user` y `debug`, además de los datos públicos del usuario. Mantener la prueba de credenciales inválidas en `401`. Ejecutar ambas antes de reemplazar la implementación del token.
- **Verificación posterior:** verificar que el token se valida con la clave correspondiente, contiene los claims previstos y expira a la hora; comprobar que una modificación del token invalida su firma. Repetir las pruebas HTTP y confirmar que la forma de la respuesta no cambió.

### Secuencia y dependencias

1. Añadir y ejecutar primero las pruebas de caracterización HTTP para los tres hallazgos, sin cambiar el código productivo.
2. Implementar H-AUTH-01; ejecutar sus pruebas de repositorio y las pruebas HTTP de caracterización.
3. Implementar H-AUTH-02 con migración segura de datos existentes; revisar cualquier dependencia antes de incorporarla y ejecutar pruebas de hash, migración y login.
4. Implementar H-AUTH-03 con formato JWT firmado y clave externa. La revisión de consumidores y la distribución de la clave pública quedan como evidencia de integración pendiente; este cambio no modifica componentes fuera de auth.
5. Revisar cambios, dependencias y cobertura del código modificado; no cambiar el contrato observado. Actualizar los estados de `HALLAZGOS.md` solo con evidencia real después de implementación y revisión.

La extracción de responsabilidades se limitará a lo necesario para verificar contraseñas y emitir tokens con claridad; H-AUTH-07 y los demás hallazgos de auth quedan fuera de este plan y no se marcan como resueltos.

### Aprobación humana

- 2026-11-02: el usuario aprobó este plan para H-AUTH-01, H-AUTH-02 y H-AUTH-03 mediante el mensaje “Aprobar PLAN.md”.
- 2026-11-04: el usuario aprobó todo el alcance de H-AUTH-03. La decisión aplicada es JWT RS256 con claims `sub`, `role`, `iat` y `exp`, clave privada PEM externa y sin claim `client`.
- La compatibilidad de consumidores y la distribución de la clave pública siguen pendientes de validación coordinada; no se cambió código de otros componentes.

### Registro de ejecuciones

- auth — H-AUTH-01, H-AUTH-02, H-AUTH-03: caracterización previa; `Set-Location auth; mvn test` — PASS (2 pruebas, 0 fallos/errores), 2026-11-02. Se comprobó el login válido, los campos de respuesta observados, `expiresIn` de una hora y el rechazo de contraseña incorrecta antes de modificar código productivo.
- auth — H-AUTH-01: primera verificación posterior con `Set-Location auth; mvn test` — FAIL (2 pruebas HTTP pasaron; la nueva prueba aislada no encontró el driver SQLite). La prueba se ajustará para cargar explícitamente el driver antes de reejecutar.
- auth — H-AUTH-01: `Set-Location auth; mvn test` — PASS (3 pruebas, 0 fallos/errores) tras cargar explícitamente el controlador en la prueba aislada; la búsqueda parametrizada y la caracterización HTTP pasan.
- auth — H-AUTH-02: `Set-Location auth; mvn test` — PASS (6 pruebas, 0 fallos/errores); login, migración de contraseña, hash individual y consulta parametrizada pasan.
- auth — H-AUTH-02: `Set-Location auth; mvn verify` — PASS (6 pruebas, 0 fallos/errores), pero la cobertura de clase de `LegacyDatabase` fue 78/94 líneas (83%), bajo la meta de 85%. Se añadieron pruebas de ramas no cubiertas y se volverá a medir antes del cierre.
- auth — H-AUTH-01, H-AUTH-02: `Set-Location auth; mvn verify` — PASS (10 pruebas, 0 fallos/errores), 2026-11-02. JaCoCo: clases Java modificadas 156/169 líneas (92.31%); supera la meta de 85%. La prueba cubre contrato HTTP, SQL parametrizado con username con comilla, migración transaccional/idempotente, PBKDF2 con salt y rechazo de hash inválido.
- auth — H-AUTH-01, H-AUTH-02: CodeQL remoto y Dependency Review remoto — no ejecutados; recorrido local.
- auth — H-AUTH-01, H-AUTH-02: revisión local de `git diff main -- auth/` y archivos nuevos; `Set-Location auth; mvn verify` — PASS (10 pruebas, 0 fallos/errores), 2026-11-02. JaCoCo actualizado para las clases modificadas: 149/169 líneas (88.17%), sobre 85%. H-AUTH-01 verificado como Resuelto. H-AUTH-02 regresa a Pendiente: `LegacyDatabase.initialize()` captura y no propaga fallos de migración (líneas 41-47), por lo que la transacción revierte los cambios pero la aplicación sigue inicializando con la base heredada.
- auth — H-AUTH-03: baseline `python tools/lab.py test auth` — PASS (10 pruebas, 0 fallos/errores), 2026-11-04.
- auth — H-AUTH-03: caracterización nueva `mvn -f auth/pom.xml -Dtest=AuthResourceTest test` antes del cambio — FAIL esperado en 2 aserciones: el token heredado era un único segmento, no JWT firmado.
- auth — H-AUTH-03: `mvn -f auth/pom.xml -Dtest=AuthResourceTest test` posterior — PASS (5 pruebas, 0 fallos/errores); verifica RS256, `sub`, `role`, `iat`, `exp`, duración de una hora y rechazo de firma alterada.
- auth — H-AUTH-03: `python tools/lab.py test auth` — PASS (12 pruebas, 0 fallos/errores). `mvn -f auth/pom.xml clean verify` — PASS (12 pruebas, 0 fallos/errores). JaCoCo: `AuthResource` 25/25 y `TokenService` más record 11/11 líneas (36/36, 100%).
- auth — H-AUTH-03: dependencias resueltas `mvn -f auth/pom.xml dependency:list -DincludeScope=runtime`; `appmod-cve-assessment` del 2026-11-04 reporta 49 advisories en 11 dependencias: 2 críticas, 22 altas y 25 medias. H-AUTH-06 queda como candidato; no se actualizaron dependencias fuera del alcance aprobado.
- auth — H-AUTH-03: validación `docker compose config` no ejecutada porque Docker no está instalado en el entorno.
