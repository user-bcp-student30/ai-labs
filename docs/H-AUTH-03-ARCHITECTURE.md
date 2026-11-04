# Decisión de arquitectura: H-AUTH-03

## Impacto

El cambio reemplaza el formato Base64 sin firma por un token con integridad y origen verificables, usando una clave suministrada fuera del código. El impacto funcional debe quedar acotado a la emisión del token; el login, la autenticación y la respuesta HTTP observable se conservan. El cambio de formato interno puede afectar a consumidores aunque la respuesta siga exponiendo el mismo campo `token`.

## Componentes afectados

- `auth/src/main/java/com/bcp/workshop/auth/LegacyTokenUtil.java`: dejará de emitir el formato Base64 heredado.
- `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java`: delegará la emisión; no cambiará la validación ni el formato de respuesta.
- Un emisor acotado de tokens en auth: encapsulará la biblioteca y la configuración criptográfica para no acoplar el Resource a detalles JWT.
- `auth/src/main/resources/application.properties`: declarará la referencia a configuración externa, sin incluir valores secretos.
- `auth/pom.xml`: podría incorporar una extensión Quarkus de construcción/verificación JWT si el árbol Maven confirma que no está ya disponible.
- `auth/src/test/java/com/bcp/workshop/auth/`: pruebas focalizadas del emisor y regresión HTTP.

`AuthService` y `LegacyDatabase` quedan fuera del cambio: autenticación y persistencia no necesitan variar para emitir el token.

## Contratos protegidos

- `POST /auth/login`: conservar request, ruta, validaciones y códigos HTTP observados.
- Login correcto: HTTP 200 y mismos campos y estructura pública (`token`, `expiresIn`, `user`, `debug`), manteniendo `expiresIn: 3600` y los datos actuales de `user`.
- Credenciales incorrectas: HTTP 401 con el formato observado.
- El formato interno de `token` sí cambia. No implementar hasta confirmar con sus consumidores que lo tratan como opaco y pueden verificar el nuevo formato firmado.
- No añadir ni validar `client` como claim en este cambio; H-AUTH-08 está fuera del alcance aprobado.

## Estrategia incremental

1. Se aprobó cambiar el formato interno del token para H-AUTH-03. No modificar consumidores fuera del alcance auth; su interoperabilidad queda como riesgo residual a validar en una revisión coordinada.
2. Añadir o completar caracterización HTTP del login correcto, inválido y entradas malformadas; registrar la respuesta actual antes de alterar emisión.
3. Confirmar en el árbol Maven si Quarkus ya aporta capacidad JWT. Si no, usar una extensión compatible con la versión Quarkus del proyecto y gestionada por su BOM; no implementar firma ni serialización criptográfica propia.
4. Introducir un emisor pequeño con RS256; usar claims `sub`, `role`, `iat` y `exp`, con `exp - iat = 3600`. Leer la clave privada PEM desde un archivo externo señalado por `AUTH_TOKEN_SIGNING_KEY_LOCATION`; no incluirla en el repositorio ni devolverla.
5. Verificar token, configuración y regresión HTTP. Revisar dependencias/SCA y cobertura del código modificado antes de preparar el borrador de PR.

### Decisión adoptada

- **Contexto:** la emisión está en una utilidad estática local; auth no declara soporte JWT y Base64 no protege el contenido.
- **Opciones consideradas:** continuar con formato propio y firma manual; incorporar una extensión JWT compatible con Quarkus y aislarla detrás de un emisor; cambiar el contrato público de login para entregar otro formato/campo.
- **Decisión:** usar la extensión Quarkus SmallRye JWT Build, encapsulada en `TokenService`, y firmar con RS256 usando una clave privada PEM externa. Los claims son `sub`, `role`, `iat` y `exp`; `client` permanece fuera de alcance. Sin clave configurada no se permite emitir un token. Se preserva el contrato HTTP existente.
- **Aprobación:** el usuario aprobó todo el alcance H-AUTH-03 el 2026-11-04.
- **Consecuencias:** el acoplamiento a la biblioteca queda aislado; la dependencia queda gestionada por el BOM y requiere revisión SCA; consumidores que interpretaban el formato Base64 anterior deberán aceptar el JWT firmado.

## Pruebas necesarias

- Caracterización previa del login: HTTP 200 con todos los campos y valores actuales; HTTP 401 para credenciales inválidas; HTTP 400 para las entradas vacías/blancas y nulas observadas.
- Emisión: verificar criptográficamente el token con la clave configurada y comprobar claims de identidad, rol y expiración según los nombres acordados.
- Integridad: alterar contenido o firma y comprobar que la verificación falla.
- Clave: comprobar que tokens nuevos requieren la clave configurada y que una clave distinta no los valida; comprobar el manejo acordado de clave ausente o inválida.
- No exposición: comprobar que clave y token no aparecen en logs ni como campos adicionales de respuesta.
- Regresión: repetir los casos HTTP y verificar que permanecen la forma de respuesta y `expiresIn: 3600`.
- Quality gate: ejecutar `python tools/lab.py test auth` y confirmar cobertura de al menos 85% del código modificado; revisar la nueva dependencia con SCA si se agrega.

## Riesgos / trade-offs

- **Compatibilidad:** conservar el campo `token` no garantiza que consumidores acepten un nuevo formato. La coordinación externa es requisito previo.
- **Clave:** RS256 evita distribuir capacidad de firma a verificadores, pero la clave pública correspondiente debe llegar a los consumidores autorizados por un canal coordinado.
- **Disponibilidad/configuración:** la ubicación de clave es obligatoria y no tiene fallback. La lectura de una ruta inválida debe fallar la emisión; no se debe devolver ni registrar el material secreto.
- **Dependencia:** la extensión se resuelve en Quarkus 3.27.4; el assessment encontró advisories en Jackson, Netty, Quarkus HTTP y Commons Text. Se registran bajo H-AUTH-06 y no se remediaron en este alcance.
- **Trazabilidad:** la spec registra H-AUTH-03 como aprobado en `PLAN.md`, mientras la matriz vigente de `HALLAZGOS.md` lo marca `CANDIDATO`; confirmar el estado canónico antes de abrir implementación.
- **Alcance:** no se revisaron consumidores de otros componentes; no afirmar compatibilidad hasta que sus responsables la confirmen.

## Decisiones abiertas

- ¿Cómo se coordina la distribución de la clave pública RS256 y la migración de consumidores del formato anterior?
- ¿Qué tolerancia de expiración aplicarán los consumidores al validar `exp`?
