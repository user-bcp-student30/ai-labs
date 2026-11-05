# Design

## Context

Ver motivación en [proposal.md](proposal.md) sección "Por qué".

Estado actual relevante en `auth/`:
- El endpoint `POST /auth/login` está expuesto por `AuthResource` y delega autenticación a `AuthService`.
- `AuthService` consulta usuario por nombre y verifica contraseña con hash.
- `LegacyDatabase` actualmente usa consultas parametrizadas en `findByUsername`.
- Las pruebas de integración (`AuthResourceTest`) ya validan login exitoso, password incorrecto y validaciones 400 para request nulo/campos en blanco.

Restricciones y observaciones:
- Alcance acotado al componente `auth/` y al Issue #21.
- Debe preservarse el contrato observable de `POST /auth/login`.
- `docs/ENDPOINTS.md` no está disponible en este checkout; el baseline observable se toma de la spec del cambio y de las pruebas actuales.
- El issue refiere `findByCredentials`, método no presente en el estado actual (existe `findByUsername`).

## Goals / Non-Goals

**Goals:**
- Evitar bypass de autenticación ante payloads tipo inyección en username/password.
- Mantener inalterado el contrato de respuesta para casos exitosos y fallidos definidos en la spec `auth-login`.
- Dejar evidencia automatizada de comportamiento crítico antes y después del cambio.

**Non-Goals:**
- Rediseñar autenticación completa, tokenización o esquema de datos.
- Cambiar contratos de `api/` o `web/`.
- Introducir nuevas dependencias de seguridad o migraciones amplias de persistencia.

## Contratos protegidos

- Ruta y método: `POST /auth/login`.
- Caso exitoso: HTTP 200 con `token`, `expiresIn`, `user.username`, `user.displayName`, `user.role`, `debug`.
- Caso credenciales inválidas: HTTP 401 sin token.
- Caso request inválido (nulo/campos obligatorios en blanco): HTTP 400.

## Componentes afectados

- `auth/src/main/java/com/bcp/workshop/auth/AuthResource.java`
- `auth/src/main/java/com/bcp/workshop/auth/AuthService.java`
- `auth/src/main/java/com/bcp/workshop/auth/LegacyDatabase.java`
- `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java`

Nota: el cambio se limita a `auth/`; no se tocan componentes `api/` ni `web/`.

## Decisiones técnicas y alternativas consideradas

1. Mantener la protección en la capa de acceso a datos y no en la capa HTTP.
- Decisión: reforzar/garantizar que la resolución de credenciales en persistencia use parámetros enlazados y nunca concatenación de entradas.
- Rationale: el riesgo de inyección nace en la composición de consultas; mitigarlo en origen protege cualquier consumidor interno.
- Alternativas consideradas:
  - Sanitizar strings en `AuthResource` (rechazada): no elimina el riesgo estructural en consultas y puede bloquear entradas válidas.
  - Lista de caracteres permitidos estricta (rechazada): cambia comportamiento funcional y puede romper compatibilidad.

2. Preservar el contrato externo y limitar cambios internos.
- Decisión: no modificar path, formato JSON ni semántica de códigos HTTP esperados.
- Rationale: la spec exige continuidad para clientes existentes y minimiza regresiones en `web/`.
- Alternativa considerada:
  - Respuestas genéricas adicionales o cambios de payload (rechazada): no requerido para resolver el issue y aumenta riesgo de ruptura.

3. Resolver la discrepancia `findByCredentials` vs estado real con evidencia.
- Decisión: usar pruebas de caracterización para confirmar el punto de bypass en el flujo real (`AuthResource -> AuthService -> LegacyDatabase`) antes de alterar lógica crítica.
- Rationale: evita implementar sobre una suposición de nombre/método que no coincide con esta rama.
- Alternativas consideradas:
  - Implementar directamente un método nuevo `findByCredentials` (rechazada): amplía superficie sin justificar que sea el origen real.

## Estrategia incremental

1. Fase 0 - caracterización (sin cambios funcionales):
- Ejecutar y/o ampliar pruebas de `AuthResourceTest` para capturar baseline del contrato y del caso de inyección.

2. Fase 1 - endurecimiento mínimo en `auth/`:
- Ajustar solo el punto de autenticación necesario para eliminar bypass, manteniendo contrato externo intacto.

3. Fase 2 - validación:
- Confirmar escenarios de spec `auth-login`: éxito 200, inválido 401, inyección 401 sin token, request inválido 400.

4. Fase 3 - cierre de alcance:
- Verificar que no hay cambios fuera de `auth/` ni alteraciones de contrato en componentes consumidores.

## Pruebas de caracterización previas (críticas)

Antes de modificar comportamiento crítico:
- Caracterizar login válido (`student` / `Workshop123!`) y validar todos los campos de respuesta actuales.
- Caracterizar rechazo por password incorrecto (401 y mensaje esperado).
- Caracterizar request nulo y campos en blanco (400).
- Agregar caracterización explícita de payload de inyección en username y password (`' OR '1'='1`) exigiendo 401 sin token.

Si alguna caracterización de inyección resulta 200, se confirma vulnerabilidad reproducible en el flujo actual y se procede con el ajuste mínimo en persistencia/servicio.

## Riesgos / Trade-offs

- [Riesgo] La vulnerabilidad reportada puede no reproducirse en esta rama por divergencia de código (`findByCredentials` no existe). → Mitigación: usar caracterización para localizar comportamiento real antes de cambiar lógica.
- [Riesgo] Endurecer validaciones puede alterar respuestas esperadas por clientes. → Mitigación: proteger contrato con pruebas de integración sobre payload y status.
- [Trade-off] Mantener mensajes y estructura actuales prioriza compatibilidad sobre mayor opacidad de errores. → Mitigación: mantener el alcance del issue; mejoras de hardening adicionales se evalúan en cambio separado.

## Rollback

Cuando aplique, rollback en `auth/` únicamente:
- Revertir los commits del cambio en `auth/src/main` y `auth/src/test`.
- Reejecutar pruebas del componente `auth/` para confirmar restauración del comportamiento previo.
- Verificar explícitamente que `POST /auth/login` conserva los contratos protegidos tras revertir.

## Open Questions

- ¿El issue #21 describe una variante de código no presente en `main` o un flujo alterno no cubierto por `AuthResourceTest`? Esta respuesta condiciona el punto exacto de ajuste interno, pero no cambia el contrato ni los escenarios de la spec.