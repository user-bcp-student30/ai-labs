# Pruebas de login y consulta de tareas (web)

Pruebas unitarias de componentes/servicios y un flujo integrado en memoria. Las llamadas HTTP se simulan con Vitest/Axios; no se contactan backends ni se renderizan templates en un navegador. Casos y contrato se basan en `docs/ENDPOINTS.md`.

## Matriz de flujos

| Flujo | Caso | Tipo | Resultado esperado |
|---|---|---|---|
| Login -> dashboard -> tareas (`web/src/app/login-tasks-flow.spec.ts`; H-WEB-02, H-WEB-07) | Credenciales validas; login responde token/usuario y GET devuelve tareas | Camino feliz | Envia POST con body/timeout acordados, conserva token en memoria, navega al dashboard, envia bearer/query owner y muestra tareas no archivadas. |
| Login (`web/src/app/login/login.component.spec.ts`; H-WEB-06, H-WEB-07) | Usuario vacio o blanco | Borde | Muestra validacion y no llama al servicio de autenticacion. |
| Login (`web/src/app/login/login.component.spec.ts`; H-WEB-06, H-WEB-07) | Contrasena vacia o blanca | Borde | Muestra validacion y no llama al servicio de autenticacion. |
| Login (`web/src/app/login/login.component.spec.ts`; H-WEB-07) | Respuesta 2xx sin token | Borde / respuesta inesperada | Muestra `El backend respondio sin token.`, no guarda sesion ni navega. |
| Login (`web/src/app/login/login.component.spec.ts`; H-WEB-07) | Servicio de autenticacion no disponible (`offline`) | Error | Muestra prefijo de fallo y detalle disponible; limpia `busy`. |
| Login (`web/src/app/login/login.component.spec.ts`; H-WEB-07) | Timeout Axios `ECONNABORTED` a 5000 ms | Error | Muestra prefijo y mensaje de timeout; limpia `busy`. La prueba simula el rechazo, no espera cinco segundos reales. |
| Tareas (`web/src/app/dashboard/dashboard.component.spec.ts`; H-WEB-02, H-WEB-07) | Token invalido, respuesta no 2xx con status 401 y `detail` | Error | Muestra `Invalid token`, finaliza carga y no limpia sesion ni redirige automaticamente. |
| Tareas (`web/src/app/dashboard/dashboard.component.spec.ts`; H-WEB-07) | Error de carga con `response.data.detail` | Error | Muestra el detalle del backend y finaliza carga. |
| Tareas (`web/src/app/dashboard/dashboard.component.spec.ts`; H-WEB-07) | Respuesta 2xx cuyo body no es una lista iterable | Error / respuesta inesperada | Captura el error del procesamiento, muestra un mensaje no vacio y finaliza carga. |
| Dashboard (`web/src/app/dashboard/dashboard.component.spec.ts`; H-WEB-02, H-WEB-07) | No hay token en memoria | Borde | Navega a `/login` y no solicita tareas. |

## Codigo de los tests

Extractos de los casos ejecutados. Los fixtures, imports y setup de mocks permanecen en los archivos de test indicados.

### Flujo integrado: `web/src/app/login-tasks-flow.spec.ts`

```typescript
it('logs in, keeps the token in memory, and loads the authenticated tasks', async () => {
  postLogin.mockResolvedValue({
    data: { token: 'test-token', user: { username: 'student', displayName: 'Student' } }
  } as never);
  getTasks.mockResolvedValue({
    data: [
      { title: 'Requirement', owner: 'student', status: 'TODO', priority: 'HIGH' },
      { title: 'Archived', owner: 'student', status: 'ARCHIVED', priority: 'URGENT' }
    ]
  } as never);
  const loginComponent = new LoginComponent(router as unknown as Router, authService);
  loginComponent.username = 'student';
  loginComponent.password = 'Workshop123!';

  await loginComponent.login();

  const dashboardComponent = new DashboardComponent(
    router as unknown as Router,
    { detectChanges: vi.fn() } as unknown as ChangeDetectorRef,
    { run: (callback: () => void) => callback() } as unknown as NgZone,
    authService,
    tasksService
  );
  await dashboardComponent.ngOnInit();

  expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  expect(postLogin).toHaveBeenCalledWith(
    'http://localhost:8080/auth/login',
    { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
    { timeout: 5000 }
  );
  expect(getTasks).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
    headers: { Authorization: 'Bearer test-token' }
  });
  expect(dashboardComponent.visibleTasks.map((task) => task.title)).toEqual(['Requirement']);
  expect(dashboardComponent.loading).toBe(false);
  expect(values.get('workshop_user')).toContain('student');
  expect(values.has('workshop_token')).toBe(false);
});
```

### Login: `web/src/app/login/login.component.spec.ts`

