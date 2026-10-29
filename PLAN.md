# Plan de correccion

## Alcance y seleccion

El plan original cubrio H-WEB-01 a H-WEB-07 por evidencia en el codigo. Se implementaron H-WEB-02, H-WEB-03, H-WEB-04, H-WEB-05, H-WEB-06 y H-WEB-07 tras aprobacion explicita, uno por vez. H-WEB-01 se remedia parcialmente con token en memoria; implica login tras recargar y no sustituye una cookie HttpOnly frente a XSS activa. H-WEB-05 se remedia parcialmente; quedan 5 vulnerabilidades moderadas del toolchain. La validacion del flujo descubrio H-WEB-08, aprobado e implementado en la rama de trabajo, pendiente de revision humana.

Este documento es una propuesta; no representa aprobacion humana para todos los IDs. H-WEB-01 a H-WEB-07 se trabajaron individualmente tras aprobacion explicita, con H-WEB-01 y H-WEB-05 registrados como parciales por las limitaciones anotadas. Los resultados se registran al final.

## Contrato y comportamiento a preservar

`docs/ENDPOINTS.md` registra el contrato observado, no acordado con los backends: `POST http://localhost:8080/auth/login` con `username`, `password` y `client`; respuesta exitosa con `token` y `user`; navegacion a `/dashboard`; `GET http://localhost:8000/api/tasks?owner=<username>` con `Authorization: Bearer <token>`; exclusion de tareas `ARCHIVED`, etiquetas y orden por prioridad; y logout que elimina token y usuario y vuelve a `/login`. Se deben conservar los dos endpoints, metodos, nombres de campos, query `owner`, header, manejo visible de estados y flujo entre pantallas.

Estado actual: el token solo vive en memoria de `AuthService`; el usuario y las preferencias persisten en `localStorage`. Una recarga requiere login. El frontend elimina tokens persistidos antiguos. La cookie `HttpOnly` requiere coordinacion con el backend y queda fuera del alcance web actual.

## H-WEB-01 — Token en localStorage

**Hallazgo y problema:** H-WEB-01, token de autenticacion en `localStorage`. Cualquier script ejecutado en el mismo origen puede leerlo; no se ha confirmado una via concreta de robo.

**Cambio propuesto:** centralizar lectura, escritura y borrado de sesion en `AuthService`, de acuerdo con las buenas practicas. Como alternativa acotada para reducir la persistencia entre sesiones, evaluar `sessionStorage`; no evita el acceso desde JavaScript y cambia el comportamiento al cerrar la pestana/sesion. No cambiar el almacenamiento hasta que una persona apruebe expresamente ese cambio. No cambiar endpoints ni introducir secretos en el frontend.

**Archivos a tocar:** `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts`, nuevo `web/src/app/services/auth.service.ts`; pruebas nuevas en `web/src/app/login/login.component.spec.ts` y `web/src/app/dashboard/dashboard.component.spec.ts`.

**Caracterizacion previa:** escribir pruebas Vitest con Axios, Router y almacenamiento simulados: login exitoso guarda el token y el usuario; el dashboard lee el token y envia el header Bearer; sin token redirige a `/login`; logout elimina token y usuario, conserva preferencias y navega a `/login`. Registrar primero las aserciones que correspondan a `localStorage`; cualquier cambio a `sessionStorage` debe actualizarse solo despues de la aprobacion indicada.

## H-WEB-02 — Responsabilidades mezcladas

**Hallazgo y problema:** H-WEB-02, los componentes conocen HTTP, URLs, sesion y navegacion. El cambio de endpoint, almacenamiento o formato obliga a editar componentes de UI y dificulta probar cada responsabilidad por separado.

**Cambio propuesto:** mantener `LoginComponent` y `DashboardComponent` enfocados en estado de vista y navegacion; crear `AuthService` para login y sesion, y `TasksService` para la consulta de tareas. Centralizar URLs en `environment.ts` y claves de almacenamiento dentro del servicio de autenticacion. Mantener literalmente los endpoints, payloads, query, header y comportamiento observados; no modificar el backend.

