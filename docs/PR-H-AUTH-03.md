# Draft PR: H-AUTH-03, token firmado

**Estado:** borrador local para revisión. No se creó ni publicó un PR remoto; las reglas del Día 1 mantienen el trabajo en ramas locales.

## Qué cambia y por qué

Reemplaza el token Base64 con secreto embebido por un JWT RS256 emitido mediante `quarkus-smallrye-jwt-build` 3.27.4. `TokenService` emite `sub`, `role`, `iat` y `exp` con duración de 3600 segundos. La clave privada PEM se obtiene de `AUTH_TOKEN_SIGNING_KEY_LOCATION`; Compose la monta como secret desde `AUTH_TOKEN_SIGNING_KEY_FILE`. No se añade una clave real ni un fallback.

## Qué se preserva

`POST /auth/login`, request, validaciones, códigos observados y la forma de respuesta `token`, `expiresIn`, `user` y `debug`. El login correcto sigue anunciando `expiresIn: 3600`; las credenciales inválidas conservan HTTP 401. El claim `client` permanece fuera de alcance, según H-AUTH-08.

## Evidencia de validación

- Baseline previa: `python tools/lab.py test auth` — PASS, 10 pruebas.
- Caracterización antes del cambio: `mvn -f auth/pom.xml -Dtest=AuthResourceTest test` — 2 aserciones nuevas fallaron como se esperaba porque el token heredado tenía un solo segmento.
- Prueba focalizada posterior: `mvn -f auth/pom.xml -Dtest=AuthResourceTest test` — PASS, 5 pruebas; verifica RS256, `sub`, `role`, `iat`, `exp`, duración de una hora y rechazo de firma alterada.
- Regresión: `python tools/lab.py test auth` — PASS, 12 pruebas; `mvn -f auth/pom.xml clean verify` — PASS, 12 pruebas.
- JaCoCo tras `clean verify`: `AuthResource` 25/25 líneas; `TokenService` y `IssuedToken` 11/11; total de producción modificada 36/36 líneas (100%).
- `mvn dependency:tree` resuelve `quarkus-smallrye-jwt-build:3.27.4` mediante el BOM.
- Búsqueda en `auth/src/main` no encuentra `WORKSHOP_SECRET_2026` ni `LegacyTokenUtil`.
- La generación y lectura del PEM de ejemplo PowerShell se probó con una clave sintética temporal; el archivo se eliminó.

## Gates y límites

- **CUMPLIDO** — Pruebas y cobertura del componente auth.
- **CUMPLIDO** — Clave privada fuera del repositorio; Compose requiere una ruta explícita y no define valor predeterminado.
- **BLOQUEADO** — El assessment de 129 dependencias resueltas informó 49 advisories en 11 paquetes: 2 críticos, 22 altos y 25 medios. Incluye CVE-2026-75595 en `netty-handler:4.1.133.Final` y CVE-2022-42889 en `commons-text:1.9`. No se remediaron porque son dependencias secundarias fuera del alcance aprobado; H-AUTH-06 queda como candidato. El detalle temporal está en `auth/target/cve-report-1.json`.
- **FALTA EVIDENCIA** — `docker compose config` y smoke test de Compose: Docker no está instalado en este entorno.
- **PENDIENTE DE OTRO GATE** — Compatibilidad de consumidores y distribución de la clave pública RS256. No se leyeron ni cambiaron otros componentes; no afirmar integración completa.
- **FALTA EVIDENCIA** — CodeQL y Dependency Review remotos no se ejecutaron en este recorrido local.

## Riesgos y rollback

Cambió el formato interno de `token`; los consumidores que analizaban el formato Base64 deben migrar a JWT y obtener la clave pública. Una reversión completa requiere coordinar consumidores y revertir juntos código, dependencia, configuración y montaje Compose. Volver a la emisión Base64 reintroduce el hallazgo de seguridad y requiere aprobación explícita de ese riesgo.

## Revisión solicitada

Revisar el diff local, coordinar interoperabilidad con consumidores y resolver el gate de H-AUTH-06 antes de publicar o integrar. No se hizo commit, push ni merge.
