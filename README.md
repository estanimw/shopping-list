# Compra Ligera

Una lista de compras mínima y agradable de usar, pensada primero para móvil y ampliada para escritorio. Los productos se guardan en SQLite, por lo que sobreviven reinicios del navegador y del contenedor.

## Incluye

- Tarjeta CTA para añadir productos personalizados.
- Productos frecuentes de un toque con iconos de [Lucide](https://lucide.dev/).
- Cuentas con email y contraseña: cada persona ve y modifica únicamente sus propias listas.
- Gestos de arrastre: derecha para completar, izquierda para eliminar.
- Acciones visibles y accesibles con teclado en escritorio.
- Sección plegable de productos completados y opción para terminar toda la compra.
- Modo offline instalable: la última lista y sus cambios se guardan en el teléfono y se sincronizan al recuperar conexión.
- Fondo de color con movimiento tenue y soporte para `prefers-reduced-motion`.
- Endpoint de salud en `/api/health`.

## Desarrollo local

1. Instala dependencias con `npm install`.
2. Copia `.env.example` a `.env.local`. En producción, definí un `BETTER_AUTH_SECRET` aleatorio y `BETTER_AUTH_URL` con la URL pública de la app.
3. Ejecuta `npm run dev` y abre `http://localhost:3000`.

Por defecto, la base se crea en `data/shopping.db`.

## Usar sin señal

1. Con Internet, abrí la lista e instalala desde Chrome para Android con **Instalar aplicación** o **Agregar a pantalla de inicio**.
2. Después de esa primera carga, podés abrirla sin señal, agregar, completar, restaurar, eliminar productos o finalizar una compra.
3. El aviso debajo del título muestra si hay cambios pendientes. Se sincronizan al reconectar, volver a abrir la app o traerla de nuevo al frente.

Los cambios pendientes deben sincronizarse antes de cerrar sesión. La información offline se borra del teléfono al salir correctamente de la cuenta.

Para comprobar el modo de producción local: `npm run build` y luego `npm run start`.

## Ejecutar con Docker

```bash
docker compose up --build
```

La base queda en el volumen `shopping-data`, por lo que se conserva al recrear el contenedor.

## Desplegar en Coolify

1. Crea una aplicación desde el repositorio y selecciona **Dockerfile** como método de compilación.
2. Expón el puerto `3000`.
3. Añade un almacenamiento persistente para el directorio completo `/app/data` (no montes solo el archivo `.db`, porque SQLite crea también los archivos WAL y SHM).
4. Conserva `DB_PATH=/app/data/shopping.db` (ya es el valor por defecto de producción).
5. Define `BETTER_AUTH_URL` con el dominio público HTTPS de la app y `BETTER_AUTH_SECRET` con un secreto aleatorio largo. No reutilices el valor de ejemplo.
6. Configura la comprobación de salud en `/api/health` y despliega. La imagen ya incluye el mismo healthcheck.
7. Mantén **una sola réplica**: SQLite con un volumen local no está pensado para escalar horizontalmente.

El contenedor prepara los permisos del volumen para el usuario de la aplicación antes de iniciar. El esquema inicial se crea automáticamente; si se modifica en una versión futura, esa versión debe incluir su migración correspondiente. Al actualizar una instalación sin cuentas, sus listas existentes se asignan al primer usuario que ingrese.
