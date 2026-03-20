# Guía de sincronización con Google Sheets — Plagueo en Piña (PWA)

Documento para configurar el **envío de registros de monitoreo** desde la aplicación web/PWA hacia una hoja de cálculo de Google, mediante **Google Apps Script** publicado como **Aplicación web**.

---

## 1. Cómo funciona en la app

| Aspecto | Detalle |
|--------|---------|
| **Acción** | El usuario pulsa **SINCRONIZAR AHORA** (panel *Hoy*) o **SINCRONIZAR TODO** (*Registros*). |
| **Registros enviados** | Solo los que tienen `synced: false` (pendientes). |
| **Método HTTP** | `POST` |
| **URL** | La URL de despliegue de la Aplicación web de Apps Script (debe terminar en **`/exec`**). |
| **Cuerpo (`body`)** | Un **array JSON** de objetos registro (ver sección 4). Codificado como **texto** (`JSON.stringify(...)`). |
| **Cabecera** | `Content-Type: text/plain` |
| **Modo fetch** | `no-cors` (el navegador **no** puede leer la respuesta del servidor; la app **marca los registros como sincronizados** tras el `fetch` si no hay error de red). |

### Almacenamiento local (clave)

- **`abc_pine_sync_url`**: URL del script guardada en `localStorage`.
- En la app: enlace **“Configurar URL de Script”** borra esta clave para volver a pegar la URL al sincronizar.

### Limitación importante (`no-cors`)

La PWA **no puede comprobar** si Google realmente escribió en la hoja. Si el script falla o la URL es incorrecta, el usuario puede ver “sincronización enviada” igualmente. Conviene:

- Probar primero el script con **registros de prueba** y revisar la hoja.
- Opcional: en el futuro cambiar a `cors` + respuesta JSON y manejo de errores en la app.

---

## 2. Requisitos previos

1. Cuenta de Google con acceso a **Google Sheets** y **Google Apps Script**.
2. Una **hoja de cálculo** donde se volcarán los datos (o el script puede crear una hoja nueva).
3. Publicar el proyecto Apps Script como **Implementar → Aplicación web**:
   - **Ejecutar como**: *Yo*.
   - **Quién tiene acceso**: **Cualquier persona** (para que dispositivos en campo puedan enviar sin login Google en el navegador de la PWA).

---

## 3. Pasos rápidos (implementación)

