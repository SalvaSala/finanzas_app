# Diagramas de arquitectura

Diagramas generados con la skill **archify** (global, en `~/.agents/skills/archify/`).

| Fichero | Qué es |
|---|---|
| `finapp.architecture.json` | La **fuente**: qué cajas hay, cómo se conectan y dónde se colocan. Es lo que se edita. |
| `finapp-arquitectura.html` | El diagrama ya **generado**: se abre en el navegador, con tema claro/oscuro, zoom, búsqueda y exportación a imagen. |

## Regenerar el HTML tras editar la fuente

```bash
ARCHIFY=~/.agents/skills/archify

node $ARCHIFY/bin/archify.mjs validate architecture \
  docs/arquitectura/finapp.architecture.json --quality showcase --json

node $ARCHIFY/bin/archify.mjs deliver architecture \
  docs/arquitectura/finapp.architecture.json \
  docs/arquitectura/finapp-arquitectura.html --quality showcase --json
```

`validate` debe dar los **9 checks en verde y 0 avisos** antes de entregar. Los fallos
más habituales son de colocación: un rótulo de flecha que pisa una caja (se corrige con
`labelDy`) o un `viewBox` tan ancho que los subtítulos bajarían de 6px a 1440px de ancho
(se corrige estrechándolo).

Comprobación opcional en un navegador real, que mide contención y legibilidad en
varios tamaños de pantalla:

```bash
ARCHIFY_CHROME=~/.cache/ms-playwright/chromium-1194/chrome-linux/chrome \
  node $ARCHIFY/bin/archify.mjs visual-check \
  docs/arquitectura/finapp-arquitectura.html --json
```

Deja ficheros `*.visual-check.*` (capturas y recibo) junto al HTML: son temporales,
no hace falta versionarlos.

## Al cambiar la arquitectura

El diagrama es una **foto**, no se actualiza solo. Si se mueven capas, se añade un
servicio o cambia el empaquetado, hay que editar el JSON y regenerar.
