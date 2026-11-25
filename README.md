# Footballia para Kino TV

Plugin comunitario para consultar el catálogo de Footballia y probar reproducción nativa cuando la página exponga una URL directa compatible.

## Instalar
En Kino → Ajustes → Plugins → Agregar → Kino, escribe:
`lennonl07-2/footballia-kino`

## Vincular cuenta
1. Abre Ajustes → Plugins → Footballia → Configurar.
2. Pulsa **Iniciar sesión en Footballia**.
3. Inicia sesión con TU propia cuenta en la ventana web de Kino.
4. Pulsa **Listo** en la barra superior de Kino.
5. El estado debe indicar que la sesión quedó guardada.

Cada usuario guarda su propia sesión localmente en los ajustes cifrados del plugin. No se comparte la cuenta del autor. La sesión puede caducar y requerir volver a vincularla.

## Funciones
- Categorías de competiciones mediante `categories()`.
- Búsqueda de partidos.
- Fila de partidos de la portada.
- Navegación de competiciones.
- Resolver para el reproductor nativo cuando Footballia exponga una URL HTTPS directa compatible.

## Limitaciones
- La ventana de inicio de sesión requiere Kino 0.9.81+ y WebView; en Android TV el soporte es experimental.
- El sitio puede cambiar las cookies, las rutas de búsqueda o su HTML.
- El resolver no evade DRM, controles de suscripción, tokens de reproducción ni protección anti-hotlink. Si Footballia no entrega una URL directa autorizada, el vídeo no se abrirá en el reproductor nativo.
- El SDK de Kino debe validar y probarse localmente antes de considerar estable esta versión.

Documentación:
- https://kinotvapp.github.io/kino-plugins/manifest/
- https://kinotvapp.github.io/kino-plugins/visual-browser/
- https://kinotvapp.github.io/kino-plugins/section-theme/
