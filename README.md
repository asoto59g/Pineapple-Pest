# Plagueo en Piña — PWA de monitoreo agrícola

Link app

https://asoto59g.github.io/Pineapple-Pest/


Aplicación web progresiva (**PWA**) para registro de **plagas, enfermedades, malezas y parámetros de crecimiento** en cultivo de **piña** (Costa Rica / ABC Geomática Agricola SRL). Funciona como **SPA** en el navegador: una sola página (`index.html`) y vistas generadas en JavaScript; los datos se guardan en **`localStorage`** del dispositivo y se pueden enviar a **Google Sheets** mediante **Google Apps Script**.

---

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Recursos estáticos requeridos](#recursos-estáticos-requeridos)
- [Cómo ejecutar / desplegar](#cómo-ejecutar--desplegar)
- [Flujo de uso para el operador](#flujo-de-uso-para-el-operador)
- [Arquitectura de la aplicación](#arquitectura-de-la-aplicación)
- [Datos locales (`localStorage`)](#datos-locales-localstorage)
- [Monitoreo: pasos y escalas](#monitoreo-pasos-y-escalas)
- [Catálogos (plagas, enfermedades, malezas)](#catálogos-plagas-enfermedades-malezas)
- [Sincronización con Google Sheets](#sincronización-con-google-sheets)
- [PWA y Service Worker](#pwa-y-service-worker)
- [Interfaz y accesibilidad](#interfaz-y-accesibilidad)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Desarrollo y mantenimiento](#desarrollo-y-mantenimiento)

---

## Características

| Área | Descripción |
|------|-------------|
| **Registro de dispositivo** | Primera ejecución: nombre y correo del técnico; habilita el resto de la app. |
| **Panel Hoy** | Acceso a monitoreo, contador de pendientes de sync, botón de sincronización e instalación PWA (si el navegador lo permite). |
| **Administración** | Ciclos agrícolas, fincas, lotes/parcelas (con variedad y área), sugerencias de nombres de lote por finca, limpieza de registros ya sincronizados y cambio de usuario. |
| **Monitoreo** | Captura **GPS** al iniciar; encabezado (ciclo, finca, lote, edad, plaguero, variedad/área autollenados); pasos Plagas → Enfermedades → Malezas → Crecimiento; umbrales informativos en modal. |
| **Registros** | Listado local con estado PEND/SINC, detalle por categoría, edición solo si no sincronizado, eliminación y sync masivo. |
| **Offline-first** | Service Worker cachea activos locales; uso en campo sin red parcialmente posible tras primera carga. |

---

## Stack tecnológico

- **HTML5** — Estructura única y punto de montaje `#main-content`.
- **CSS3** — Tema oscuro, glassmorphism, animación de borde en tarjetas (`.card`), layout móvil, barra inferior fija.
- **JavaScript (vanilla)** — Sin framework; ~1900 líneas en `app.js` con estado global y plantillas de strings.
- **Lucide Icons** — CDN `unpkg.com/lucide` para iconografía vectorial.
- **Service Worker** — `sw.js` para caché y navegación offline básica.
- **Web APIs** — `localStorage`, Geolocation, `beforeinstallprompt` (PWA), `fetch` (sync).

---

## Estructura del repositorio

| Archivo / carpeta | Rol |
|-------------------|-----|
| **`index.html`** | Shell de la app: meta PWA, fuentes Google (Outfit), `manifest.json`, Lucide, contenedor `#app`, cabecera con logo/GPS/sync, `<main id="main-content">`, navegación inferior (Hoy / Admin / Registros), registro del Service Worker y carga de `app.js`. |
| **`app.js`** | Lógica principal: estado `APP_STATE`, catálogos `PEST_DB`, `DISEASE_DB`, `WEED_DB`, umbrales `THRESHOLDS_DATA`, navegación entre vistas `renderView()`, formularios de admin, flujo completo de monitoreo, persistencia, sync a Google, modales de umbrales (estilos inyectados). |
| **`style.css`** | Variables CSS (`:root`), componentes (`.card`, `.btn`, monitoreo, admin, registros), fondo `pineapple_field_bg.jpg`, animaciones. |
| **`manifest.json`** | Nombre corto/largo, `start_url`, `display: standalone`, colores de tema, icono 512. |
| **`sw.js`** | Caché `abc-pine-v1`, precache de rutas locales, estrategia cache/network para peticiones, fallback de navegación a `index.html`. |
| **`google_sheets_sync_guide.md`** | Guía detallada: contrato HTTP/JSON, ejemplo de Google Apps Script, columnas sugeridas y troubleshooting. |
| **`url script sheet.txt`** | Archivo de nota local con URL de ejemplo de Apps Script; **no subir URLs sensibles a repositorios públicos** sin revisar (usar `.gitignore` o variables si aplica). |

> **Nota:** En el despliegue real suelen existir también **`logo.png`**, **`icon-512.png`** y **`pineapple_field_bg.jpg`** (referenciados en HTML/CSS/`sw.js`). Si faltan en el clon, la PWA cargará con recursos rotos hasta que los añadas en la raíz del sitio.

---

## Recursos estáticos requeridos

Para que la PWA se vea y cachee correctamente, en la **misma carpeta** que `index.html` conviene tener:

- `logo.png` — Cabecera.
- `icon-512.png` — Manifest, Apple touch icon y caché del SW.
- `pineapple_field_bg.jpg` — Fondo de pantalla (definido en `style.css`).

El **Service Worker** (`sw.js`) lista explícitamente estos archivos en `ASSETS`; si cambias nombres o rutas, actualiza `ASSETS` y, si usas query strings de versión (`style.css?v=2`), alinea las URLs del precache con las que usa `index.html` para evitar duplicados o versiones obsoletas en caché.

---

## Cómo ejecutar / desplegar

### Local (pruebas rápidas)

La mayoría de navegadores exigen **HTTPS** o **localhost** para Service Worker y algunas APIs.

```bash
# Ejemplo con Python 3 (desde la carpeta del proyecto)
python -m http.server 8080
```

Abre `http://localhost:8080/index.html` (o `http://localhost:8080/`).

### Producción

1. Sube todos los archivos (HTML, JS, CSS, manifest, sw, imágenes) a un hosting **HTTPS** (GitHub Pages, Netlify, servidor propio, etc.).
2. Asegúrate de que **`sw.js`** y **`manifest.json`** se sirvan desde el **origen correcto** (mismo ámbito que la app).
3. Comprueba en DevTools → **Application** → Manifest / Service Workers.

---

## Flujo de uso para el operador

1. **Registro** — Si no hay usuario en `localStorage`, solo se muestra el formulario de dispositivo (nombre + email).
2. **Hoy** — Resumen, **Iniciar monitoreo** (pide GPS), sincronizar, instalar PWA opcional.
3. **Admin** — Dar de alta ciclos, fincas y lotes; borrar registros ya sincronizados; cambiar usuario.
4. **Monitoreo** — Tras GPS OK: encabezado → plagas → enfermedades → malezas → crecimiento → **Finalizar** (guarda registro local).
5. **Registros** — Ver, editar (solo pendientes), eliminar, **Sincronizar todo** (pendientes → Google).

---

## Arquitectura de la aplicación

### Estado global (`APP_STATE` en `app.js`)

- `currentView` — Vista activa.
- `user` — Objeto usuario o `null`.
- `collections` — `fincas`, `lotes`, `ciclos`, `lotesHistoricos`.
- `monitoring` — `coords`, `header`, `pests`, `diseases`, `weeds`, `growth` durante una sesión de monitoreo.
- `deferredPrompt` — Instalación PWA.
- `editingRecordIdx` — Índice del registro en edición o `null`.

### Navegación

`initNavigation()` escucha `.nav-item` y llama `renderView('dashboard'|'admin'|'records')`.

`renderView(viewName, preserveScroll)` reemplaza `innerHTML` de `#main-content` según un `switch`: incluye subvistas `admin_*`, `monitor_*` y `registration`. Si no hay usuario, fuerza `registration` y oculta la barra inferior.

### Persistencia

- `saveData()` guarda colecciones admin en `localStorage`.
- Registros de monitoreo: lectura/escritura directa de `abc_pine_monitoring_records` y contador `abc_pine_record_counter`.

---

## Datos locales (`localStorage`)

| Clave | Contenido |
|-------|-----------|
| `abc_pine_user` | JSON: `{ name, email, registeredAt }` |
| `abc_pine_fincas` | Array de `{ id, nombre }` |
| `abc_pine_lotes` | Array de `{ id, nombre, cicloId, fincaId, area?, variedad? }` |
| `abc_pine_ciclos` | Array de `{ id, nombre }` |
| `abc_pine_lotes_historicos` | Array de `{ nombre, fincaId }` (sugerencias datalist) |
| `abc_pine_monitoring_records` | Array de registros de monitoreo (ver guía Sheets) |
| `abc_pine_record_counter` | Entero string para correlativo `#num` |
| `abc_pine_sync_url` | URL `/exec` del Apps Script |

---

## Monitoreo: pasos y escalas

1. **Encabezado** — Ciclo, finca, lote (filtrado por ciclo+finca), edad, plaguero, variedad y área (solo lectura desde lote).
2. **Plagas** — Navegación por pestañas internas; niveles **0–3** (Nulo / Bajo / Medio / Alto) por ítem; benéficos con lógica visual invertida en indicadores.
3. **Enfermedades** — Escala **0–3** o grilla **0–9** según ítem (`pudricion_raiz` usa 0–9).
4. **Malezas** — Por especie, escala **0–9** (grilla tipo matriz en UI).
5. **Crecimiento** — Población, altura (cm), humedad del suelo (select), estado fenológico (select). Todos obligatorios para finalizar.

**Umbrales** — `showThreshold(id)` abre modal con tablas desde `THRESHOLDS_DATA` (incluye referencia tipo grilla para malezas).

---

## Catálogos (plagas, enfermedades, malezas)

Definidos en `app.js`:

- **Plagas** — Invertebrados, vertebrados y benéficos (`PEST_DB`); IDs estables para JSON (p. ej. `cochinilla_harinosa`, `roedores`, `crisopas`).
- **Enfermedades** — `DISEASE_DB` con `id`, `name` y `scale` (3 o 9).
- **Malezas** — `WEED_DB` array de nombres legibles; en el registro las claves de `weeds` son esos mismos strings.

Cualquier cambio de catálogo implica alinear columnas o parsers en Google Sheets si se usan JSON planos por columna.

---

## Sincronización con Google Sheets

La app envía un **POST** con cuerpo **JSON** (array de registros pendientes), `Content-Type: text/plain`, modo **`no-cors`**, a la URL guardada en `abc_pine_sync_url`.

**Documentación completa:** [`google_sheets_sync_guide.md`](./google_sheets_sync_guide.md) (formato del registro, script de ejemplo `doPost`, publicación como aplicación web, seguridad y troubleshooting).

**En la UI:** enlace “Configurar URL de Script” borra la URL almacenada para forzar un nuevo pegado en el próximo sync.

---

## PWA y Service Worker

- **`manifest.json`** — Instalable como app standalone; tema oscuro y color de acento cian.
- **`sw.js`** — Instalación con `skipWaiting`; activación limpia caches antiguas; `fetch` con prioridad a caché para recursos del mismo origen tras actualizar desde red cuando es posible.
- **Registro** — En `index.html` al final del `<body>`.

Tras cambios importantes en `sw.js`, incrementar **`CACHE_NAME`** (p. ej. `abc-pine-v2`) para que los clientes descarguen la nueva versión.

---

## Interfaz y accesibilidad

- Tipografía **Outfit** (Google Fonts).
- Barra inferior fija con área segura iOS (`env(safe-area-inset-bottom)`).
- Tarjetas `.card` con efecto glass y animación de borde; página **Admin** con filas táctiles (`admin-menu-card`) y soporte básico de teclado (`role="button"`, `tabindex`, `Enter` / espacio en algunos ítems).
- Vista móvil: `user-scalable=no` en viewport (valorar accesibilidad si se requiere zoom obligatorio).

---

## Limitaciones conocidas

| Tema | Detalle |
|------|---------|
| **Sync `no-cors`** | No se lee la respuesta del servidor; la app marca sincronizado si el `fetch` no lanza error de red. Verificar siempre en la hoja. |
| **Sin backend propio** | Toda la lógica de negocio y datos están en el cliente salvo el script de Google. |
| **GPS** | Obligatorio para iniciar monitoreo según implementación actual; permisos y entorno afectan éxito. |
| **Multi-dispositivo** | No hay sincronización entre dispositivos salvo vía Google Sheets después del envío. |

---

## Desarrollo y mantenimiento

- **Versión de assets:** `index.html` y `sw.js` (precache) usan `style.css?v=2` y `app.js?v=1`. Al cambiar queries de versión, actualice **ambos** y suba `CACHE_NAME` en `sw.js`.
- **Lucide `@latest`** — Puede cambiar en el tiempo; para builds reproducibles fijar versión en la URL del CDN.
- **Pruebas** — Probar flujo completo en Chrome/Android e iOS Safari (PWA y geolocalización se comportan distinto).

---

## Créditos

**ABC Geomática Agricola SRL** — Sistema de monitoreo de plagas en piña, basado en la línea de productos de plagueo/monitoreo agrícola de la organización.

---

## Licencia

Este proyecto está bajo la licencia **MIT**. Ver el archivo [`LICENSE`](./LICENSE).
