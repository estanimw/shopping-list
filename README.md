# Listita

Una lista de compras personal, rápida y amable. Está pensada primero para el teléfono: podés agregar productos, marcarlos mientras comprás y seguir usándola aun cuando se corta la señal.

## Qué incluye

- Cuentas con email y contraseña: cada persona tiene su propia lista.
- Productos frecuentes y productos personalizados con categorías e iconos.
- Gestos para completar o eliminar, más controles accesibles con teclado.
- Cierre de compra que completa los pendientes y crea una lista nueva.
- PWA instalable con modo offline: los cambios se guardan en el teléfono y se sincronizan al recuperar conexión.
- Interfaz adaptable a móvil y escritorio, con soporte para `prefers-reduced-motion`.
- Healthcheck en `GET /api/health`.

## Requisitos

- Node.js `22.13` o superior.
- Para producción: un volumen persistente para SQLite y una URL pública HTTPS.

## Empezar en local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Por defecto, SQLite se crea en `data/shopping.db`.

Las variables disponibles son:

| Variable | Uso |
| --- | --- |
| `BETTER_AUTH_URL` | URL pública de la aplicación, sin barra final. En local: `http://localhost:3000`. |
| `BETTER_AUTH_SECRET` | Secreto largo y aleatorio para las sesiones. Es obligatorio en producción. |
| `DB_PATH` | Ruta al archivo SQLite. Por defecto: `data/shopping.db`; en el contenedor: `/app/data/shopping.db`. |

## Usar Listita sin señal

1. Con Internet, abrí Listita e instalala desde Chrome para Android con **Instalar aplicación** o **Agregar a pantalla de inicio**.
2. Después de esa primera carga podés abrirla sin señal, agregar, completar, restaurar, eliminar productos o finalizar una compra.
3. El estado debajo del título indica si estás sin conexión, si hay cambios pendientes o si todo quedó sincronizado.

Los cambios pendientes se reintentan al recuperar conexión, volver a abrir la app o traerla de nuevo al frente. Sin una primera apertura online no hay una lista local para mostrar. Para proteger los datos del teléfono, Listita no permite cerrar sesión mientras existan cambios pendientes y borra la copia local al salir correctamente.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Inicia el entorno de desarrollo. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run build` | Genera el build de producción. |
| `npm run start` | Inicia el build de producción local. Ejecutá `npm run build` antes. |
| `npm run db:check` | Comprueba que SQLite pueda abrirse. |

## Ejecutar con Docker

```bash
docker compose up --build
```

El ejemplo de Compose crea el volumen `shopping-data`, que conserva la base al recrear el contenedor. Configurá `BETTER_AUTH_URL` y `BETTER_AUTH_SECRET` antes de usarlo fuera de local.

## Deploy

La imagen se construye con el `Dockerfile` incluido y escucha en el puerto `3000`. Puede desplegarse en cualquier plataforma que ejecute contenedores; configurá el proxy o dominio con HTTPS, necesario para la experiencia PWA fuera de `localhost`.

Antes de ponerla en producción:

1. Definí `BETTER_AUTH_URL` con el dominio público HTTPS y `BETTER_AUTH_SECRET` con un secreto aleatorio largo. No reutilices el valor de ejemplo.
2. Montá almacenamiento persistente para **todo** `/app/data`, no solo para `shopping.db`: SQLite también crea los archivos WAL y SHM.
3. Conservá `DB_PATH=/app/data/shopping.db`, salvo que uses otra ruta persistente.
4. Configurá una comprobación de salud contra `GET /api/health`.
5. Ejecutá una sola réplica. SQLite con un volumen local no admite escalado horizontal de forma segura.
6. Incluí el volumen de datos en tu política de backups.

El contenedor prepara los permisos del volumen antes de iniciar. El esquema se inicializa automáticamente; cualquier cambio futuro debe incluir una migración compatible con las instalaciones existentes.