**Archivos a tocar:** `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts`, nuevos `web/src/app/services/auth.service.ts` y `web/src/app/services/tasks.service.ts`, nuevo `web/src/environments/environment.ts`, y pruebas nuevas para componentes y servicios. Revisar `web/angular.json` solo si la configuracion de ambientes requiere reemplazos; no se agregaran configuraciones innecesarias.

**Caracterizacion previa:** escribir pruebas con Axios y Router simulados que verifiquen metodo, URL, cuerpo de login, query `owner`, header Bearer, navegacion y errores actuales. Ejecutarlas antes de mover las llamadas a servicios; despues, conservar las mismas aserciones contra los servicios nuevos.

## H-WEB-03 — Tipado con any

**Hallazgo y problema:** H-WEB-03, `any` en campos, respuestas, tareas, errores y utilidad de formato. Las formas inesperadas pueden propagarse hasta la vista sin deteccion de TypeScript.

**Cambio propuesto:** definir tipos minimos a partir de los campos que el frontend realmente lee: request/response de login, usuario de sesion, tarea y respuesta de error. Cambiar `any` por esos tipos o por `unknown` con validacion/narrowing donde la forma externa no este garantizada. Tipar `formatTaskLabel` sin cambiar su salida para prioridad/propietario ausentes. No inventar propiedades del contrato que no esten observadas.

**Archivos a tocar:** `web/src/app/login/login.component.ts`, `web/src/app/dashboard/dashboard.component.ts`, `web/src/app/utils/legacy-format.ts`, `web/src/app/utils/legacy-format.spec.ts`, nuevos modelos bajo `web/src/app/models/` y tipos en los servicios nuevos de H-WEB-02.

**Caracterizacion previa:** ampliar `legacy-format.spec.ts` para tarea nula y campos opcionales/ausentes; escribir pruebas de login y dashboard con las formas de respuesta actualmente consumidas. Ejecutar `npm run build` para comprobar el tipado sin cambiar el comportamiento.

## H-WEB-04 — Mensaje dinamico con innerHTML

**Hallazgo y problema:** H-WEB-04, valores de usuario y error se incorporan a una cadena que se enlaza con `[innerHTML]`. Angular sanitiza ese binding, por lo que no se afirma una ejecucion de script; usar datos no confiables como marcado mantiene un riesgo evitable y hace depender la seguridad de la sanitizacion del template.

**Cambio propuesto:** representar el mensaje como datos o texto plano y usar interpolacion Angular. Mantener el marcado estructural (`strong`, saltos) estatico en el template, sin construir HTML con usuario ni respuesta del backend. Preservar textos y estados visibles observados.

**Archivos a tocar:** `web/src/app/login/login.component.ts`, `web/src/app/login/login.component.html`, nuevo `web/src/app/login/login.component.spec.ts`; `web/vitest.config.ts` y `web/package.json`/`web/package-lock.json` solo si hace falta un entorno DOM. Una dependencia de pruebas como `jsdom` se justificaria unicamente para verificar que valores dinamicos se renderizan como texto y nunca como nodos HTML; no agregarla si la configuracion existente permite esa prueba sin ella.

**Caracterizacion previa:** escribir pruebas para mensajes de validacion y error con caracteres de marcado ordinarios en el nombre/error, comprobando el texto visible y el formato estatico actual. En el estado actual Vitest usa `node`; si se requiere DOM, configurar y justificar primero el soporte de renderizado antes de cambiar el componente.

## H-WEB-05 — Dependencias pendientes de SCA

**Hallazgo y problema:** H-WEB-05, `axios` 0.31.0 y `lodash` 4.17.21 aparecen en el manifiesto. No se ha comprobado que tengan advisories aplicables, por lo que no se atribuye una vulnerabilidad ni se eligen versiones de reemplazo.

**Cambio propuesto:** primero ejecutar la auditoria ya declarada en `web/package.json` (`npm run audit:workshop`) y revisar los advisories y su alcance. Si no hay hallazgos aplicables, no cambiar dependencias. Si se confirma uno, proponer la menor actualizacion/remocion compatible, justificarla, mantener el lockfile sincronizado y no silenciar alertas. No agregar dependencias de runtime; preferir utilidades nativas cuando cubran el uso existente.