1. Abre [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Pega el código de ejemplo de la **sección 6** (ajusta `SPREADSHEET_ID` y nombre de hoja si aplica).
3. **Guardar** el proyecto.
4. En el editor: **Implementar → Nueva implementación** → tipo **Aplicación web** → publicar.
5. Copia la URL que termina en **`/exec`**.
6. En la PWA, al sincronizar, pega esa URL cuando lo pida (o bórrala antes con “Configurar URL de Script” para forzar el prompt).
7. Crea un registro de prueba en la app y pulsa **Sincronizar**; revisa la hoja.

---

## 4. Formato JSON de cada registro

Cada elemento del array enviado en el `POST` es un objeto con esta forma (campos pueden faltar en registros antiguos; el script debe usar valores por defecto).

### 4.1 Campos raíz

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | ID único del registro (típicamente timestamp). |
| `num` | number | Número correlativo visible al usuario (`#1`, `#2`, …). |
| `timestamp` | string (ISO 8601) | Fecha/hora de creación. |
| `editedAt` | string (opcional) | Si se editó un pendiente, fecha de última edición. |
| `synced` | boolean | En el envío suele ser `false` (pendientes). |
| `syncedAt` | string (opcional) | La app lo rellena **después** del envío en local; el servidor puede ignorarlo o usar hora servidor. |
| `coords` | object \| null | `{ lat, lon, alt?, acc? }` (GPS al iniciar monitoreo). |
| `user` | object \| null | `{ name, email, registeredAt }` del dispositivo. |
| `header` | object | Datos del encabezado del monitoreo (ver abajo). |
| `pests` | object | Claves = ID de plaga (ver 4.3), valores = **0–3** (nivel). |
| `diseases` | object | Claves = ID de enfermedad, valores según escala en app (0–3 o 0–9). |
| `weeds` | object | Claves = **nombre exacto** de maleza (ver 4.5), valores = **0–9**. |
| `growth` | object | Parámetros de crecimiento (ver 4.4). |

### 4.2 `header`

| Campo | Descripción |
|-------|-------------|
| `ciclo` | ID del ciclo (local). |
| `ciclo_name` | Nombre del ciclo. |
| `finca` | ID de finca. |
| `finca_name` | Nombre de finca. |
| `lote` | ID de lote. |
| `lote_name` | Nombre del lote/parcela. |
| `edad` | Edad en meses (string o number según captura). |
| `variedad` | Variedad. |
| `area` | Área en ha. |
| `plaguero` | Nombre del plaguero. |

### 4.3 IDs de plagas (`pests`)

Mismos identificadores que en `app.js` (`PEST_DB`):

- `cochinilla_harinosa`, `cochinilla_raiz`, `acaro_planta`, `acaro_falso_rojo`, `nematodo_raiz`, `gusano_alambre`, `larvas_suelo`
- `roedores`, `pajaros`
- `crisopas`, `mariquitas`, `aranas`, `avispas`, `hongos_bio`

### 4.4 `growth`

| Campo | Descripción |
|-------|-------------|
| `poblacion` | Texto/número capturado (plantas/ha o por surco). |
| `altura` | Altura en cm. |
| `lamina` | Humedad del suelo: `Seco`, `Óptimo` o `Encharcado`. |
| `fenologia` | Estado fenológico (texto del selector). |

### 4.5 Nombres de malezas (`weeds`)

Claves exactas (como en `WEED_DB`):

`Cizaña`, `Caminadora`, `Coquito (Cyperus spp.)`, `Pasto Guinea`, `Pasto Estrella`, `Pasto Johnson`, `Rottboellia`, `Amaranthus`, `Commelina`, `Bidens pilosa`, `Conyza (paja peluda)`, `Hiedra terrestre`, `Mata ratón (Crotalaria spp.)`

### 4.6 IDs de enfermedades (`diseases`)

- `fusariosis`, `pudricion_corazon`, `pudricion_raiz`, `pudricion_fruto`, `mancha_folia`, `amarillamiento`

(Escalas: la mayoría 0–3; `pudricion_raiz` usa 0–9 en la app.)

### 4.7 Ejemplo mínimo (un registro)

```json
[
  {
    "id": "1730000000000",
    "num": 1,
    "timestamp": "2025-10-26T15:30:00.000Z",
    "synced": false,
    "coords": { "lat": 9.9347, "lon": -84.0875, "alt": null, "acc": 12 },
    "user": { "name": "Juan Pérez", "email": "juan@empresa.com", "registeredAt": "2025-01-01T12:00:00.000Z" },
    "header": {
      "ciclo": "123",
      "ciclo_name": "Piña 2026",
      "finca": "456",
      "finca_name": "Finca Norte",
      "lote": "789",
      "lote_name": "Bloque 3",
      "edad": "8",
      "variedad": "MD-2",
      "area": "12.5",
      "plaguero": "Juan Pérez"
    },
    "pests": { "cochinilla_harinosa": 1, "roedores": 0 },
    "diseases": { "fusariosis": 0, "pudricion_raiz": 0 },
    "weeds": { "Cizaña": 2, "Pasto Guinea": 0 },
    "growth": {
      "poblacion": "62000",
      "altura": "85",
      "lamina": "Óptimo",
      "fenologia": "Desarrollo vegetativo"
    }
  }
]
```

---

## 5. Diseño recomendado de la hoja

Dos enfoques:

1. **Una fila por registro** + columnas JSON (`pests_json`, `diseases_json`, `weeds_json`) para no tener cientos de columnas fijas. Fácil de mantener; para análisis se puede usar `IMPORTJSON` en hojas derivadas o Power Query.
2. **Una fila por registro** + **una columna por cada ID de plaga/enfermedad/maleza**. Máxima legibilidad en Excel/Sheets; el script debe mapear cada clave a su columna.

El ejemplo de la sección 6 usa **columnas fijas principales** + **tres columnas JSON** para plagas, enfermedades y malezas.

---

## 6. Ejemplo de Google Apps Script (`Code.gs`)

1. Crea una hoja de cálculo y copia su **ID** de la URL:  
   `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`
2. Crea una pestaña llamada **`Monitoreo_Pina`** (o cambia `SHEET_NAME`).
3. En la **primera fila** pon encabezados que coincidan con el orden del script (o ajusta el array `row` en el código).

```javascript
/**
 * Plagueo en Piña — receptor de sincronización PWA
 * Publicar como: Implementar → Aplicación web → Cualquier persona
 */

var SPREADSHEET_ID = 'PEGUE_AQUI_EL_ID_DE_SU_SPREADSHEET';
var SHEET_NAME = 'Monitoreo_Pina';

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Sin cuerpo' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var raw = e.postData.contents;
    var records = JSON.parse(raw);
    if (!Array.isArray(records)) {
      records = [records];
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // Encabezados (solo si la hoja está vacía)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'id', 'num', 'timestamp', 'user_name', 'user_email',
        'lat', 'lon', 'gps_acc',
        'ciclo_name', 'finca_name', 'lote_name', 'edad', 'variedad', 'area_ha', 'plaguero',
        'poblacion', 'altura_cm', 'humedad_suelo', 'fenologia',
        'pests_json', 'diseases_json', 'weeds_json'
      ]);
    }

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var h = r.header || {};
      var c = r.coords || {};
      var u = r.user || {};
      var g = r.growth || {};

      var row = [
        r.id || '',
        r.num != null ? r.num : '',
        r.timestamp || '',
        u.name || '',
        u.email || '',
        c.lat != null ? c.lat : '',
        c.lon != null ? c.lon : '',
        c.acc != null ? c.acc : '',
        h.ciclo_name || '',
        h.finca_name || '',
        h.lote_name || '',
        h.edad != null ? h.edad : '',
        h.variedad || '',
        h.area != null ? h.area : '',
        h.plaguero || '',
        g.poblacion != null ? g.poblacion : '',
        g.altura != null ? g.altura : '',
        g.lamina || '',
        g.fenologia || '',
        JSON.stringify(r.pests || {}),
        JSON.stringify(r.diseases || {}),
        JSON.stringify(r.weeds || {})
      ];
      sheet.appendRow(row);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, received: records.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Opcional: probar desde el editor (sin POST real) */
function testParse() {
  var sample = '[{"id":"1","num":1,"timestamp":"2025-01-01T00:00:00.000Z","header":{"ciclo_name":"C1"},"pests":{},"diseases":{},"weeds":{},"growth":{}}]';
  var e = { postData: { contents: sample } };
  Logger.log(doPost(e).getContent());
}
```

**Notas:**

- Si cambias el nombre de la implementación, **vuelve a publicar** una nueva versión para que `/exec` use el código actualizado.
- Puedes añadir validación (p. ej. clave secreta en el JSON) — habría que enviar esa clave desde la app en una futura versión.

---

## 7. Seguridad y buenas prácticas

- **“Cualquier persona”** implica que cualquiera con la URL puede enviar datos. Mitigaciones:
  - URL larga y no compartida públicamente.
  - Token compartido: campo fijo en el JSON que el script comprueba (requiere cambio en `app.js` para enviar el token).
  - Restringir por cuota de Apps Script y revisar la hoja periódicamente.
- No guardes la URL del script en repositorios públicos si la hoja es sensible.

---

## 8. Solución de problemas

| Síntoma | Qué revisar |
|---------|-------------|
| La app pide URL otra vez | Se borró `abc_pine_sync_url` o es la primera vez. |
| Alerta “debe terminar en /exec” | Usar enlace de **Aplicación web**, no el del editor ni `/dev`. |
| Hoja vacía tras “sincronizar” | Revisar **Ejecuciones** en Apps Script (errores), ID de spreadsheet, nombre de pestaña, permisos de la cuenta que ejecuta el script. |
| Datos duplicados | Cada sincronización **añade** filas; la app no reenvía los ya `synced: true`. Si el usuario reinstala la app o borra datos locales, podría volver a generar registros nuevos. |
| CORS / respuesta | Con `no-cors` la PWA no muestra el JSON de respuesta; depura con **registro de ejecución** en Apps Script. |

---

## 9. Referencia en código (esta carpeta)

- Envío: función `syncWithGoogleSheets()` en **`app.js`**.
- Clave URL: **`abc_pine_sync_url`**.
- Registros: **`abc_pine_monitoring_records`** (array JSON en `localStorage`).

---

*ABC Geomática — Plagueo en Piña (PWA). Documento generado para alinear backend Google Sheets con el comportamiento actual de la aplicación.*