```typescript
it('shows the username validation message without calling the API', async () => {
  const component = createComponent();
  component.username = '  ';
  component.password = 'Workshop123!';

  await component.login();

  expect(component.message).toBe('Ingrese un usuario.');
  expect(component.busy).toBe(false);
  expect(authService.login).not.toHaveBeenCalled();
});

it('shows the password validation message without calling the API', async () => {
  const component = createComponent();
  component.username = 'student';
  component.password = '  ';

  await component.login();

  expect(component.message).toBe('Ingrese una contraseña.');
  expect(component.busy).toBe(false);
  expect(authService.login).not.toHaveBeenCalled();
});

it('shows the missing-token message when the response has no token', async () => {
  authService.login.mockResolvedValue({});
  const component = createComponent();
  component.username = 'student';
  component.password = 'Workshop123!';

  await component.login();

  expect(component.message).toBe('El backend respondió sin token.');
  expect(component.busy).toBe(false);
});

it('shows the unavailable authentication service message and clears the busy state', async () => {
  authService.login.mockRejectedValue(new Error('offline'));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const component = createComponent();
  component.username = 'student';
  component.password = 'Workshop123!';

  await component.login();

  expect(component.message).toBe('No se pudo autenticar a student.');
  expect(component.messageDetail).toBe('offline');
  expect(component.busy).toBe(false);
});

it('shows the timeout message and always clears the busy state', async () => {
  authService.login.mockRejectedValue(Object.assign(new Error('timeout of 5000ms exceeded'), {
    code: 'ECONNABORTED'
  }));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const component = createComponent();
  component.username = 'student';
  component.password = 'Workshop123!';

  await component.login();

  expect(component.message).toBe('No se pudo autenticar a student.');
  expect(component.messageDetail).toBe('timeout of 5000ms exceeded');
  expect(component.busy).toBe(false);
});
```

### Tareas: `web/src/app/dashboard/dashboard.component.spec.ts`

```typescript
it('shows the invalid-token detail without clearing the session or redirecting', async () => {
  tasksService.getTasks.mockRejectedValue({
    response: { status: 401, data: { detail: 'Invalid token' } }
  });
  const component = createComponent();

  await component.ngOnInit();

  expect(component.error).toBe('Invalid token');
  expect(component.loading).toBe(false);
  expect(authService.clearSession).not.toHaveBeenCalled();
  expect(router.navigate).not.toHaveBeenCalled();
});

it('shows an error when a successful response is not an iterable task list', async () => {
  tasksService.getTasks.mockResolvedValue(null as never);
  const component = createComponent();

  await component.ngOnInit();

  expect(component.error).not.toBe('');
  expect(component.loading).toBe(false);
});
```

### Contratos de servicio

`web/src/app/services/auth.service.spec.ts` verifica POST, body y timeout; `web/src/app/services/tasks.service.spec.ts` verifica GET, `owner` y header bearer. Ambos casos se ejecutan en la suite completa.

## Ejecuciones y cobertura

Comandos ejecutados desde `web/`:

| Componente / IDs | Comando | Codigo de salida | Resultado |
|---|---|---:|---|
| web / H-WEB-07 | `npm test -- src/app/login/login.component.spec.ts` | 0 | 1 archivo, 11/11 tests. |
| web / H-WEB-02, H-WEB-07 | `npm test -- src/app/dashboard/dashboard.component.spec.ts` | 0 | 1 archivo, 12/12 tests. |
| web / H-WEB-02, H-WEB-07 | `npm test -- src/app/login-tasks-flow.spec.ts` | 0 | 1 archivo, 1/1 test integrado. |
| web / H-WEB-01, H-WEB-02, H-WEB-07 | `npm test` | 0 | 8 archivos, 41/41 tests. |
| web / H-WEB-01, H-WEB-02, H-WEB-07 | `npm run test:coverage` | 0 | 8 archivos, 41/41 tests; proveedor Vitest V8. |

Metodo: instrumentacion de lineas/ramas/funciones de Vitest Coverage V8; el reporte de consola y `web/coverage/coverage-summary.json` se generaron con `npm run test:coverage`.

| Alcance | Lineas cubiertas / totales | Cobertura de lineas |
|---|---:|---:|
| Codigo de produccion del flujo probado: LoginComponent 30/30, DashboardComponent 38/38, AuthService 19/21, TasksService 3/3 | 90/92 | 97.82% |
| Global de `web/` | 113/115 | 98.26% |

Cobertura global adicional: statements 118/120 (98.33%), ramas 57/65 (87.69%) y funciones 22/22 (100%). El codigo de produccion no se modifico en esta actividad; el calculo del flujo anterior corresponde a los modulos ejercitados por los tests agregados y existentes. No se ejecuto `npm run build` en esta actividad porque solo cambiaron tests y documentacion.

## Fallos, pendientes y pruebas propuestas

### Fallos / bugs separados

- H-WEB-08 (`web`), estado `Pendiente`: login permite token sin `user`; `saveSession()` serializa `undefined` en `web/src/app/services/auth.service.ts:60`, y `getUser()` ejecuta `JSON.parse` en `web/src/app/services/auth.service.ts:44`, llamado desde `web/src/app/dashboard/dashboard.component.ts:47` antes de su bloque `try`. El dashboard puede quedar sin iniciar. No se agrego una asercion que acepte este fallo ni se modifico codigo de produccion. Confirmar si `user` es obligatorio y validar la respuesta antes de guardar la sesion; despues agregar una prueba de regresion.

### Pendientes

- Las pruebas HTTP usan Axios simulado: no validan contra auth/API reales ni confirman el status de exito exacto o el body real del backend.
- Timeout de login se simula con un rechazo `ECONNABORTED`; no se esperan 5000 ms reales. El test de servicio comprueba que la configuracion Axios fija `timeout: 5000`.
- No se monto Angular en navegador/DOM. La prueba del template comprueba estaticamente que no existe `[innerHTML]`, no el renderizado visual.
- Tareas no tienen timeout configurado en `TasksService`; no existe una expiracion que la UI pueda mostrar para ese endpoint.

### Pruebas propuestas

- Una vez acordado el contrato de `user`, probar la respuesta incompleta y verificar que la UI rechace la sesion o muestre un error controlado antes de abrir el dashboard.
- Cuando los backends de prueba esten disponibles, agregar una comprobacion de integracion HTTP de login, bearer y respuesta de tareas sin sustituir estas pruebas unitarias.