**Archivos a tocar:** inicialmente ninguno; solo si el resultado lo justifica, `web/package.json`, `web/package-lock.json` y los imports/codigo de `web/src/` que deban adaptarse a una remocion confirmada.

**Caracterizacion previa:** antes de editar manifiestos, escribir/conservar pruebas que caractericen el login con Axios y la fusion de preferencias con Lodash; registrar baseline de `npm run test` y `npm run build`. La auditoria es la comprobacion primaria de SCA, no una prueba funcional. Versiones, cambios y resultados quedan pendientes hasta contar con advisories y revision humana.

## H-WEB-06 — Validaciones anidadas

**Hallazgo y problema:** H-WEB-06, validaciones de usuario y contrasena anidadas en `login()`. Los caminos de validacion y error se vuelven mas dificiles de leer y ampliar.

**Cambio propuesto:** usar retornos anticipados para campos vacios, separar la validacion de la llamada HTTP si reduce responsabilidades y mantener el estado `busy` con limpieza garantizada. Extraer constantes nombradas si quedan claves o mensajes compartidos; no cambiar textos, status ni navegacion observados.

**Archivos a tocar:** `web/src/app/login/login.component.ts` y pruebas nuevas en `web/src/app/login/login.component.spec.ts`.

**Caracterizacion previa:** probar usuario vacio/nulo, contrasena vacia/nula, login exitoso, respuesta sin token y fallo HTTP; verificar mensajes actuales y que `busy` vuelve a `false` en todos los caminos.

## H-WEB-07 — Cobertura de flujo limitada

**Hallazgo y problema:** H-WEB-07, la unica prueba localizada cubre `formatTaskLabel`; login, sesion, tareas, errores y logout carecen de caracterizacion visible.

**Cambio propuesto:** ampliar pruebas por responsabilidad, sin introducir cambios de producto dentro de este paso de plan. Conservar las pruebas actuales y cubrir primero los contratos observados; usar dobles para HTTP, Router y almacenamiento, sin depender de servicios remotos.

**Archivos a tocar:** `web/src/app/utils/legacy-format.spec.ts`, nuevos `web/src/app/login/login.component.spec.ts`, `web/src/app/dashboard/dashboard.component.spec.ts` y pruebas para `AuthService`/`TasksService` segun se creen.

**Caracterizacion previa:** antes de cualquier refactor, cubrir login valido, validaciones y errores; token ausente; consulta con query y header esperados; filtro de tareas `ARCHIVED`, etiqueta/orden; logout y conservacion de preferencias. Luego ejecutar desde `web/` `npm run test`, `npm run build` y `npm run test:coverage`; buscar una meta minima de 85% para el codigo modificado y registrar cobertura real sin reducir quality gates.

## Secuencia y puertas de revision

1. Escribir las pruebas de caracterizacion indicadas antes de modificar componentes o servicios; registrar resultados reales, sin asumir que pasan.
2. Resolver con revision humana la alternativa de almacenamiento de H-WEB-01. Si no se aprueba el cambio de persistencia, mantener `localStorage` y limitar el cambio a centralizar su acceso.
3. Aplicar separacion de servicios y tipos en cambios pequenos, manteniendo endpoints, payloads y estados observados.
4. Resolver H-WEB-05 solo con evidencia SCA; revisar `package.json` y lockfile en conjunto.
5. Ejecutar pruebas/build/cobertura desde `web/`, registrar comandos y resultados por IDs en `docs/TESTING.md` cuando ese artefacto se cree. Revisar manualmente el diff y solicitar aprobacion humana antes de integrar.

No se creo ni modifico `docs/ENDPOINTS.md` o `docs/TESTING.md`. Los cambios se limitaron a servicios/ambiente de H-WEB-02, tipos de H-WEB-03, mensajes de H-WEB-04, token en memoria de H-WEB-01, actualizaciones de dependencias de H-WEB-05, validaciones de H-WEB-06 y pruebas de H-WEB-07; no se modificaron otros componentes.

## Registro de ejecucion

