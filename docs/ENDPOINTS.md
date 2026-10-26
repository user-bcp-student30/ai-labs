# Contratos HTTP consumidos por `web`

Este documento describe las llamadas que realiza el frontend Angular actual. Las URLs corresponden a `web/src/environments/environment.ts`. Los ejemplos usan credenciales ficticias del laboratorio y datos de prueba; no son respuestas capturadas de un backend en ejecucion.

## `POST http://localhost:8080/auth/login`

### 1. Quien lo llama

`LoginComponent.login()` valida usuario y contrasena y delega la llamada a `AuthService.login()`. El servicio ejecuta el POST y aplica un timeout de 5000 ms. Si la respuesta contiene un token truthy, el componente guarda la sesion y navega a `/dashboard`.

### 2. Que envia

No configura un header de autenticacion. Axios serializa el objeto como JSON y establece el content type correspondiente por defecto.

| Ubicacion | Campo | Tipo / valor | Requerido por el cliente |
|---|---|---|---|
| Header | `Content-Type` | `application/json`, default de Axios al serializar el objeto | Si, implicito |
| Header | `Authorization` | No se envia | No |
| Body | `username` | string | Si |
| Body | `password` | string | Si |
| Body | `client` | string; el frontend envia `angular-workshop` | Si |
| Configuracion Axios | timeout | 5000 ms | Si |

Ejemplo enviado:

```http
POST /auth/login HTTP/1.1
Host: localhost:8080
Content-Type: application/json
```

```json
{
  "username": "student",
  "password": "Workshop123!",
  "client": "angular-workshop"
}
```

### 3. Que espera recibir en exito

| Aspecto | Esperado / comprobado |
|---|---|
| Status HTTP | Cualquier 2xx segun el default de Axios. El codigo no verifica uno concreto y las pruebas no fijan si el backend devuelve 200 u otro 2xx. |

Campos del body:

| Campo | Tipo en el cliente | Uso |
|---|---|---|
| `token` | `string`, opcional en `LoginResponse` | El componente lo requiere truthy para guardar sesion y navegar. |
| `user` | `AuthenticatedUser`, opcional en `LoginResponse` | El servicio guarda el objeto; el modelo reconoce `username`, `displayName` y `role` como campos string opcionales. |

Ejemplo compatible con el codigo y los datos de prueba:

```json
{
  "token": "test-token",
  "user": {
    "username": "student",
    "displayName": "Student"
  }
}
```

### 4. Como reacciona la UI ante errores o respuestas inesperadas

| Situacion | Comportamiento observable |
|---|---|
| Usuario o contrasena vacios | No envia la peticion; muestra el mensaje de validacion correspondiente. |
| Respuesta 2xx sin `token` truthy | No guarda sesion ni navega; muestra `El backend respondio sin token.` |
| Credenciales rechazadas u otra respuesta no 2xx | Axios rechaza la llamada. La UI muestra `No se pudo autenticar a <username>.` y como detalle usa `response.data.message`, luego `error.message`, y finalmente `Error desconocido`. No hay manejo especifico por status. |
| Timeout | A los 5000 ms Axios rechaza la llamada; se muestra el mismo prefijo y el mensaje de error disponible. El estado `busy` se limpia en `finally`. |
| Error de red u otro error de Axios | Se muestra el mismo prefijo y `error.message` si existe; en su defecto, `Error desconocido`. |
| Token presente pero `user` ausente | El componente acepta el token y navega. `saveSession()` persiste `JSON.stringify(user)`; para `undefined`, el almacenamiento web lo convierte en el texto `undefined`. Luego `DashboardComponent` llama a `getUser()`, cuyo `JSON.parse` lanza antes del bloque `try` que maneja errores de tareas. La UI no tiene un manejo especifico para este caso. |
| `user` es JSON valido pero no cumple la forma tipada | `getUser()` devuelve `{}`. El dashboard continua con username vacio si hay token. |

### 5. Notas de seguridad

- El token vive en memoria de `AuthService`; ya no se escribe en `localStorage`. El servicio elimina la clave heredada `workshop_token` al inicializar y al cerrar sesion. Una recarga completa requiere iniciar sesion de nuevo.
- El objeto de usuario y las preferencias siguen en `localStorage`; la restriccion de almacenamiento en memoria se aplica al token.
- La respuesta del login se renderiza como texto con interpolacion Angular; el template no usa `[innerHTML]` para mensajes.
- El componente ejecuta `console.error(error)` en el catch. El codigo no redacta el objeto de error; confirmar si la configuracion de Axios expone datos del request (incluida la contrasena) en la consola queda como riesgo pendiente.
- La URL configurada usa HTTP en localhost. El codigo no demuestra una configuracion de transporte para despliegue; no usar credenciales reales en este entorno.
- Preguntas abiertas: cual es el status 2xx exacto; si `user` es obligatorio en el contrato real; y si los errores del backend garantizan el campo `message` (la UI no consulta `detail` para login).

