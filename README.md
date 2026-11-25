# Footballia para Kino TV

Plugin comunitario experimental para localizar partidos del catálogo de [Footballia](https://footballia.eu/) y abrirlos con el reproductor de Kino cuando el sitio exponga una fuente de vídeo directa compatible.

## Instalar en Kino
En Ajustes → Plugins → Agregar un plugin, selecciona **Kino** y escribe:

```
lennonl07-2/footballia-kino
```

## Funciones
- Categorías de competiciones: export `categories()` para aparecer dentro de Categorías de Kino.
- Búsqueda de partidos.
- Fila inicial con partidos que Footballia publique en su página principal.
- Navegación de páginas/categorías que contengan enlaces a partidos.
- Resolución al reproductor nativo únicamente si el HTML publica una URL directa de vídeo compatible.

## Limitación importante
Footballia puede requerir que cada usuario tenga su propia cuenta y puede proteger el vídeo detrás de su reproductor, sesión o controles de acceso. El plugin no comparte credenciales, no extrae tokens/cookies, no evade DRM, paywalls, suscripciones ni protección anti-hotlink. Si la página no expone una fuente directa autorizada, Kino mostrará un mensaje explicativo en vez de intentar saltarse esos controles.

La búsqueda depende de las rutas y del HTML públicos de Footballia, que pueden cambiar. Esta versión es experimental. La pantalla Categorías de Kino requiere el export `categories()` además de `browse`; ya está incluido. La búsqueda y la reproducción deben probarse en la app y con el SDK de Kino.

## Desarrollo
La estructura sigue la plantilla oficial de plugins de Kino. Para validar localmente, clona el repositorio y ejecuta:

```sh
node sdk/validate.mjs .
node sdk/run.mjs ./plugin.js search "Barcelona"
node sdk/run.mjs ./plugin.js home
```

Documentación: https://kinotvapp.github.io/kino-plugins/first-plugin/