| componente | IDs | accion | resultado |
|---|---|---|---|
| web | H-WEB-06 | Caracterizacion previa: `npm test -- src/app/login/login.component.spec.ts` (5/5). Cambio: reemplazo de validaciones anidadas por retornos anticipados en `web/src/app/login/login.component.ts`. Caracterizacion posterior: `npm test -- src/app/login/login.component.spec.ts` (5/5); luego `npm run test:coverage -- src/app/login/login.component.spec.ts` (9/9). Build: `npm run build`. | Caracterizacion previa y posterior aprobadas. Build aprobado con advertencias CommonJS ya emitidas para Axios y Lodash. Cobertura de `LoginComponent`: 96.66% lineas, 82.35% ramas, 100% funciones; cobertura total del proyecto en esta ejecucion: 35.36%. La cobertura de lineas del archivo modificado supera 85%; no se afirma 85% de ramas. Primera ejecucion Vitest fallo antes de los tests por falta de carga JIT; se corrigio la inicializacion en el spec importando el `@angular/compiler` ya instalado, y las ejecuciones posteriores pasaron. |
| web | H-WEB-04 | Caracterizacion previa: `npm test -- src/app/login/login.component.spec.ts` (10/10), incluyendo binding previo y textos actuales. Cambio: separar prefijo y detalle como texto en `LoginComponent`, mantener `<strong>`/`<br>` estaticos y usar interpolacion en `login.component.html`. Caracterizacion posterior: `npm test -- src/app/login/login.component.spec.ts` (10/10); cobertura: `npm run test:coverage -- src/app/login/login.component.spec.ts` (10/10); build: `npm run build`. | Pruebas y build aprobados; cobertura de `LoginComponent`: 96.82% lineas, 82.35% ramas, 100% funciones; cobertura total del proyecto en esta ejecucion: 36.52%. Build con advertencias CommonJS de Axios y Lodash. No se agrego entorno DOM: el test confirma estaticamente interpolacion y ausencia de `[innerHTML]`, pero no es una prueba de renderizado en navegador. |
| web | H-WEB-03 | Caracterizacion previa: `npm test` (16/16). Cambio: modelos `LoginRequest`, `LoginResponse`, `AuthenticatedUser`, `Task`; estados concretos; errores `unknown` con narrowing; formateador tipado y sin `any`. Caracterizacion posterior y cobertura: `npm run test:coverage` (23/23); build: `npm run build`; busqueda `\bany\b` en `web/src/`. | Suite y build aprobados; no se encontraron usos `any` en `web/src`. Cobertura de lineas: `LoginComponent` 97.22%, `DashboardComponent` 91.89%, `auth.model.ts`, `error-message.ts`, `legacy-format.ts` y `type-guards.ts` 100%. Cobertura global 83.48% por archivos no modificados; dashboard tiene 71.42% de ramas. Build mantiene advertencias CommonJS de Axios/Lodash. |
| web | H-WEB-02 | Caracterizacion previa: `npm test` (24/24). Cambio: `AuthService` para login/sesion, `TasksService` para tareas, `environment.ts` para URLs; componentes delegan operaciones. Caracterizacion posterior: `npm test` (30/30), incluyendo servicios; build: `npm run build`; cobertura: `npm run test:coverage` (30/30). | Suite y build aprobados. Cobertura global: 87.59% lineas, 85.48% ramas, 85.71% funciones; `AuthService` 93.75% lineas, `TasksService` 100%, `LoginComponent` 100%, `DashboardComponent` 97.26%. Advertencias CommonJS de Axios y Lodash permanecen. Una ejecucion intermedia fallo por tests que aun usaban la firma anterior y un import obsoleto; se corrigieron y las ejecuciones finales pasaron. |
| web | H-WEB-04 | Caracterizacion previa: `npm test -- src/app/login/login.component.spec.ts` (10/10), incluyendo binding previo y textos actuales. Cambio: separar prefijo y detalle como texto en `LoginComponent`, mantener `<strong>`/`<br>` estaticos y usar interpolacion en `login.component.html`. Caracterizacion posterior: `npm test -- src/app/login/login.component.spec.ts` (10/10); cobertura: `npm run test:coverage -- src/app/login/login.component.spec.ts` (10/10); build: `npm run build`. | Pruebas y build aprobados; cobertura de `LoginComponent`: 96.82% lineas, 82.35% ramas, 100% funciones; cobertura total del proyecto en esta ejecucion: 36.52%. Build con advertencias CommonJS de Axios y Lodash. No se agrego entorno DOM: el test confirma estaticamente interpolacion y ausencia de `[innerHTML]`, pero no es una prueba de renderizado en navegador. |
| web | H-WEB-07 | Caracterizacion previa: `npm test` (30/30). Cambio de pruebas: ampliar dashboard con estados conocidos, desconocidos y ausentes; los tests previos ya cubren login, storage, peticion de tareas, errores y logout. Caracterizacion posterior/cobertura: `npm run test:coverage` (36/36). | Suite aprobada: 7 archivos, 36/36 tests. Cobertura global 88.34% lineas, 86.36% ramas y 90.47% funciones; dashboard 100% lineas y 88.23% ramas. No se agrego ni modifico logica de produccion para este ID. |
| web | H-WEB-05 | Remediacion directa y reescaneo: Angular 21.2.25 (CLI/build 21.2.28), Axios 0.34.0, Lodash 4.18.1, Vitest/coverage 4.1.12, override `undici` 7.30.1. Se actualizo `package-lock.json`. Validacion: `npm ls --depth=0`, `npm test`, `npm run build`, `npm audit --json`, `appmod-cve-assessment`; resultados appmod en `H-WEB-05-cve-report-2.json`. | Appmod no encontro CVEs en las 18 dependencias directas. `npm audit` bajo de 25 (6 critical, 9 high, 10 moderate) a 5 moderate; no quedan hallazgos high/critical. Restan Angular build, build-webpack, sockjs, uuid y webpack-dev-server; la unica correccion propuesta por npm es `@angular-devkit/build-angular@22.2.4`, salto mayor desde Angular 21 y fuera de un parche CVE. No se aplico; H-WEB-05 queda parcial. Validacion funcional: 7 archivos, 36/36 tests y build aprobado; advertencias CommonJS de Axios/Lodash permanecen. |
| web | H-WEB-01 | Caracterizacion de `AuthService`: token en memoria; usuario/preferencias conservan claves existentes; elimina token persistido legado al iniciar/logout; una instancia nueva no restaura token. Contrato `POST /auth/login` y bearer de tareas sin cambios. | Prueba focal: 6/6; suite completa: 7 archivos, 37/37. Cobertura global: 98.26% lineas, 86.15% ramas, 100% funciones; `AuthService`: 90.47% lineas. Build aprobado con avisos CommonJS existentes. Token ya no se escribe en Web Storage; tras recarga se vuelve a login. Una XSS activa sigue pudiendo operar en la sesion; cookie HttpOnly requiere backend. |
| web | H-WEB-01, H-WEB-02, H-WEB-03, H-WEB-04, H-WEB-06, H-WEB-07 | Regresion final: `npm test` desde `web/`. | Suite completa aprobada: 7 archivos, 37/37 tests. |
| web | H-WEB-02, H-WEB-07 | Pruebas de login, tareas y errores; detalle de comandos, cobertura y casos pendientes en `docs/TESTING.md`. | Suite previa al cambio H-WEB-08: 8 archivos, 41/41 tests. V8: lineas globales 113/115 (98.26%); modulos del flujo login/dashboard/auth/tasks 90/92 (97.82%). |
| web | H-WEB-08 | Caracterizacion previa: `npm test` (8 archivos, 41/41); las dos nuevas pruebas de regresion fallaron antes del cambio. Implementacion: bloquear login con token sin `user` antes de guardar sesion/navegar y exigir usuario en la firma de `saveSession`. Validacion: `npm test -- src/app/login/login.component.spec.ts src/app/login-tasks-flow.spec.ts` (14/14), `npm test` (8 archivos, 43/43), `npm run test:coverage` (8 archivos, 43/43; 98.31% lineas, 89.55% ramas, 100% funciones), `npm run build`. | Build aprobado con advertencias CommonJS existentes de Axios/Lodash. LoginComponent: 100% lineas y ramas; AuthService: 90.47% lineas. Las llamadas HTTP son simuladas; el contrato real del backend y el comportamiento en runtime integrado permanecen sin validar. |