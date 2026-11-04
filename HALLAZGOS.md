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
| H-AUTH-03 | auth | Token Base64 sin firma con secreto embebido | Vulnerabilidad | Base64 solo codifica el contenido; no aporta integridad ni autenticidad. El secreto está en el código y se concatena al token, por lo que un consumidor no puede confiar en él como credencial firmada. | auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8,12-15 | alta | Pendiente |
| H-AUTH-04 | auth | Errores exponen detalles internos | Vulnerabilidad | La respuesta `500` entrega al cliente el mensaje y la clase de excepción; los fallos de base de datos además imprimen stack traces. Esto revela detalles de implementación que pueden facilitar el reconocimiento del sistema. | auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:54-57; auth/src/main/java/com/bcp/workshop/auth/LegacyDatabase.java:27,40 | media | Pendiente |
| H-AUTH-05 | auth | Secreto y política CORS definidos de forma fija | Vulnerabilidad | El secreto del token está escrito en Java y CORS acepta cualquier origen mediante `/.*/`; el secreto no se puede rotar externamente y la política amplía innecesariamente los sitios que pueden invocar el servicio desde navegador. | auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java:8; auth/src/main/resources/application.properties:4-7 | media | Pendiente |
| H-AUTH-06 | auth | Versiones de dependencias candidatas a revisión SCA | Sugerencia | El build fija Quarkus `3.27.4` y Commons Text `1.9`. Las versiones están confirmadas en el manifiesto, pero este discovery no verificó advisories ni confirma por sí solo un CVE; queda pendiente la evaluación SCA. | auth/pom.xml:13,47-50 | media | Pendiente |
| H-AUTH-07 | auth | Resource concentra validación, persistencia, token y respuesta | Refactor | `login` valida entradas, consulta la base, genera el token y construye la respuesta en un único método con condicionales anidados; esto dificulta probar y cambiar cada responsabilidad sin efectos colaterales. | auth/src/main/java/com/bcp/workshop/auth/AuthResource.java:24-49 | baja | Pendiente |
