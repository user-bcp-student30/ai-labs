# Propuesta

## Por qué

El Issue [#21](https://github.com/user-bcp-student30/ai-labs/issues/21) reporta que valores de credenciales pueden alterar la consulta del login y permitir autenticación sin conocer la contraseña. Corregir ese comportamiento evita un bypass de autenticación en `auth/` y mantiene las respuestas que consumen sus clientes.

## Qué cambia

- El login debe tratar los valores de usuario y contraseña como credenciales, no como instrucciones capaces de alterar la autenticación.
- Los intentos de inyección en cualquiera de los dos campos deben ser rechazados sin emitir un token.
- Se conserva el comportamiento observable de `POST /auth/login` para credenciales válidas, inválidas y campos de solicitud ausentes o en blanco.

## Alcance

- El componente `auth/` y el comportamiento observable del endpoint `POST /auth/login`.
- Credenciales válidas del usuario `student` y rechazos de entradas de inyección, conforme a los criterios del Issue #21.
- La capacidad OpenSpec `auth-login`.

## Fuera de alcance

- Cambios en `api/`, `web/` u otros componentes.
- Cambios en rutas, formatos de respuesta o políticas de autenticación distintos de los necesarios para impedir el bypass descrito.
- Decisiones sobre la estructura interna o la técnica de implementación.
- Cambios a datos de usuarios, tokens o configuración fuera del comportamiento cubierto por el Issue.

## Comportamiento que debe preservarse

- `POST /auth/login` continúa aceptando las credenciales de taller `student` / `Workshop123!` con respuesta `200`, `user.username` igual a `student` y un `token` no nulo.
- Se conservan los campos de respuesta que ya verifica `AuthResourceTest`: `expiresIn`, `user.displayName`, `user.role` y `debug`.
- Las credenciales incorrectas continúan produciendo `401`; solicitudes nulas o con usuario/contraseña en blanco continúan produciendo `400`.
- El Issue no cambia el contrato del endpoint. `docs/ENDPOINTS.md`, indicado como baseline, no está presente en este checkout; se usan como evidencia disponible los criterios del Issue y las pruebas actuales de `auth/`, sin inferir otros comportamientos.

## Capacidades

### Capacidades nuevas

- `auth-login`: comportamiento verificable del inicio de sesión, incluyendo autenticación válida, rechazo de credenciales inválidas y resistencia a entradas que intentan eludir la autenticación.

### Capacidades modificadas

- Ninguna. El inventario OpenSpec no contiene capacidades existentes.

## Impacto

- Componente afectado: `auth/`.
- API afectada: `POST /auth/login`; se preserva su contrato observable.
- El Issue cita `LegacyDatabase.findByCredentials`, pero ese método no aparece en el código de esta rama; `LegacyDatabase` contiene `findByUsername`. La propuesta define el resultado observable comprometido y deja cualquier reconciliación del punto interno para la fase de implementación.
- No se identifican cambios de dependencias ni de otros componentes en el alcance del Issue.