# Tasks

## 1. Caracterización previa del comportamiento crítico

- [x] 1.1 Agregar en `auth/src/test/java/com/bcp/workshop/auth/AuthResourceTest.java` dos escenarios de caracterización para payload de inyección en username y password (`' OR '1'='1`) y verificar con `cd auth && mvn -Dtest=AuthResourceTest test` que el resultado refleja el baseline real antes del cambio funcional.
- [x] 1.2 Confirmar en la misma suite de caracterización que siguen cubiertos los contratos protegidos (200 con `token` para `student`/`Workshop123!`, 401 para password incorrecto y 400 para request nulo/campos en blanco) verificando `cd auth && mvn -Dtest=AuthResourceTest test`.

## 2. Endurecimiento incremental del flujo de autenticación en auth

- [x] 2.1 Ajustar de forma mínima el punto interno de autenticación en `auth/src/main/java/com/bcp/workshop/auth/` para eliminar bypass por inyección sin cambiar el contrato externo, verificando con `cd auth && mvn -Dtest=AuthResourceTest test` que los escenarios de inyección quedan en 401 sin `token`. _Sin cambio de código: `LegacyDatabase.findByUsername` ya usa `PreparedStatement` y la caracterización 1.1 confirma 401 sin `token`; no existe `findByCredentials` en esta rama._
- [x] 2.2 Mantener inalteradas las respuestas observables de `POST /auth/login` (campos `token`, `expiresIn`, `user.username`, `user.displayName`, `user.role`, `debug`, y códigos 200/401/400) verificando nuevamente `cd auth && mvn -Dtest=AuthResourceTest test`.

## 3. Validación final y cierre de alcance del Issue

- [x] 3.1 Ejecutar la validación del componente completo con `cd auth && mvn test` y verificar que la suite del módulo `auth/` queda en verde. _Verde (12/12) con `mvn '-Dquarkus.http.test-port=0' test`; con el puerto por defecto falla por `8081` ocupado por un proceso ajeno._
- [x] 3.2 Verificar desde la raíz que el diff de implementación del Issue se mantiene dentro de `auth/` (más artefactos OpenSpec del cambio) usando `git status --short` y `git diff --name-only`.

## Workflow follow-up

- Ejecutar `openspec validate prevent-auth-login-sql-injection --strict` después de completar la implementación y evidencias de prueba.
- Mantener `api/` y `web/` fuera del alcance de implementación de este Issue.