## `GET http://localhost:8000/api/tasks?owner=<username>`

### 1. Quien lo llama

`DashboardComponent.ngOnInit()` obtiene el token en memoria y el usuario desde `AuthService`. Si no hay token, navega a `/login` sin llamar a la API. Si hay token, delega la peticion a `TasksService.getTasks(username, token)`.

### 2. Que envia

| Ubicacion | Campo | Tipo / valor | Requerido por el cliente |
|---|---|---|---|
| Query | `owner` | username leido de `AuthService`; usa cadena vacia si falta | Si, el parametro siempre se concatena a la URL |
| Header | `Authorization` | `Bearer <token>` | Si |
| Body | - | No se envia | No |

No se configura timeout ni otro header explicitamente. El username se concatena directamente a la URL, sin `encodeURIComponent`.

Ejemplo enviado:

```http
GET /api/tasks?owner=student HTTP/1.1
Host: localhost:8000
Authorization: Bearer test-token
```

### 3. Que espera recibir en exito

| Aspecto | Esperado / comprobado |
|---|---|
| Status HTTP | Cualquier 2xx segun el default de Axios. El codigo no comprueba un status especifico. |
| Body | `Task[]` segun el tipo de `TasksService`; devuelve `response.data` sin validacion en runtime. |

Campos del body, segun `Task`:

| Campo del elemento | Tipo en `Task` | Uso |
|---|---|---|
| `owner` | string opcional | Se usa para generar la etiqueta visible. |
| `status` | string opcional | Se filtran las tareas `ARCHIVED` y se muestra una etiqueta de estado. |
| `priority` | string opcional | Se usa para la etiqueta y el orden. |
| `title` | string opcional | Se muestra como titulo. |
| `description` | string opcional | Se muestra como descripcion. |
| `label` | string opcional en el tipo | El dashboard la calcula y asigna localmente; no demuestra que la API la envie. |

Ejemplo de body compatible con las pruebas:

```json
[
  {
    "title": "Requirement",
    "owner": "student",
    "status": "TODO",
    "priority": "HIGH",
    "description": "Review the requirement"
  }
]
```

El dashboard excluye `ARCHIVED`, calcula `label` y ordena la lista visible. El frontend no documenta aqui campos adicionales que no aparezcan en el tipo `Task`.

### 4. Como reacciona la UI ante errores o respuestas inesperadas

| Situacion | Comportamiento observable |
|---|---|
| No hay token en memoria | Navega a `/login`; no envia la peticion. Esto ocurre tambien tras recargar completamente la pagina. |
| Token invalido o respuesta no 2xx | Axios rechaza la peticion; el dashboard muestra `response.data.detail`, luego `error.message`, y finalmente `No se pudo cargar el dashboard`. No hay tratamiento especial por status, logout automatico ni redireccion especifica al detectar 401/403. |
| Error de red | El catch deja de mostrar carga y renderiza el mensaje disponible o el fallback anterior. |
| Timeout | `TasksService` no define timeout. Con la configuracion por defecto de Axios no hay un limite de tiempo del cliente; la UI puede permanecer cargando hasta que la peticion resuelva o falle por otra causa. |
| Respuesta 2xx cuyo body no sea iterable como array | El dashboard falla al iterar las tareas; el error cae en el catch y se muestra usando `error.message` o el fallback. No existe validacion runtime del esquema. |

### 5. Notas de seguridad

- El bearer token se conserva solo en memoria de `AuthService` y se envia en el header `Authorization`; usuario y preferencias permanecen en `localStorage`. Una XSS activa aun podria operar como el usuario. Una cookie `HttpOnly` requeriria coordinacion con el backend y no forma parte del codigo frontend actual.
- El query `owner` se construye concatenando el username sin codificar. El comportamiento para usernames con caracteres reservados (`&`, `?`, `#`) no esta definido; confirmar el conjunto permitido o codificar el valor.
- El frontend no demuestra que el backend autorice `owner` contra la identidad del token. La autorizacion efectiva queda como pregunta para el contrato/backend; no debe inferirse del filtro cliente.
- Los errores se muestran en interpolacion Angular como texto. No se usa `[innerHTML]` para los detalles de la API.
- Preguntas abiertas: status de exito exacto; schema completo de `Task`; formato/status para token invalido; y si el backend impone identidad para `owner`.
